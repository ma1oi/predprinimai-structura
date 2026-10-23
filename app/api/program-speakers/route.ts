import { adminJson, requestErrorResponse } from "@/lib/admin-auth";
import { getProgramSpeakers } from "@/lib/program-speaker-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try { return adminJson({ speakers: await getProgramSpeakers() }); }
  catch (error) { return requestErrorResponse(error); }
}
