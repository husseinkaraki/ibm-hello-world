import { parseGenerationRequest } from "../../../lib/veo-request";
import { errorResponse, json, readiness, requireSameOrigin, submitScene } from "../../../lib/veo-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() { return json(await readiness()); }

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const { prompt, image, options } = await parseGenerationRequest(request);
    const job = await submitScene(prompt, image, options);
    return json({ state: "pending", job, retryAfterSeconds: 10 }, 202);
  } catch (error) { return errorResponse(error); }
}
