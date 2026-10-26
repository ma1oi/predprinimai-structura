import { AdminRequestError, adminJson, enforceSameOrigin, requireAdmin, requestErrorResponse } from "@/lib/admin-auth";
import { googleSheetsConfigured, googleSheetsStatus, syncGoogleRegistrations } from "@/lib/registration-google-sync";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    requireAdmin(request);
    enforceSameOrigin(request);
    if (!googleSheetsConfigured()) throw new AdminRequestError("Google Таблица ещё не подключена. Укажите ID таблицы и JSON-ключ сервисного аккаунта на сервере.", 503);
    await syncGoogleRegistrations();
    const status = googleSheetsStatus();
    return adminJson({ googleSheets: status, ...(status.error ? { error: status.error } : {}) }, status.error ? 502 : 200);
  } catch (error) {
    return requestErrorResponse(error instanceof AdminRequestError ? error : new Error("Google Sheets sync failed"));
  }
}
