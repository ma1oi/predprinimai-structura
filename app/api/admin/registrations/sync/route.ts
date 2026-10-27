import { AdminRequestError, adminJson, enforceSameOrigin, requireAdmin, requestErrorResponse } from "@/lib/admin-auth";
import { yandexWikiConfigured, yandexWikiStatus, syncYandexWikiRegistrations } from "@/lib/registration-wiki-sync";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    requireAdmin(request);
    enforceSameOrigin(request);
    if (!yandexWikiConfigured()) throw new AdminRequestError("Вики ещё не подключена. Укажите OAuth-токен, организацию и ID таблицы в настройках сервера.", 503);
    await syncYandexWikiRegistrations();
    const status = yandexWikiStatus();
    return adminJson({ wiki: status, ...(status.error ? { error: status.error } : {}) }, status.error ? 502 : 200);
  } catch (error) {
    return requestErrorResponse(error instanceof AdminRequestError ? error : new Error("Yandex Wiki sync failed"));
  }
}
