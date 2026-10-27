import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { programAgenda } from "./program-agenda";
import { speakerPhotoPattern } from "./speaker-store";
import type { ProgramSpeaker, ProgramSpeakerDocument } from "./program-speaker-types";

function defaults(): ProgramSpeaker[] {
  return programAgenda.map(({ id, title, time, description = "" }) => ({ id, title, time: time.replace(/[–—-]/g, "–"), description, name: "Имя", job: "Должность", photo: "", ...(
    id === "panfilov" ? { name: "Максим Панфилов", job: "Предприниматель, основатель panfilov.digital и panfilov.consulting" }
    : id === "goncharenko" ? { name: "Максим Гончаренко", job: "Предприниматель, маркетолог, аналитик. За 17 лет с нуля запустил 40+ проектов" } : {}
  ) }));
}
const queues = new Map<string, Promise<unknown>>();

export class ProgramSpeakerStoreError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export function validateProgramSpeakerDocument(value: unknown): ProgramSpeakerDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProgramSpeakerStoreError("Некорректные данные спикеров программы.");
  const input = value as Record<string, unknown>;
  if (typeof input.revision !== "string" || !input.revision || input.revision.length > 128) throw new ProgramSpeakerStoreError("Обновите программу и повторите сохранение.");
  if (!Array.isArray(input.speakers) || input.speakers.length > 100) throw new ProgramSpeakerStoreError("В программе может быть не более 100 пунктов.");
  const speakers = new Map<string, ProgramSpeaker>();
  for (const value of input.speakers) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProgramSpeakerStoreError("Некорректные данные спикера.");
    const item = value as Record<string, unknown>;
    if (typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || speakers.has(item.id)) throw new ProgramSpeakerStoreError("Пункты программы должны иметь уникальные идентификаторы.");
    const title = text(item.title, "Название пункта", 300, true);
    if (!title) throw new ProgramSpeakerStoreError("Укажите название каждого пункта программы.");
    const time = text(item.time, "Время", 30).replace(/\s/g, "").replace(/[—-]/g, "–");
    const match = time.match(/^([01]\d|2[0-3]):([0-5]\d)–([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match || Number(match[1]) * 60 + Number(match[2]) >= Number(match[3]) * 60 + Number(match[4])) throw new ProgramSpeakerStoreError("Укажите время начала и окончания: например, 12:00–13:00. Окончание должно быть позже начала.");
    const description = text(item.description, "Описание пункта", 2000, true);
    const name = text(item.name, "Имя спикера", 120);
    const job = text(item.job, "Описание спикера", 300, true);
    if (typeof item.photo !== "string" || (item.photo !== "" && !speakerPhotoPattern.test(item.photo))) throw new ProgramSpeakerStoreError("Загрузите фото через форму.");
    if (!name && (job || item.photo)) throw new ProgramSpeakerStoreError("Укажите имя спикера или очистите его описание и фото.");
    speakers.set(item.id, { id: item.id, title, time, description, name, job, photo: item.photo });
  }
  return { speakers: [...speakers.values()], revision: input.revision };
}

function text(value: unknown, label: string, max: number, multiline = false): string {
  if (typeof value !== "string" || value.trim().length > max || (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(value)) throw new ProgramSpeakerStoreError(`${label}: укажите текст до ${max} символов.`);
  return value.trim();
}

function migrateLegacy(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const old = (value as Record<string, unknown>).speakers;
  if (!Array.isArray(old)) return value;
  if (old.length === programAgenda.length && old.every((item) => item && typeof item === "object" && !Object.hasOwn(item, "title") && !Object.hasOwn(item, "time") && !Object.hasOwn(item, "description")) && new Set(old.map((item) => item.id)).size === programAgenda.length && old.every((item) => programAgenda.some((event) => event.id === item.id))) {
    return { speakers: defaults().map((event) => ({ ...event, ...old.find((item) => item.id === event.id) })) };
  }
  if (old.length !== 2) return value;
  const legacy = old as Record<string, unknown>[];
  if (!legacy.every((item) => item && typeof item === "object" && !Object.hasOwn(item, "job") && (item.id === "panfilov" || item.id === "goncharenko")) || new Set(legacy.map((item) => item.id)).size !== 2) return value;
  return { speakers: defaults().map((speaker) => {
    const previous = legacy.find((item) => item.id === speaker.id);
    return previous ? { ...speaker, photo: previous.photo } : speaker;
  }) };
}

function documentFor(speakers: ProgramSpeaker[]): ProgramSpeakerDocument {
  return { speakers, revision: createHash("sha256").update(JSON.stringify(speakers)).digest("hex") };
}

/** Per-event speakers live independently from carousel cards and registrations. */
export class ProgramSpeakerStore {
  readonly directory: string;
  readonly filename: string;

  constructor(directory = process.env.PROGRAM_SPEAKERS_DATA_DIR || path.join(process.cwd(), ".data")) {
    this.directory = path.resolve(/* turbopackIgnore: true */ directory);
    this.filename = path.join(this.directory, "program-speakers.json");
  }

  async read(): Promise<ProgramSpeakerDocument> {
    let content: unknown;
    try {
      content = JSON.parse(await readFile(this.filename, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      content = { speakers: defaults() };
    }
    const speakers = validateProgramSpeakerDocument({ ...(migrateLegacy(content) as object), revision: "stored" }).speakers;
    return documentFor(speakers);
  }

  async save(value: unknown): Promise<ProgramSpeakerDocument> {
    const input = validateProgramSpeakerDocument(value);
    const previous = queues.get(this.filename) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(async () => {
      const current = await this.read();
      if (input.revision !== current.revision) throw new ProgramSpeakerStoreError("Программа уже изменена в другой вкладке. Загрузите актуальные данные перед сохранением.", 409);
      const document = documentFor(input.speakers);
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      const temporary = path.join(this.directory, `.program-speakers-${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, { flag: "wx", mode: 0o600 });
        await rename(temporary, this.filename);
      } finally {
        await unlink(temporary).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
      }
      return document;
    });
    queues.set(this.filename, operation);
    try { return await operation; }
    finally { if (queues.get(this.filename) === operation) queues.delete(this.filename); }
  }
}

const store = new ProgramSpeakerStore();
export const readProgramSpeakerDocument = () => store.read();
export const saveProgramSpeakerDocument = (value: unknown) => store.save(value);
export const getProgramSpeakers = async (): Promise<ProgramSpeaker[]> => (await store.read()).speakers;
