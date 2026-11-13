/** Shared, non-secret configuration. The browser never imports Google auth code. */
export const VEO_MODEL = "veo-3.1-fast-generate-001";
export const CLIP_SECONDS = 4;
export type ClipSeconds = 4 | 6 | 8;
export type AspectRatio = "16:9" | "9:16";
export type Resolution = "720p" | "1080p";
export type GenerationOptions = { durationSeconds?: ClipSeconds; aspectRatio?: AspectRatio; resolution?: Resolution; generateAudio?: boolean };
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PROMPT_LENGTH = 4000;
export type ReferenceImage = { bytes: Uint8Array; mimeType: string };

export type Readiness = {
  ready: boolean;
  /** Kept for older clients; the demo access gate has been removed. */
  requiresPassword: false;
  message: string;
};

export type JobStatus =
  | { state: "pending"; retryAfterSeconds: number }
  | { state: "complete"; videoUrl: string }
  | { state: "error"; error: string };

export class VeoError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "VeoError";
    this.status = status;
  }
}

export function validateDuration(value: FormDataEntryValue | null): ClipSeconds {
  if (value === null) return CLIP_SECONDS;
  if (value === "4" || value === "6" || value === "8") return Number(value) as ClipSeconds;
  throw new VeoError("Choose a supported clip length: 4, 6, or 8 seconds.");
}

export function validateAspectRatio(value: FormDataEntryValue | null): AspectRatio {
  if (value === null) return "16:9";
  if (value === "16:9" || value === "9:16") return value;
  throw new VeoError("Choose a supported video format: 16:9 or 9:16.");
}

export function validateResolution(value: FormDataEntryValue | null): Resolution {
  if (value === null) return "720p";
  if (value === "720p" || value === "1080p") return value;
  throw new VeoError("Choose a supported resolution: 720p or 1080p.");
}

export function validateAudio(value: FormDataEntryValue | null): boolean {
  if (value === null || value === "false") return false;
  if (value === "true") return true;
  throw new VeoError("Audio generation must be true or false.");
}

export function validateFocusWord(value: FormDataEntryValue | null): string | undefined {
  if (value === null) return undefined;
  if (typeof value === "string" && /^[\p{L}][\p{L}\p{M}'’-]{0,39}$/u.test(value)) return value;
  throw new VeoError("Use one focus word of up to 40 letters, with no spaces.");
}

export function validateVideoSettings(data: FormData): Required<GenerationOptions> {
  const durationSeconds = validateDuration(data.get("durationSeconds"));
  const resolution = validateResolution(data.get("resolution"));
  return { durationSeconds, resolution, aspectRatio: validateAspectRatio(data.get("aspectRatio")), generateAudio: validateAudio(data.get("generateAudio")) };
}

export function validatePrompt(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || value.trim().length < 10) {
    throw new VeoError("Describe your scene in at least 10 characters.");
  }
  const prompt = value.trim();
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new VeoError(`Keep your scene under ${MAX_PROMPT_LENGTH} characters.`);
  }
  return prompt;
}

export function validateImage(bytes: Uint8Array, mimeType: string): void {
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new VeoError("Choose a photo smaller than 5 MB.", 413);
  }
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b);
  if (!((mimeType === "image/jpeg" && jpeg) || (mimeType === "image/png" && png))) {
    throw new VeoError("Choose a JPEG or PNG photo.");
  }
}

export type VertexOperation = {
  name?: string;
  done?: boolean;
  error?: { code?: number; message?: string };
  response?: {
    videos?: { bytesBase64Encoded?: string; mimeType?: string; gcsUri?: string }[];
    raiMediaFilteredCount?: number;
    raiMediaFilteredReasons?: string[];
  };
};

/** REST response fields differ from the Gen AI SDK's generatedVideos/videoBytes. */
export function operationState(operation: VertexOperation): "pending" | "complete" {
  if (operation.error) {
    throw new VeoError(
      `Google could not generate this scene: ${operation.error.message?.slice(0, 500) || "generation failed"}`,
      422,
    );
  }
  if (!operation.done) return "pending";
  if (operation.response?.videos?.[0]?.bytesBase64Encoded) return "complete";
  if (operation.response?.raiMediaFilteredCount) {
    throw new VeoError("Google's safety filters did not return a video. Try a different scene or photo.", 422);
  }
  throw new VeoError("Google finished this request without a playable video. Try a different scene.", 422);
}

export function generationBody(prompt: string, image?: ReferenceImage, options: GenerationOptions = {}, referenceImages?: ReferenceImage[]) {
  if (referenceImages && (image || referenceImages.length !== 2 || options.durationSeconds !== 8)) {
    throw new VeoError("Cast-reference generation requires two asset images, no starting frame, and an eight-second clip.");
  }
  return {
    instances: [{
      prompt,
      ...(image ? { image: {
        bytesBase64Encoded: Buffer.from(image.bytes).toString("base64"),
        mimeType: image.mimeType,
      } } : {}),
      ...(referenceImages ? { referenceImages: referenceImages.map(reference => ({
        image: { bytesBase64Encoded: Buffer.from(reference.bytes).toString("base64"), mimeType: reference.mimeType },
        referenceType: "asset",
      })) } : {}),
    }],
    parameters: {
      sampleCount: 1,
      durationSeconds: options.durationSeconds ?? CLIP_SECONDS,
      aspectRatio: options.aspectRatio ?? "16:9",
      resolution: options.resolution ?? "720p",
      generateAudio: options.generateAudio ?? false,
      personGeneration: "allow_adult",
      // No storageUri: Vertex returns video bytes, so this demo needs no GCS bucket.
    },
  };
}
