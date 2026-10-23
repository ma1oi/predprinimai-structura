import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { speakerPhotoPattern } from "./speaker-store";
import type { ProgramSpeaker, ProgramSpeakerDocument } from "./program-speaker-types";

const identities = [
  { id: "panfilov", name: "Максим Панфилов" },
  { id: "goncharenko", name: "Максим Гончаренко" },
] as const;
const queues = new Map<string, Promise<unknown>>();

export class ProgramSpeakerStoreError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export function validateProgramSpeakerDocument(value: unknown): ProgramSpeakerDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProgramSpeakerStoreError("Некорректные фотографии программы.");
  const input = value as Record<string, unknown>;
  if (typeof input.revision !== "string" || !input.revision || input.revision.length > 128) throw new ProgramSpeakerStoreError("Обновите фотографии и повторите сохранение.");
  if (!Array.isArray(input.speakers) || input.speakers.length !== 2) throw new ProgramSpeakerStoreError("В программе должны остаться два спикера.");
  const photos = new Map<string, string>();
  for (const value of input.speakers) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProgramSpeakerStoreError("Некорректная фотография спикера.");
    const item = value as Record<string, unknown>;
    if ((item.id !== "panfilov" && item.id !== "goncharenko") || photos.has(item.id)) throw new ProgramSpeakerStoreError("Состав спикеров программы нельзя изменить.");
    if (typeof item.photo !== "string" || (item.photo !== "" && !speakerPhotoPattern.test(item.photo))) throw new ProgramSpeakerStoreError("Загрузите фото через форму.");
    photos.set(item.id, item.photo);
  }
  return { speakers: identities.map((identity) => ({ ...identity, photo: photos.get(identity.id)! })), revision: input.revision };
}

function documentFor(speakers: ProgramSpeaker[]): ProgramSpeakerDocument {
  return { speakers, revision: createHash("sha256").update(JSON.stringify(speakers)).digest("hex") };
}

/** Program photos live independently from speaker cards and registrations. */
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
      content = { speakers: identities.map((identity) => ({ ...identity, photo: "" })) };
    }
    const speakers = validateProgramSpeakerDocument({ ...(content as object), revision: "stored" }).speakers;
    return documentFor(speakers);
  }

  async save(value: unknown): Promise<ProgramSpeakerDocument> {
    const input = validateProgramSpeakerDocument(value);
    const previous = queues.get(this.filename) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(async () => {
      const current = await this.read();
      if (input.revision !== current.revision) throw new ProgramSpeakerStoreError("Фотографии уже изменены в другой вкладке. Загрузите актуальные фотографии перед сохранением.", 409);
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
