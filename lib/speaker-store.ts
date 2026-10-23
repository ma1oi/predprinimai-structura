import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import seed from "../data/speakers.json" with { type: "json" };
import type { Speaker, SpeakerDocument } from "./speaker-types";

export class SpeakerStoreError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const speakerPhotoPattern = /^\/media\/speakers\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/;
const queues = new Map<string, Promise<unknown>>();

function text(value: unknown, label: string, limit: number, required = false) {
  if (typeof value !== "string") throw new SpeakerStoreError(`${label}: ожидается текст.`);
  const result = value.trim();
  if (required && !result) throw new SpeakerStoreError(`${label}: заполните поле.`);
  if (result.length > limit) throw new SpeakerStoreError(`${label}: не более ${limit} символов.`);
  return result;
}

export function validateSpeakerDocument(value: unknown): SpeakerDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SpeakerStoreError("Некорректный список спикеров.");
  const input = value as Record<string, unknown>;
  if (typeof input.revision !== "string" || !input.revision || input.revision.length > 128) throw new SpeakerStoreError("Обновите страницу и повторите сохранение.");
  if (!Array.isArray(input.speakers) || input.speakers.length > 100) throw new SpeakerStoreError("В списке может быть не более 100 спикеров.");
  const ids = new Set<string>();
  const speakers = input.speakers.map((value: unknown, index: number): Speaker => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new SpeakerStoreError(`Спикер ${index + 1}: некорректная запись.`);
    const item = value as Record<string, unknown>;
    const label = `Спикер ${index + 1}`;
    const id = text(item.id, `${label}, идентификатор`, 80, true);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id)) throw new SpeakerStoreError(`${label}: идентификатор должен быть уникальным.`);
    ids.add(id);
    const photo = text(item.photo, `${label}, фото`, 100);
    if (photo && !speakerPhotoPattern.test(photo)) throw new SpeakerStoreError(`${label}: загрузите фото через форму.`);
    if (item.color !== "lime" && item.color !== "lavender" && item.color !== "pink") throw new SpeakerStoreError(`${label}: выберите цвет карточки.`);
    if (item.art !== "blue" && item.art !== "pink") throw new SpeakerStoreError(`${label}: неверный фон карточки.`);
    if (typeof item.published !== "boolean") throw new SpeakerStoreError(`${label}: неверный статус публикации.`);
    return {
      id,
      name: text(item.name, `${label}, имя`, 120, true),
      job: text(item.job, `${label}, должность`, 300),
      topic: text(item.topic, `${label}, тема`, 300),
      time: text(item.time, `${label}, время`, 80),
      photo,
      color: item.color,
      published: item.published,
      art: item.art,
    };
  });
  return { speakers, revision: input.revision };
}

function documentFor(speakers: Speaker[]): SpeakerDocument {
  return { speakers, revision: createHash("sha256").update(JSON.stringify(speakers)).digest("hex") };
}

/** One writable local volume is required; atomic writes are serialized in this Node process. */
export class SpeakerStore {
  readonly directory: string;
  readonly filename: string;

  constructor(directory = path.join(process.cwd(), ".data")) {
    // This writable volume is runtime data; it must not be traced into the build.
    this.directory = path.resolve(/* turbopackIgnore: true */ directory);
    this.filename = path.join(this.directory, "speakers.json");
  }

  async read(): Promise<SpeakerDocument> {
    let content: unknown;
    try {
      content = JSON.parse(await readFile(this.filename, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      content = seed;
    }
    const speakers = validateSpeakerDocument({ ...(content as object), revision: "stored" }).speakers;
    return documentFor(speakers);
  }

  async published(): Promise<Speaker[]> {
    return (await this.read()).speakers.filter((speaker) => speaker.published);
  }

  async save(value: unknown): Promise<SpeakerDocument> {
    const input = validateSpeakerDocument(value);
    const previous = queues.get(this.filename) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(async () => {
      const current = await this.read();
      if (input.revision !== current.revision) throw new SpeakerStoreError("Список уже изменён в другой вкладке. Обновите страницу перед сохранением.", 409);
      const updated = documentFor(input.speakers);
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      const temporary = path.join(this.directory, `.speakers-${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, `${JSON.stringify(updated, null, 2)}\n`, { mode: 0o600, flag: "wx" });
        await rename(temporary, this.filename);
      } finally {
        await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") throw error;
        });
      }
      return updated;
    });
    queues.set(this.filename, operation);
    try {
      return await operation;
    } finally {
      if (queues.get(this.filename) === operation) queues.delete(this.filename);
    }
  }
}

const store = new SpeakerStore();
export const readSpeakerDocument = () => store.read();
export const getPublishedSpeakers = () => store.published();
export const saveSpeakerDocument = (value: unknown) => store.save(value);
