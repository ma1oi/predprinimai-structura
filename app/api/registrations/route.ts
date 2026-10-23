import { AdminRequestError, adminJson, enforceSameOrigin, readRequestBody, requestErrorResponse } from "@/lib/admin-auth";
import { addRegistration, RegistrationStoreError } from "@/lib/registration-store";

export const runtime = "nodejs";
const submissionWindow = { started: 0, attempts: 0 };

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const now = Date.now();
    if (now - submissionWindow.started >= 60_000) {
      submissionWindow.started = now;
      submissionWindow.attempts = 0;
    }
    if (++submissionWindow.attempts > 120) throw new AdminRequestError("Слишком много заявок. Попробуйте через минуту.", 429);
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new AdminRequestError("Ожидается JSON.", 415);
    const bytes = await readRequestBody(request, 8 * 1024);
    let input: unknown;
    try {
      input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      throw new AdminRequestError("Некорректный JSON.", 400);
    }
    const result = await addRegistration(input);
    return adminJson({ success: true, duplicate: result.duplicate }, result.duplicate ? 200 : 201);
  } catch (error) {
    return requestErrorResponse(error instanceof AdminRequestError || error instanceof RegistrationStoreError ? error : new Error("Registration submission failed"));
  }
}
