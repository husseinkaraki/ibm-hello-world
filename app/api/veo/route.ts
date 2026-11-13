import { MAX_IMAGE_BYTES, VeoError, validateImage, validatePrompt } from "../../../lib/veo-contract";
import { errorResponse, json, readiness, requireDemoPassword, requireSameOrigin, submitScene } from "../../../lib/veo-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  return json(await readiness());
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    requireDemoPassword(request);
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      throw new VeoError("Submit a scene prompt and optional photo as form data.", 415);
    }
    if (Number(request.headers.get("content-length")) > MAX_IMAGE_BYTES + 64 * 1024) {
      throw new VeoError("Choose a photo smaller than 5 MB.", 413);
    }
    let data: FormData;
    try { data = await request.formData(); }
    catch { throw new VeoError("The upload could not be read. Choose your photo again."); }
    const prompt = validatePrompt(data.get("prompt"));
    const file = data.get("image");
    let image: { bytes: Uint8Array; mimeType: string } | undefined;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_IMAGE_BYTES) throw new VeoError("Choose a photo smaller than 5 MB.", 413);
      const bytes = new Uint8Array(await file.arrayBuffer());
      validateImage(bytes, file.type);
      image = { bytes, mimeType: file.type };
    } else if (typeof file === "string") {
      throw new VeoError("Choose a JPEG or PNG photo.");
    }
    const job = await submitScene(prompt, image);
    return json({ state: "pending", job, retryAfterSeconds: 10 }, 202);
  } catch (error) {
    return errorResponse(error);
  }
}
