import { AdminRequestError, adminJson, requireAdmin, requestErrorResponse } from "@/lib/admin-auth";
import { readRegistrations, RegistrationStoreError } from "@/lib/registration-store";
import { yandexDiskStatus } from "@/lib/registration-yandex-sync";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    requireAdmin(request);
    return adminJson({ registrations: await readRegistrations(), yandexDisk: yandexDiskStatus() });
  } catch (error) {
    return requestErrorResponse(error instanceof AdminRequestError || error instanceof RegistrationStoreError ? error : new Error("Registration listing failed"));
  }
}
