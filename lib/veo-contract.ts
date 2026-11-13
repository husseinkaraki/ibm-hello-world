/** Shared, non-secret configuration. The browser never imports Google auth code. */
export const VEO_MODEL = "veo-3.1-fast-generate-001";
export const CLIP_SECONDS = 4;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PROMPT_LENGTH = 2000;

export type Readiness = {
  ready: boolean;
  requiresPassword: boolean;
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

export function generationBody(prompt: string, image?: { bytes: Uint8Array; mimeType: string }) {
  return {
    instances: [{
      prompt,
      ...(image ? { image: {
        bytesBase64Encoded: Buffer.from(image.bytes).toString("base64"),
        mimeType: image.mimeType,
      } } : {}),
    }],
    parameters: {
      sampleCount: 1,
      durationSeconds: CLIP_SECONDS,
      aspectRatio: "16:9",
      resolution: "720p",
      generateAudio: false,
      personGeneration: "allow_adult",
      // No storageUri: Vertex returns video bytes, so this demo needs no GCS bucket.
    },
  };
}
