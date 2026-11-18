import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { InformationPartner, InformationPartnerDocument } from "./information-partner-types";

const photoPattern = /^(?:\/media\/speakers\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp)$/;
const queues = new Map<string, Promise<unknown>>();

export class InformationPartnerStoreError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export function validateInformationPartnerDocument(value: unknown): InformationPartnerDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InformationPartnerStoreError("Некорректный список информационных партнёров.");
  const input = value as Record<string, unknown>;
  if (typeof input.revision !== "string" || !input.revision || input.revision.length > 128) throw new InformationPartnerStoreError("Загрузите список заново перед сохранением.");
  if (!Array.isArray(input.partners) || input.partners.length > 100) throw new InformationPartnerStoreError("В списке может быть не более 100 партнёров.");
  const ids = new Set<string>();
  const partners = input.partners.map((value: unknown): InformationPartner => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new InformationPartnerStoreError("Некорректный партнёр.");
    const item = value as Record<string, unknown>;
    if (typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || ids.has(item.id)) throw new InformationPartnerStoreError("Идентификаторы партнёров должны быть уникальными.");
    ids.add(item.id);
    if (typeof item.name !== "string" || !item.name.trim() || item.name.trim().length > 160 || /[\u0000-\u001f\u007f]/.test(item.name)) throw new InformationPartnerStoreError("Укажите название партнёра, не более 160 символов.");
    if (typeof item.published !== "boolean") throw new InformationPartnerStoreError("Некорректный статус публикации партнёра.");
    if (typeof item.photo !== "string" || (item.photo !== "" && !photoPattern.test(item.photo))) throw new InformationPartnerStoreError("Загрузите фото через форму.");
    if (item.published && !item.photo) throw new InformationPartnerStoreError("Добавьте фото перед публикацией партнёра.");
    if (typeof item.job !== "string" || item.job.trim().length > 300 || /[\u0000-\u001f\u007f]/.test(item.job)) throw new InformationPartnerStoreError("Укажите должность, не более 300 символов.");
    if (typeof item.socialUrl !== "string" || item.socialUrl.length > 2048 || /[\u0000-\u001f\u007f]/.test(item.socialUrl)) throw new InformationPartnerStoreError("Укажите ссылку на соцсеть.");
    let socialUrl = item.socialUrl.trim();
    if (socialUrl) {
      try {
        const url = new URL(socialUrl);
        if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error("Invalid social URL");
        socialUrl = url.href;
        if (socialUrl.length > 2048) throw new Error("Social URL too long");
      } catch { throw new InformationPartnerStoreError("Ссылка на соцсеть должна начинаться с https:// или http:// и не содержать логин или пароль."); }
    }
    if (item.published && !socialUrl) throw new InformationPartnerStoreError("Добавьте ссылку на соцсеть перед публикацией.");
    return { id: item.id, name: item.name.trim(), job: item.job.trim(), photo: item.photo, socialUrl, published: item.published };
  });
  return { partners, revision: input.revision };
}

function documentFor(partners: InformationPartner[]): InformationPartnerDocument {
  return { partners, revision: createHash("sha256").update(JSON.stringify(partners)).digest("hex") };
}

export class InformationPartnerStore {
  readonly directory: string;
  readonly filename: string;
  constructor(directory = process.env.INFORMATION_PARTNERS_DATA_DIR || path.join(process.cwd(), ".data")) {
    this.directory = path.resolve(/* turbopackIgnore: true */ directory);
    this.filename = path.join(this.directory, "information-partners.json");
  }
  async read(): Promise<InformationPartnerDocument> {
    let raw: string;
    try { raw = await readFile(this.filename, "utf8"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return documentFor([]);
      throw new InformationPartnerStoreError("Не удалось прочитать партнёров.", 500);
    }
    try { return documentFor(validateInformationPartnerDocument({ ...JSON.parse(raw), revision: "stored" }).partners); }
    catch { throw new InformationPartnerStoreError("Файл информационных партнёров повреждён. Обратитесь к администратору.", 500); }
  }
  async published() { return (await this.read()).partners.filter((partner) => partner.published && partner.photo); }
  async save(value: unknown): Promise<InformationPartnerDocument> {
    const input = validateInformationPartnerDocument(value);
    const previous = queues.get(this.filename) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(async () => {
      const current = await this.read();
      if (current.revision !== input.revision) throw new InformationPartnerStoreError("Партнёры уже изменены в другой вкладке. Загрузите актуальный список.", 409);
      const updated = documentFor(input.partners);
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      const temporary = path.join(this.directory, `.information-partners-${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, `${JSON.stringify(updated, null, 2)}\n`, { mode: 0o600, flag: "wx" });
        await rename(temporary, this.filename);
      } finally {
        await unlink(temporary).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
      }
      return updated;
    });
    queues.set(this.filename, operation);
    try { return await operation; }
    finally { if (queues.get(this.filename) === operation) queues.delete(this.filename); }
  }
}

const store = new InformationPartnerStore();
export const readInformationPartnerDocument = () => store.read();
export const saveInformationPartnerDocument = (value: unknown) => store.save(value);
export const getPublishedInformationPartners = () => store.published();
