import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { AdminRequestError, adminJson, enforceSameOrigin, readRequestBody, requestErrorResponse, requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const maxFileBytes = 8 * 1024 * 1024;
const supported = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function sniffImage(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buffer.toString("ascii", 4, 8) === "ftyp") {
    for (let index = 8; index + 4 <= Math.min(buffer.length, 64); index += 4) {
      if (["avif", "avis"].includes(buffer.toString("ascii", index, index + 4))) return "image/avif";
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    requireAdmin(request);
    const contentType = request.headers.get("content-type");
    if (!contentType?.toLowerCase().startsWith("multipart/form-data;")) throw new AdminRequestError("Загрузите фото через форму.", 415);
    const body = await readRequestBody(request, maxFileBytes + 256 * 1024);
    let form: FormData;
    try {
      form = await new Request(request.url, { method: "POST", headers: { "content-type": contentType }, body }).formData();
    } catch {
      throw new AdminRequestError("Не удалось прочитать загруженный файл.", 400);
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new AdminRequestError("Выберите фото.", 400);
    if (file.size > maxFileBytes) throw new AdminRequestError("Фото должно быть не больше 8 МБ.", 413);
    if (!supported.has(file.type)) throw new AdminRequestError("Поддерживаются JPEG, PNG, WebP и AVIF.", 415);
    const buffer = Buffer.from(await file.arrayBuffer());
    const detectedType = sniffImage(buffer);
    if (!detectedType || detectedType !== file.type) throw new AdminRequestError("Файл не соответствует формату изображения.", 415);
    let output: Buffer;
    try {
      const image = sharp(buffer, { limitInputPixels: 25_000_000, failOn: "warning" });
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height || metadata.width * metadata.height > 25_000_000 || (metadata.pages ?? 1) > 1) {
        throw new Error("Image dimensions or frame count exceed limits");
      }
      output = await image.rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    } catch {
      throw new AdminRequestError("Не удалось открыть фото. Используйте обычное изображение до 25 мегапикселей.", 400);
    }
    const filename = `${randomUUID()}.webp`;
    const directory = path.join(process.cwd(), ".data", "uploads");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await writeFile(path.join(directory, filename), output, { flag: "wx", mode: 0o600 });
    return adminJson({ url: `/media/speakers/${filename}` });
  } catch (error) {
    return requestErrorResponse(error);
  }
}
