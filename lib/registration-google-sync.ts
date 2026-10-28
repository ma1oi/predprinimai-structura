import { GoogleAuth } from "google-auth-library";
import { GoogleSheetsRegistrationExporter, type SheetsRequest } from "./google-sheets";
import { readRegistrations } from "./registration-store";
import type { GoogleSheetsSyncStatus } from "./google-sheets-types";

const state = { syncing: false, lastSyncedAt: null as string | null, total: 0, added: 0, error: "" };
let running: Promise<void> | undefined;
let requested = false;
let auth: GoogleAuth | undefined;
let authKeyFile: string | undefined;
let lastAttemptAt = 0;

class SyncError extends Error {}

export function googleSheetsConfigured() {
  return Boolean(process.env.GOOGLE_SHEETS_SPREADSHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE);
}

export function googleSheetsStatus(): GoogleSheetsSyncStatus {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  return { ...state, configured: googleSheetsConfigured(), url: id && /^[\w-]{20,100}$/.test(id) ? `https://docs.google.com/spreadsheets/d/${id}/edit` : null };
}

function exporter() {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE!;
  if (!/^[\w-]{20,100}$/.test(id)) throw new SyncError("Проверьте ID Google Таблицы в настройках сервера.");
  if (!auth || authKeyFile !== keyFile) {
    auth = new GoogleAuth({ keyFile, scopes: ["https://www.googleapis.com/auth/spreadsheets"], clientOptions: { transporterOptions: { timeout: 10_000 } } });
    authKeyFile = keyFile;
  }
  const googleAuth = auth;
  const request: SheetsRequest = async (path, init = {}) => {
    let token: string | null | undefined;
    try {
      const client = await googleAuth.getClient();
      token = (await client.getAccessToken()).token;
    } catch {
      throw new SyncError("Не удалось авторизоваться в Google. Проверьте JSON-ключ сервисного аккаунта на сервере.");
    }
    if (!token) throw new SyncError("Google не выдал токен для записи заявок.");
    let response: Response;
    try {
      response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}${path}`, {
        ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15_000), cache: "no-store", redirect: "error",
      });
    } catch {
      throw new SyncError("Google Таблица временно недоступна. Заявки сохранены в админке; повторите синхронизацию.");
    }
    if (!response.ok) {
      if (response.status === 403) throw new SyncError("Google запретил доступ. Включите Google Sheets API и предоставьте сервисному аккаунту доступ редактора к таблице.");
      if (response.status === 404) throw new SyncError("Google Таблица не найдена или недоступна сервисному аккаунту. Проверьте ID и доступ.");
      throw new SyncError(`Google вернул ошибку ${response.status}. Заявки сохранены; повторите синхронизацию.`);
    }
    return response.json();
  };
  return new GoogleSheetsRegistrationExporter({ tabName: process.env.GOOGLE_SHEETS_TAB || "Заявки сайта" }, request);
}

/** Coalesce concurrent submissions; the local registration store remains the durable backlog. */
export function syncGoogleRegistrations(): Promise<void> {
  if (!googleSheetsConfigured()) return Promise.resolve();
  requested = true;
  if (running) return running;
  state.syncing = true;
  state.error = "";
  running = (async () => {
    try {
      do {
        const wait = Math.max(0, lastAttemptAt + 5000 - Date.now());
        if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
        requested = false;
        lastAttemptAt = Date.now();
        const records = await readRegistrations();
        const result = await exporter().sync(records);
        state.lastSyncedAt = result.syncedAt;
        state.total = result.total;
        state.added = result.exported;
        state.error = "";
      } while (requested);
    } catch (error) {
      // Never expose transport error objects, credentials, or registration rows.
      state.error = error instanceof SyncError ? error.message : "Не удалось синхронизировать заявки. Проверьте лист и его заголовки; данные в админке сохранены.";
    } finally {
      state.syncing = false;
      running = undefined;
    }
  })();
  return running;
}
