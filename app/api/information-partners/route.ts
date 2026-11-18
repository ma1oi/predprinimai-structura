import { adminJson, requestErrorResponse } from "@/lib/admin-auth";
import { getPublishedInformationPartners } from "@/lib/information-partner-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try { return adminJson({ partners: await getPublishedInformationPartners() }); }
  catch (error) { return requestErrorResponse(error); }
}
