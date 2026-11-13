import { VeoError, operationState } from "../../../../lib/veo-contract";
import { videoResponse } from "../../../../lib/veo-job";
import { errorResponse, fetchScene } from "../../../../lib/veo-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const operation = await fetchScene(new URL(request.url).searchParams.get("job"));
    if (operationState(operation) !== "complete") throw new VeoError("This clip is still generating.", 409);
    const bytes = Buffer.from(operation.response!.videos![0].bytesBase64Encoded!, "base64");
    return videoResponse(bytes, request.headers.get("range"));
  } catch (error) {
    return errorResponse(error);
  }
}
