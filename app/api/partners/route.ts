import { adminJson, requestErrorResponse } from "@/lib/admin-auth";
import { getPublishedPartners } from "@/lib/partner-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try { return adminJson({ partners: await getPublishedPartners() }); }
  catch (error) { return requestErrorResponse(error); }
}
