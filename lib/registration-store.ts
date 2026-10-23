import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Registration, RegistrationInput } from "./registration-types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const queues = new Map<string, Promise<unknown>>();
const maximumRegistrations = 20_000;

export class RegistrationStoreError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function cleanText(value: unknown, label: string, minimum: number, maximum: number) {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value)) throw new RegistrationStoreError(`${label}: некорректное значение.`);
  const result = value.trim();
  if (result.length < minimum || result.length > maximum) throw new RegistrationStoreError(`${label}: от ${minimum} до ${maximum} символов.`);
  return result;
}

function normalizePhone(value: unknown) {
  if (typeof value !== "string" || value.length > 80 || !/^\+?[\d ()-]+$/.test(value.trim())) {
    throw new RegistrationStoreError("Укажите корректный номер телефона.");
  }
  let digits = value.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) throw new RegistrationStoreError("В номере телефона должно быть от 10 до 15 цифр.");
  if (digits.length === 10) digits = `7${digits}`;
  else if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  return `+${digits}`;
}

export function validateRegistrationInput(value: unknown): RegistrationInput & { consent: true } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RegistrationStoreError("Некорректная заявка.");
  const input = value as Record<string, unknown>;
  if (typeof input.requestId !== "string" || !uuidPattern.test(input.requestId)) throw new RegistrationStoreError("Обновите страницу и повторите отправку заявки.");
  if (input.consent !== true) throw new RegistrationStoreError("Необходимо согласие на обработку персональных данных.");
  return {
    requestId: input.requestId.toLowerCase(),
    name: cleanText(input.name, "Имя", 2, 120),
    phone: normalizePhone(input.phone),
    company: cleanText(input.company, "Компания", 0, 200),
    consent: true,
  };
}

function sameSubmission(record: Registration, input: RegistrationInput) {
  return record.name === input.name && record.phone === input.phone && record.company === input.company && record.consent === input.consent;
}

/** A single Node process and writable persistent volume are required. */
export class RegistrationStore {
  readonly directory: string;
  readonly filename: string;

  constructor(directory = process.env.REGISTRATIONS_DATA_DIR || path.join(process.cwd(), ".data")) {
    this.directory = path.resolve(/* turbopackIgnore: true */ directory);
    this.filename = path.join(this.directory, "registrations.json");
  }

  async read(): Promise<Registration[]> {
    let raw: string;
    try {
      raw = await readFile(this.filename, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw new RegistrationStoreError("Не удалось прочитать заявки.", 500);
    }
    try {
      const document: unknown = JSON.parse(raw);
      if (!document || typeof document !== "object" || !("registrations" in document) || !Array.isArray(document.registrations) || document.registrations.length > maximumRegistrations) throw new Error();
      const ids = new Set<string>();
      const requestIds = new Set<string>();
      const phones = new Set<string>();
      const registrations = document.registrations.map((value: unknown): Registration => {
        const input = validateRegistrationInput(value);
        const record = value as Record<string, unknown>;
        if (typeof record.id !== "string" || !uuidPattern.test(record.id) || typeof record.createdAt !== "string" || !Number.isFinite(Date.parse(record.createdAt)) || new Date(record.createdAt).toISOString() !== record.createdAt) throw new Error();
        if (ids.has(record.id) || requestIds.has(input.requestId) || phones.has(input.phone)) throw new Error();
        ids.add(record.id);
        requestIds.add(input.requestId);
        phones.add(input.phone);
        return { ...input, id: record.id, createdAt: record.createdAt };
      });
      return registrations.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch {
      // Never include file contents or JSON parser snippets in logs or responses.
      throw new RegistrationStoreError("Файл заявок повреждён. Обратитесь к администратору.", 500);
    }
  }

  async add(value: unknown): Promise<{ registration: Registration; duplicate: boolean }> {
    const input = validateRegistrationInput(value);
    const previous = queues.get(this.filename) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(async () => {
      const records = await this.read();
      const retry = records.find((record) => record.requestId === input.requestId);
      if (retry) {
        if (!sameSubmission(retry, input)) throw new RegistrationStoreError("Эта заявка уже отправлена. Обновите страницу для новой заявки.", 409);
        return { registration: retry, duplicate: true };
      }
      const duplicate = records.find((record) => record.phone === input.phone);
      if (duplicate) return { registration: duplicate, duplicate: true };
      if (records.length >= maximumRegistrations) throw new RegistrationStoreError("Приём заявок временно приостановлен.", 503);
      const registration: Registration = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
      const temporary = path.join(this.directory, `.registrations-${randomUUID()}.tmp`);
      try {
        await mkdir(this.directory, { recursive: true, mode: 0o700 });
        await writeFile(temporary, `${JSON.stringify({ registrations: [registration, ...records] }, null, 2)}\n`, { mode: 0o600, flag: "wx" });
        await rename(temporary, this.filename);
      } catch {
        throw new RegistrationStoreError("Не удалось сохранить заявку. Повторите попытку.", 500);
      } finally {
        await unlink(temporary).catch(() => undefined);
      }
      return { registration, duplicate: false };
    });
    queues.set(this.filename, operation);
    try {
      return await operation;
    } finally {
      if (queues.get(this.filename) === operation) queues.delete(this.filename);
    }
  }
}

const store = new RegistrationStore();
export const readRegistrations = () => store.read();
export const addRegistration = (value: unknown) => store.add(value);
