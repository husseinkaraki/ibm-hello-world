import { operationState } from "../../../../lib/veo-contract";
import { errorResponse, fetchScene, json } from "../../../../lib/veo-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const job = new URL(request.url).searchParams.get("job");
    const operation = await fetchScene(job);
    if (operationState(operation) === "pending") {
      return json({ state: "pending", retryAfterSeconds: 10 });
    }
    return json({ state: "complete", videoUrl: `/api/veo/video?job=${encodeURIComponent(job!)}` });
  } catch (error) {
    return errorResponse(error);
  }
}
