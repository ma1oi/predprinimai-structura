import { buildRegistrationWorkbook } from "./registration-export";
import type { Registration } from "./registration-types";

type DiskFetch = (url: string, init: RequestInit) => Promise<Response>;
export class YandexDiskSyncError extends Error {}

export class YandexDiskRegistrationExporter {
  private readonly token: string;
  private readonly path: string;
  private readonly request: DiskFetch;

  constructor(config: { token: string; path: string }, request: DiskFetch = fetch) {
    if (!/^[\x21-\x7e]{16,4096}$/.test(config.token)) throw new YandexDiskSyncError("Проверьте OAuth-токен Яндекс Диска на сервере.");
    if (!/^(app|disk):\/.+\.xlsx$/i.test(config.path) || config.path.length > 1024 || /[\u0000-\u001f\u007f]/.test(config.path) || config.path.split("/").some((part) => part === "." || part === "..")) {
      throw new YandexDiskSyncError("Укажите путь к XLSX-файлу в настройке YANDEX_DISK_PATH.");
    }
    this.token = config.token;
    this.path = config.path;
    this.request = request;
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try { response = await this.request(url, { ...init, cache: "no-store", redirect: "error" }); }
    catch { throw new YandexDiskSyncError("Яндекс Диск временно недоступен. Заявки сохранены в админке; повторите синхронизацию."); }
    if (!response.ok) {
      if (response.status === 401) throw new YandexDiskSyncError("Яндекс не принял OAuth-токен. Проверьте токен на сервере или выпустите новый.");
      if (response.status === 403) throw new YandexDiskSyncError("Яндекс запретил запись. Проверьте права OAuth-приложения и соответствие пути папке приложения.");
      if (response.status === 404 || response.status === 409) throw new YandexDiskSyncError("Папка на Яндекс Диске не найдена или файл занят. Проверьте путь и закройте редактор таблицы.");
      if (response.status === 507) throw new YandexDiskSyncError("На Яндекс Диске закончилось место. Освободите его и повторите синхронизацию.");
      throw new YandexDiskSyncError(`Яндекс вернул ошибку ${response.status}. Заявки сохранены в админке; повторите синхронизацию.`);
    }
    return response;
  }

  async sync(registrations: Registration[]) {
    const query = new URLSearchParams({ path: this.path, overwrite: "true" });
    const response = await this.send(`https://cloud-api.yandex.net/v1/disk/resources/upload?${query}`, {
      method: "GET", headers: { Authorization: `OAuth ${this.token}` }, signal: AbortSignal.timeout(15_000),
    });
    const target = await response.json().catch(() => null);
    let upload: URL;
    try { upload = new URL(target?.href); }
    catch { throw new YandexDiskSyncError("Яндекс не вернул адрес для загрузки. Повторите синхронизацию."); }
    if (target?.method !== "PUT" || upload.protocol !== "https:" || upload.username || upload.password || upload.port || !upload.hostname.endsWith(".yandex.net")) {
      throw new YandexDiskSyncError("Яндекс вернул неподдерживаемый адрес загрузки. Повторите синхронизацию.");
    }
    // A complete generated snapshot makes retries idempotent. OAuth is sent only to the API host.
    const workbook = await buildRegistrationWorkbook(registrations);
    await this.send(upload.href, {
      method: "PUT", headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      body: new Uint8Array(workbook), signal: AbortSignal.timeout(45_000),
    });
    return { total: registrations.length, syncedAt: new Date().toISOString() };
  }
}
