import { AdminRequestError, adminJson, requireAdmin, requestErrorResponse } from "@/lib/admin-auth";
import { readRegistrations, RegistrationStoreError } from "@/lib/registration-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    requireAdmin(request);
    return adminJson({ registrations: await readRegistrations() });
  } catch (error) {
    return requestErrorResponse(error instanceof AdminRequestError || error instanceof RegistrationStoreError ? error : new Error("Registration listing failed"));
  }
}
