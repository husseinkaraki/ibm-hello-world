import { createHash } from "node:crypto";
import { MAX_IMAGE_BYTES, VeoError, validateImage, validatePrompt, validateVideoSettings, validateFocusWord, type ReferenceImage } from "./veo-contract.ts";
import { composeScenePrompt } from "./scene-prompt.ts";
import { loadLucyReference } from "./cast-reference.ts";

/** Bound the stream too: Content-Length may be absent or incorrect. */
async function readForm(request: Request, imageCount: number): Promise<FormData> {
  const contentType = request.headers.get("content-type");
  if (!contentType?.startsWith("multipart/form-data")) throw new VeoError("Submit scene details and photos as form data.", 415);
  const limit = imageCount * MAX_IMAGE_BYTES + 64 * 1024;
  const tooLarge = () => new VeoError(`Choose photos smaller than 5 MB each (${imageCount} photo${imageCount === 1 ? "" : "s"} maximum).`, 413);
  if (Number(request.headers.get("content-length")) > limit) throw tooLarge();
  if (!request.body) throw new VeoError("The upload could not be read. Choose your photos again.");
  const reader = request.body.getReader();
  let size = 0;
  let exceeded = false;
  const bounded = new ReadableStream({
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) { controller.close(); return; }
      size += value.byteLength;
      if (size > limit) {
        exceeded = true; await reader.cancel(); controller.error(tooLarge()); return;
      }
      controller.enqueue(value);
    },
    cancel(reason) { return reader.cancel(reason); },
  });
  try { return await new Response(bounded, { headers: { "content-type": contentType } }).formData(); }
  catch { if (exceeded) throw tooLarge(); throw new VeoError("The upload could not be read. Choose your photos again."); }
}

async function readImage(data: FormData, field: string, label: string, required: boolean): Promise<ReferenceImage | undefined> {
  const values = data.getAll(field);
  if (values.length > 1) throw new VeoError(`Choose one ${label}.`);
  const file = values[0];
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMAGE_BYTES) throw new VeoError("Choose a photo smaller than 5 MB.", 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    validateImage(bytes, file.type);
    return { bytes, mimeType: file.type };
  }
  if (required) throw new VeoError(`Add ${label} before generating.`);
  if (typeof file === "string") throw new VeoError("Choose a JPEG or PNG photo.");
}

export async function parseGenerationRequest(request: Request, requireCast = false) {
  const data = await readForm(request, requireCast ? 2 : 1);
  const focusWord = validateFocusWord(data.get("focusWord"));
  const options = validateVideoSettings(data);
  let image: ReferenceImage | undefined;
  let referenceImages: ReferenceImage[] | undefined;
  if (requireCast) {
    if (data.has("image")) throw new VeoError("Use the separate learner and recurring-cast photos for this scene.");
    if (!focusWord) throw new VeoError("Choose the scene's focus word.");
    if (options.durationSeconds !== 8 || !options.generateAudio) throw new VeoError("This drama requires an eight-second clip with scene audio.");
    const learner = (await readImage(data, "learnerImage", "your photo", true))!;
    const cast = (await readImage(data, "castImage", "the recurring-cast reference", true))!;
    const castFingerprint = createHash("sha256").update(cast.bytes).digest("hex");
    if (createHash("sha256").update(learner.bytes).digest("hex") === castFingerprint) {
      throw new VeoError("Use separate photos for yourself and the recurring cast.");
    }
    const lucy = await loadLucyReference();
    if (castFingerprint !== lucy.fingerprint) throw new VeoError("Lucy's reference has changed. Refresh the page before generating.", 409);
    referenceImages = [learner, cast];
  } else {
    if (data.has("learnerImage") || data.has("castImage")) throw new VeoError("Use the drama reference workflow to submit both cast photos.");
    image = await readImage(data, "image", "photo", false);
  }
  const prompt = validatePrompt(composeScenePrompt(validatePrompt(data.get("prompt")), focusWord, { ...options, castReferences: requireCast }));
  return { prompt, image, options, referenceImages };
}
