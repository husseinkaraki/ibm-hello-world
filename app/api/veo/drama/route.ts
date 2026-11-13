import { parseGenerationRequest } from "../../../../lib/veo-request";
import { requireSameOrigin, submitScene, json, errorResponse } from "../../../../lib/veo-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Strict product entry point; the existing submission/status/video service is shared. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { prompt, options, referenceImages } = await parseGenerationRequest(request, true);
    const job = await submitScene(prompt, undefined, options, referenceImages);
    return json({ state: "pending", job, retryAfterSeconds: 10 }, 202);
  } catch (error) { return errorResponse(error); }
}
