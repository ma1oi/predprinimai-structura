import { adminJson, enforceSameOrigin, readJsonBody, requireAdmin, requestErrorResponse } from "@/lib/admin-auth";
import { readInformationPartnerDocument, saveInformationPartnerDocument } from "@/lib/information-partner-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try { requireAdmin(request); return adminJson(await readInformationPartnerDocument()); }
  catch (error) { return requestErrorResponse(error); }
}
export async function PUT(request: Request) {
  try {
    enforceSameOrigin(request);
    requireAdmin(request);
    return adminJson(await saveInformationPartnerDocument(await readJsonBody(request, 512 * 1024)));
  } catch (error) { return requestErrorResponse(error); }
}
