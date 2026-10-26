import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import seed from "../data/partners.json" with { type: "json" };
import type { Partner, PartnerDocument } from "./partner-types";

const logoPattern = /^(?:\/assets\/figma\/partner-[12]\.webp|\/media\/speakers\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp)$/;
const queues = new Map<string, Promise<unknown>>();

export class PartnerStoreError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export function validatePartnerDocument(value: unknown): PartnerDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PartnerStoreError("Некорректный список партнёров.");
  const input = value as Record<string, unknown>;
  if (typeof input.revision !== "string" || !input.revision || input.revision.length > 128) throw new PartnerStoreError("Загрузите список заново перед сохранением.");
  if (!Array.isArray(input.partners) || input.partners.length > 100) throw new PartnerStoreError("В списке может быть не более 100 партнёров.");
  const ids = new Set<string>();
  const partners = input.partners.map((value: unknown): Partner => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new PartnerStoreError("Некорректный партнёр.");
    const item = value as Record<string, unknown>;
    if (typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || ids.has(item.id)) throw new PartnerStoreError("Идентификаторы партнёров должны быть уникальными.");
    ids.add(item.id);
    if (typeof item.name !== "string" || !item.name.trim() || item.name.trim().length > 160 || /[\u0000-\u001f\u007f]/.test(item.name)) throw new PartnerStoreError("Укажите название партнёра, не более 160 символов.");
    if (typeof item.published !== "boolean") throw new PartnerStoreError("Некорректный статус публикации партнёра.");
    if (typeof item.logo !== "string" || (item.logo !== "" && !logoPattern.test(item.logo))) throw new PartnerStoreError("Загрузите логотип через форму.");
    if (item.published && !item.logo) throw new PartnerStoreError("Добавьте логотип перед публикацией партнёра.");
    return { id: item.id, name: item.name.trim(), logo: item.logo, published: item.published };
  });
  return { partners, revision: input.revision };
}

function documentFor(partners: Partner[]): PartnerDocument {
  return { partners, revision: createHash("sha256").update(JSON.stringify(partners)).digest("hex") };
}

export class PartnerStore {
  readonly directory: string;
  readonly filename: string;
  constructor(directory = process.env.PARTNERS_DATA_DIR || path.join(process.cwd(), ".data")) {
    this.directory = path.resolve(/* turbopackIgnore: true */ directory);
    this.filename = path.join(this.directory, "partners.json");
  }
  async read(): Promise<PartnerDocument> {
    let raw: string;
    try { raw = await readFile(this.filename, "utf8"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return documentFor(validatePartnerDocument({ ...seed, revision: "seed" }).partners);
      throw new PartnerStoreError("Не удалось прочитать партнёров.", 500);
    }
    try { return documentFor(validatePartnerDocument({ ...JSON.parse(raw), revision: "stored" }).partners); }
    catch { throw new PartnerStoreError("Файл партнёров повреждён. Обратитесь к администратору.", 500); }
  }
  async published() { return (await this.read()).partners.filter((partner) => partner.published && partner.logo); }
  async save(value: unknown): Promise<PartnerDocument> {
    const input = validatePartnerDocument(value);
    const previous = queues.get(this.filename) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(async () => {
      const current = await this.read();
      if (current.revision !== input.revision) throw new PartnerStoreError("Партнёры уже изменены в другой вкладке. Загрузите актуальный список.", 409);
      const updated = documentFor(input.partners);
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      const temporary = path.join(this.directory, `.partners-${randomUUID()}.tmp`);
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

const store = new PartnerStore();
export const readPartnerDocument = () => store.read();
export const savePartnerDocument = (value: unknown) => store.save(value);
export const getPublishedPartners = () => store.published();
