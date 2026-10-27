import { readFile, stat } from "node:fs/promises";
import { YandexDiskRegistrationExporter, YandexDiskSyncError } from "./yandex-disk";
import { readRegistrations } from "./registration-store";
import type { YandexDiskSyncStatus } from "./yandex-disk-types";

const state = { syncing: false, lastSyncedAt: null as string | null, total: 0, error: "" };
let running: Promise<void> | undefined;
let requested = false;
let lastAttemptAt = 0;

export function yandexDiskConfigured() {
  return Boolean(process.env.YANDEX_DISK_OAUTH_TOKEN || process.env.YANDEX_DISK_OAUTH_TOKEN_FILE);
}

export function yandexDiskStatus(): YandexDiskSyncStatus {
  return { ...state, configured: yandexDiskConfigured(), url: "https://disk.yandex.ru/client/disk", path: process.env.YANDEX_DISK_PATH || "app:/Заявки фестиваля.xlsx" };
}

async function exporter() {
  let token = process.env.YANDEX_DISK_OAUTH_TOKEN?.trim() || "";
  if (!token && process.env.YANDEX_DISK_OAUTH_TOKEN_FILE) {
    try {
      const filename = process.env.YANDEX_DISK_OAUTH_TOKEN_FILE;
      if ((await stat(filename)).size > 8192) throw new Error("Invalid token file");
      token = (await readFile(filename, "utf8")).trim();
    } catch { throw new YandexDiskSyncError("Не удалось прочитать OAuth-токен Яндекс Диска. Проверьте файл и права доступа на сервере."); }
  }
  return new YandexDiskRegistrationExporter({ token, path: yandexDiskStatus().path });
}

/** Coalesce uploads in one Node process. The local store is the durable backlog. */
export function syncYandexRegistrations(): Promise<void> {
  if (!yandexDiskConfigured()) return Promise.resolve();
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
        state.error = "";
      } while (requested);
    } catch (error) {
      state.error = error instanceof YandexDiskSyncError ? error.message : "Не удалось синхронизировать заявки с Яндекс Диском. Данные в админке сохранены.";
    } finally {
      state.syncing = false;
      running = undefined;
    }
  })();
  return running;
}
