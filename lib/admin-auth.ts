import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const cookieName = "speakers_admin";
const sessionSeconds = 12 * 60 * 60;
const noStoreHeaders = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
const loginWindow = { started: 0, attempts: 0 };

export class AdminRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function isAdminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function hash(value: string) {
  return createHash("sha256").update(value).digest();
}

export function verifyPassword(password: unknown) {
  return typeof password === "string" && password.length <= 1024 && isAdminConfigured()
    && timingSafeEqual(hash(password), hash(process.env.ADMIN_PASSWORD!));
}

function sessionSignature(payload: string) {
  const key = createHmac("sha256", process.env.ADMIN_PASSWORD!).update(process.env.ADMIN_SESSION_SECRET || "speakers-admin-session-v1").digest();
  return createHmac("sha256", key).update(payload).digest("base64url");
}

function cookieAttributes(request: Request) {
  const secure = process.env.NODE_ENV === "production" || new URL(request.url).protocol === "https:";
  return `Path=/api/admin; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}

export function createSessionCookie(request: Request) {
  if (!isAdminConfigured()) throw new AdminRequestError("Задайте ADMIN_PASSWORD на сервере.", 503);
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + sessionSeconds, nonce: randomBytes(16).toString("hex") })).toString("base64url");
  return `${cookieName}=${payload}.${sessionSignature(payload)}; Max-Age=${sessionSeconds}; ${cookieAttributes(request)}`;
}

export function clearSessionCookie(request: Request) {
  return `${cookieName}=; Max-Age=0; ${cookieAttributes(request)}`;
}

export function authenticateRequest(request: Request) {
  if (!isAdminConfigured()) return false;
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  const token = cookie?.slice(cookieName.length + 1);
  if (!token || token.length > 512 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return false;
  const [payload, signature] = token.split(".");
  const expected = sessionSignature(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    return typeof exp === "number" && Number.isSafeInteger(exp) && exp > now && exp <= now + sessionSeconds;
  } catch {
    return false;
  }
}

export function requireAdmin(request: Request) {
  if (!isAdminConfigured()) throw new AdminRequestError("Задайте ADMIN_PASSWORD на сервере.", 503);
  if (!authenticateRequest(request)) throw new AdminRequestError("Войдите в панель управления.", 401);
}

export function enforceSameOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.host;
  if (request.headers.get("origin") !== `${url.protocol}//${host}` || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new AdminRequestError("Запрос отклонён. Откройте панель на этом сайте.", 403);
  }
}

export function checkLoginRateLimit() {
  const now = Date.now();
  if (now - loginWindow.started >= 60_000) {
    loginWindow.started = now;
    loginWindow.attempts = 0;
  }
  if (++loginWindow.attempts > 10) throw new AdminRequestError("Слишком много попыток. Подождите минуту.", 429);
}

export async function readRequestBody(request: Request, limit: number) {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) throw new AdminRequestError("Файл или запрос слишком большой.", 413);
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new AdminRequestError("Файл или запрос слишком большой.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer;
}

export async function readJsonBody(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new AdminRequestError("Ожидается JSON.", 415);
  const buffer = await readRequestBody(request, 256 * 1024);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
  } catch {
    throw new AdminRequestError("Некорректный JSON.", 400);
  }
}

export function adminJson(value: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(value, { status, headers: { ...noStoreHeaders, ...headers } });
}

export function requestErrorResponse(error: unknown) {
  if (error instanceof Error && "status" in error && typeof error.status === "number") return adminJson({ error: error.message }, error.status);
  console.error("Speaker administration request failed:", error instanceof Error ? error.message : "Unknown error");
  return adminJson({ error: "Не удалось выполнить запрос. Повторите попытку." }, 500);
}
