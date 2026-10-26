import { adminJson, enforceSameOrigin, readJsonBody, requireAdmin, requestErrorResponse } from "@/lib/admin-auth";
import { readPredictionDocument, savePredictionDocument } from "@/lib/prediction-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try { requireAdmin(request); return adminJson(await readPredictionDocument()); }
  catch (error) { return requestErrorResponse(error); }
}
export async function PUT(request: Request) {
  try {
    enforceSameOrigin(request);
    requireAdmin(request);
    return adminJson(await savePredictionDocument(await readJsonBody(request)));
  } catch (error) { return requestErrorResponse(error); }
}
