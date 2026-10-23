import { adminJson, enforceSameOrigin, readJsonBody, requestErrorResponse, requireAdmin } from "@/lib/admin-auth";
import { readProgramSpeakerDocument, saveProgramSpeakerDocument } from "@/lib/program-speaker-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    requireAdmin(request);
    return adminJson(await readProgramSpeakerDocument());
  } catch (error) { return requestErrorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    enforceSameOrigin(request);
    requireAdmin(request);
    return adminJson(await saveProgramSpeakerDocument(await readJsonBody(request)));
  } catch (error) { return requestErrorResponse(error); }
}
