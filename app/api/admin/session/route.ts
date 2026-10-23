import {
  AdminRequestError, adminJson, authenticateRequest, checkLoginRateLimit,
  clearSessionCookie, createSessionCookie, enforceSameOrigin, isAdminConfigured,
  readJsonBody, requestErrorResponse, verifyPassword,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return adminJson({ authenticated: authenticateRequest(request), configured: isAdminConfigured() });
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    if (!isAdminConfigured()) throw new AdminRequestError("Задайте ADMIN_PASSWORD на сервере.", 503);
    checkLoginRateLimit();
    const body = await readJsonBody(request);
    if (!verifyPassword(body?.password)) throw new AdminRequestError("Неверный пароль.", 401);
    return adminJson({ authenticated: true }, 200, { "Set-Cookie": createSessionCookie(request) });
  } catch (error) {
    return requestErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    enforceSameOrigin(request);
    return adminJson({ authenticated: false }, 200, { "Set-Cookie": clearSessionCookie(request) });
  } catch (error) {
    return requestErrorResponse(error);
  }
}
