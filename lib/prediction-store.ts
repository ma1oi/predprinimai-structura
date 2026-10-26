import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import seed from "../data/predictions.json" with { type: "json" };
import type { Prediction, PredictionDocument } from "./prediction-types";

const queues = new Map<string, Promise<unknown>>();

export class PredictionStoreError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export function validatePredictionDocument(value: unknown): PredictionDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PredictionStoreError("Некорректный список предсказаний.");
  const input = value as Record<string, unknown>;
  if (typeof input.revision !== "string" || !input.revision || input.revision.length > 128) throw new PredictionStoreError("Загрузите список заново перед сохранением.");
  if (!Array.isArray(input.predictions) || input.predictions.length > 100) throw new PredictionStoreError("В списке может быть не более 100 предсказаний.");
  const ids = new Set<string>();
  const predictions = input.predictions.map((value: unknown): Prediction => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new PredictionStoreError("Некорректное предсказание.");
    const item = value as Record<string, unknown>;
    if (typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || ids.has(item.id)) throw new PredictionStoreError("Идентификаторы предсказаний должны быть уникальными.");
    ids.add(item.id);
    if (typeof item.text !== "string" || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(item.text)) throw new PredictionStoreError("Укажите текст предсказания.");
    const text = item.text.replace(/\s+/g, " ").trim();
    if (!text || text.length > 100) throw new PredictionStoreError("Текст предсказания должен содержать от 1 до 100 символов.");
    if (typeof item.published !== "boolean") throw new PredictionStoreError("Некорректный статус публикации предсказания.");
    return { id: item.id, text, published: item.published };
  });
  return { predictions, revision: input.revision };
}

function documentFor(predictions: Prediction[]): PredictionDocument {
  return { predictions, revision: createHash("sha256").update(JSON.stringify(predictions)).digest("hex") };
}

export class PredictionStore {
  readonly directory: string;
  readonly filename: string;
  constructor(directory = process.env.PREDICTIONS_DATA_DIR || path.join(process.cwd(), ".data")) {
    this.directory = path.resolve(/* turbopackIgnore: true */ directory);
    this.filename = path.join(this.directory, "predictions.json");
  }
  async read(): Promise<PredictionDocument> {
    let raw: string;
    try { raw = await readFile(this.filename, "utf8"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return documentFor(validatePredictionDocument({ ...seed, revision: "seed" }).predictions);
      throw new PredictionStoreError("Не удалось прочитать предсказания.", 500);
    }
    try { return documentFor(validatePredictionDocument({ ...JSON.parse(raw), revision: "stored" }).predictions); }
    catch { throw new PredictionStoreError("Файл предсказаний повреждён. Обратитесь к администратору.", 500); }
  }
  async published() { return (await this.read()).predictions.filter((prediction) => prediction.published); }
  async save(value: unknown): Promise<PredictionDocument> {
    const input = validatePredictionDocument(value);
    const previous = queues.get(this.filename) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(async () => {
      const current = await this.read();
      if (current.revision !== input.revision) throw new PredictionStoreError("Предсказания уже изменены в другой вкладке. Загрузите актуальный список.", 409);
      const updated = documentFor(input.predictions);
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      const temporary = path.join(this.directory, `.predictions-${randomUUID()}.tmp`);
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

const store = new PredictionStore();
export const readPredictionDocument = () => store.read();
export const savePredictionDocument = (value: unknown) => store.save(value);
export const getPublishedPredictions = () => store.published();
