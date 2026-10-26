import { adminJson, enforceSameOrigin, readJsonBody, requireAdmin, requestErrorResponse } from "@/lib/admin-auth";
import { readPartnerDocument, savePartnerDocument } from "@/lib/partner-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try { requireAdmin(request); return adminJson(await readPartnerDocument()); }
  catch (error) { return requestErrorResponse(error); }
}
export async function PUT(request: Request) {
  try {
    enforceSameOrigin(request);
    requireAdmin(request);
    return adminJson(await savePartnerDocument(await readJsonBody(request)));
  } catch (error) { return requestErrorResponse(error); }
}
