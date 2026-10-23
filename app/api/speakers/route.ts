import { adminJson, requestErrorResponse } from "@/lib/admin-auth";
import { getPublishedSpeakers } from "@/lib/speaker-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return adminJson({ speakers: await getPublishedSpeakers() });
  } catch (error) {
    return requestErrorResponse(error);
  }
}
