import { AdminRequestError, adminJson, enforceSameOrigin, requireAdmin, requestErrorResponse } from "@/lib/admin-auth";
import { yandexDiskConfigured, yandexDiskStatus, syncYandexRegistrations } from "@/lib/registration-yandex-sync";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    requireAdmin(request);
    enforceSameOrigin(request);
    if (!yandexDiskConfigured()) throw new AdminRequestError("Яндекс Диск ещё не подключён. Добавьте OAuth-токен в настройки сервера.", 503);
    await syncYandexRegistrations();
    const status = yandexDiskStatus();
    return adminJson({ yandexDisk: status, ...(status.error ? { error: status.error } : {}) }, status.error ? 502 : 200);
  } catch (error) {
    return requestErrorResponse(error instanceof AdminRequestError ? error : new Error("Yandex Disk sync failed"));
  }
}
