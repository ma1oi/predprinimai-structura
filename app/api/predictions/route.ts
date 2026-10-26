import { adminJson, requestErrorResponse } from "@/lib/admin-auth";
import { getPublishedPredictions } from "@/lib/prediction-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try { return adminJson({ predictions: await getPublishedPredictions() }); }
  catch (error) { return requestErrorResponse(error); }
}
