import { AdminRequestError, requireAdmin, requestErrorResponse } from "@/lib/admin-auth";
import { buildRegistrationWorkbook, registrationExportFilename } from "@/lib/registration-export";
import { readRegistrations, RegistrationStoreError } from "@/lib/registration-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    requireAdmin(request);
    const workbook = await buildRegistrationWorkbook(await readRegistrations());
    return new Response(new Uint8Array(workbook), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${registrationExportFilename()}"`,
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return requestErrorResponse(error instanceof AdminRequestError || error instanceof RegistrationStoreError ? error : new Error("Registration export failed"));
  }
}
