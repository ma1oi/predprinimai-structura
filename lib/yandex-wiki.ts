import type { Registration } from "./registration-types";

type WikiFetch = (url: string, init: RequestInit) => Promise<Response>;
export interface WikiConfig { token: string; orgId: string; orgType: "360" | "cloud"; gridId: string; }
interface Column { slug: string; type: string; format?: string | null; multiple?: boolean; required?: boolean; }
interface Grid { revision: string; structure: { columns: Column[] }; rows: { id: string; row: unknown[] }[]; }
export class YandexWikiSyncError extends Error {}
class RequestError extends YandexWikiSyncError {
  readonly retryable: boolean;
  constructor(message: string, retryable = false) { super(message); this.retryable = retryable; }
}

export const registrationWikiColumns = [
  { slug: "registration-id", title: "ID заявки (служебный)", type: "string", format: "plain", required: true },
  { slug: "registered-at", title: "Дата регистрации (МСК)", type: "string", format: "plain", required: false },
  { slug: "name", title: "Имя", type: "string", format: "plain", required: false },
  { slug: "phone", title: "Телефон", type: "string", format: "plain", required: false },
  { slug: "company", title: "Компания или вуз", type: "string", format: "plain", required: false },
  { slug: "consent", title: "Согласие", type: "string", format: "plain", required: false },
] as const;
const dateFormat = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", dateStyle: "short", timeStyle: "medium" });

function gridIds(grid: Grid): Set<string> {
  const columns = grid.structure.columns;
  if (new Set(columns.map((column) => column.slug)).size !== columns.length) throw new YandexWikiSyncError("В таблице Вики повторяются служебные столбцы. Проверьте структуру таблицы.");
  for (const expected of registrationWikiColumns) {
    const column = columns.find((column) => column.slug === expected.slug);
    if (!column || column.type !== "string" || column.multiple || (column.format && column.format !== "plain")) throw new YandexWikiSyncError(`Проверьте столбец «${expected.title}» в Вики: нужен обычный текст и слаг ${expected.slug}.`);
  }
  const slugs = new Set<string>(registrationWikiColumns.map((column) => column.slug));
  if (columns.some((column) => column.required && !slugs.has(column.slug))) throw new YandexWikiSyncError("В таблице Вики есть дополнительные обязательные столбцы. Сделайте их необязательными для новых заявок.");
  const index = columns.findIndex((column) => column.slug === "registration-id");
  const ids = new Set<string>();
  for (const row of grid.rows) {
    if (!row || !Array.isArray(row.row)) throw new YandexWikiSyncError("Вики вернула некорректные строки таблицы. Синхронизация остановлена.");
    const value = row.row[index];
    if (value === null || value === undefined || value === "") continue;
    if (typeof value !== "string" || ids.has(value.toLowerCase())) throw new YandexWikiSyncError("Проверьте служебные ID заявок в Вики: значения должны быть текстом и не повторяться.");
    ids.add(value.toLowerCase());
  }
  return ids;
}

