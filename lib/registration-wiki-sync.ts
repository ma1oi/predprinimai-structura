import { readFile, stat } from "node:fs/promises";
import { YandexWikiRegistrationExporter, YandexWikiSyncError } from "./yandex-wiki";
import { readRegistrations } from "./registration-store";
import type { YandexWikiSyncStatus } from "./yandex-wiki-types";

const state = { syncing: false, lastSyncedAt: null as string | null, total: 0, added: 0, error: "" };
let running: Promise<void> | undefined;
let requested = false;
let lastAttemptAt = 0;

export function yandexWikiConfigured() {
  return Boolean((process.env.YANDEX_WIKI_OAUTH_TOKEN || process.env.YANDEX_WIKI_OAUTH_TOKEN_FILE) && process.env.YANDEX_WIKI_ORG_ID && process.env.YANDEX_WIKI_GRID_ID);
}

export function yandexWikiStatus(): YandexWikiSyncStatus {
  let url: string | null = null;
  try {
    const target = new URL(process.env.YANDEX_WIKI_PAGE_URL || "");
    if (target.protocol === "https:" && target.hostname === "wiki.yandex.ru" && !target.username && !target.password && !target.port) url = target.href;
  } catch { /* A missing or invalid optional page link is never rendered. */ }
  return { ...state, configured: yandexWikiConfigured(), url };
}

async function exporter() {
  let token = process.env.YANDEX_WIKI_OAUTH_TOKEN?.trim() || "";
  if (!token && process.env.YANDEX_WIKI_OAUTH_TOKEN_FILE) {
    try {
      const filename = process.env.YANDEX_WIKI_OAUTH_TOKEN_FILE;
      if ((await stat(filename)).size > 8192) throw new Error("Invalid token file");
      token = (await readFile(filename, "utf8")).trim();
    } catch { throw new YandexWikiSyncError("Не удалось прочитать OAuth-токен Яндекс Вики. Проверьте файл и права доступа на сервере."); }
  }
  return new YandexWikiRegistrationExporter({ token, orgId: process.env.YANDEX_WIKI_ORG_ID!, orgType: (process.env.YANDEX_WIKI_ORG_TYPE || "360") as "360" | "cloud", gridId: process.env.YANDEX_WIKI_GRID_ID! });
}

/** Coalesce appends in one Node process. The local store is the durable backlog. */
export function syncYandexWikiRegistrations(): Promise<void> {
  if (!yandexWikiConfigured()) return Promise.resolve();
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
        const result = await (await exporter()).sync(records);
        state.lastSyncedAt = result.syncedAt;
        state.total = result.total;
        state.added = result.added;
        state.error = "";
      } while (requested);
    } catch (error) {
      state.error = error instanceof YandexWikiSyncError ? error.message : "Не удалось синхронизировать заявки с Яндекс Вики. Данные в админке сохранены.";
    } finally {
      state.syncing = false;
      running = undefined;
    }
  })();
  return running;
}
