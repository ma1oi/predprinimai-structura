import { readFile } from "node:fs/promises";
import path from "node:path";
import { speakerPhotoPattern } from "@/lib/speaker-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  if (!speakerPhotoPattern.test(`/media/speakers/${filename}`)) return new Response(null, { status: 404 });
  try {
    const content = await readFile(path.join(process.cwd(), ".data", "uploads", filename));
    return new Response(content, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch (error) {
    const status = (error as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 500;
    return new Response(null, { status, headers: { "Cache-Control": "no-store" } });
  }
}