export class YandexWikiRegistrationExporter {
  private readonly config: WikiConfig;
  private readonly request: WikiFetch;
  constructor(config: WikiConfig, request: WikiFetch = fetch) {
    if (!/^[\x21-\x7e]{16,4096}$/.test(config.token)) throw new YandexWikiSyncError("Проверьте OAuth-токен Вики на сервере.");
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(config.orgId) || !["360", "cloud"].includes(config.orgType)) throw new YandexWikiSyncError("Проверьте ID и тип организации Вики в настройках сервера.");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(config.gridId)) throw new YandexWikiSyncError("Укажите корректный ID динамической таблицы Вики.");
    this.config = config; this.request = request;
  }
  private async api(suffix = "", body?: unknown, attempt = 0): Promise<unknown> {
    let response: Response;
    try {
      response = await this.request(`https://api.wiki.yandex.net/v1/grids/${this.config.gridId}${suffix}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { Authorization: `OAuth ${this.config.token}`, [this.config.orgType === "cloud" ? "X-Cloud-Org-Id" : "X-Org-Id"]: this.config.orgId, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
      });
    } catch { throw new RequestError("Вики временно недоступна. Заявки сохранены в админке; повторите синхронизацию.", true); }
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401) throw new RequestError("Вики не приняла токен. Получите OAuth-токен с правами wiki:read и wiki:write.");
      if (response.status === 403) throw new RequestError("Нет доступа к Вики. Проверьте права токена, ID организации и право редактирования страницы.");
      if (response.status === 404) throw new RequestError("Таблица Вики не найдена. Проверьте ID таблицы, организацию и публикацию страницы.");
      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const seconds = retryAfter !== null ? Number(retryAfter) : Number.NaN;
        const requestedWait = Number.isFinite(seconds) ? seconds * 1000 : 1000 * 2 ** attempt;
        if (attempt < 2 && requestedWait >= 0 && requestedWait <= 10_000) {
          await new Promise((resolve) => setTimeout(resolve, requestedWait));
          return this.api(suffix, body, attempt + 1);
        }
        throw new RequestError("Вики ограничила частоту запросов. Повторите синхронизацию позже.");
      }
      const conflict = response.status === 409 || /REVISION/i.test(typeof result?.error_code === "string" ? result.error_code : "");
      throw new RequestError(conflict ? "Таблица Вики изменена одновременно. Повторите синхронизацию." : "Вики не подтвердила добавление заявок. Данные в админке сохранены.", conflict || response.status >= 500 || response.status === 408);
    }
    return result;
  }
  private async read(): Promise<Grid> {
    const value = await this.api() as Partial<Grid> | null;
    if (!value || typeof value.revision !== "string" || !value.revision || !Array.isArray(value.structure?.columns) || !value.structure.columns.every((column) => column && typeof column.slug === "string") || !Array.isArray(value.rows)) throw new YandexWikiSyncError("Вики вернула неполные данные таблицы. Синхронизация остановлена.");
    return value as Grid;
  }
  async sync(registrations: Registration[]) {
    const records = [...registrations].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (new Set(records.map((record) => record.id.toLowerCase())).size !== records.length) throw new YandexWikiSyncError("В списке заявок повторяются ID. Обратитесь к администратору.");
    let initialized = false;
    let initialCount: number | undefined;
    let retries = 0;
    const maxSteps = Math.ceil(records.length / 100) + 7;
    for (let step = 0; step < maxSteps; step++) {
      const grid = await this.read();
      if (!grid.structure.columns.length && !grid.rows.length && !initialized) {
        initialized = true;
        try { await this.api("/columns", { revision: grid.revision, columns: registrationWikiColumns }); }
        catch (error) { if (!(error instanceof RequestError) || !error.retryable) throw error; }
        continue;
      }
      const existing = gridIds(grid);
      const present = records.filter((record) => existing.has(record.id.toLowerCase())).length;
      initialCount ??= present;
      const pending = records.filter((record) => !existing.has(record.id.toLowerCase()));
      if (!pending.length) return { total: records.length, added: present - initialCount, syncedAt: new Date().toISOString() };
      const rows = pending.slice(0, 100).map((record) => ({ "registration-id": record.id, "registered-at": dateFormat.format(new Date(record.createdAt)), name: record.name, phone: record.phone, company: record.company, consent: "Да" }));
      try {
        await this.api("/rows", { revision: grid.revision, position: grid.rows.length, rows });
      } catch (error) {
        if (!(error instanceof RequestError) || !error.retryable || ++retries > 3) throw error;
      }
      // Read after every append, including ambiguous failures, before deciding which IDs are still absent.
    }
    throw new YandexWikiSyncError("Вики не подтвердила все заявки. Повторите синхронизацию; добавленные ID будут пропущены.");
  }
}
