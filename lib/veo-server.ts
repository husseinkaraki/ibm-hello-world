import "server-only";
import { GoogleAuth } from "google-auth-library";
import { timingSafeEqual } from "node:crypto";
import {
  VEO_MODEL, VeoError, type Readiness, type VertexOperation, type GenerationOptions,
  generationBody, operationState,
} from "./veo-contract";
import { createJobToken, modelPath, readJobToken, validateOperationName } from "./veo-job";

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });

function configuration() {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const location = process.env.GOOGLE_CLOUD_LOCATION?.trim() || "us-central1";
  const secret = process.env.VEO_JOB_SECRET;
  if (!project || project === "your-project-id") {
    throw new VeoError("Set GOOGLE_CLOUD_PROJECT to your billed Google Cloud project ID.", 503);
  }
  if (!/^(?:[a-z][a-z0-9-]{4,61}[a-z0-9]|\d+)$/.test(project)) {
    throw new VeoError("GOOGLE_CLOUD_PROJECT must be a project ID or project number.", 503);
  }
  if (location !== "us-central1") {
    throw new VeoError("Set GOOGLE_CLOUD_LOCATION=us-central1 for this Veo 3.1 integration.", 503);
  }
  if (!secret || secret.length < 32) {
    throw new VeoError("Set VEO_JOB_SECRET to a random value of at least 32 characters, shared by all app instances.", 503);
  }
  if (process.env.NODE_ENV === "production" && !process.env.VEO_DEMO_PASSWORD &&
      process.env.VEO_TRUSTED_PRIVATE_DEPLOYMENT !== "true") {
    throw new VeoError("Set VEO_DEMO_PASSWORD for the hosted demo, or authenticate the deployment and set VEO_TRUSTED_PRIVATE_DEPLOYMENT=true.", 503);
  }
  return { project, location, secret, path: modelPath(project, location, VEO_MODEL) };
}

async function googleHeaders(): Promise<Headers> {
  try {
    // Preserve ADC's x-goog-user-project header as well as its OAuth token.
    return new Headers(await auth.getRequestHeaders());
  } catch {
    throw new VeoError("Google Cloud login is missing or expired. Run gcloud auth application-default login, or configure GOOGLE_APPLICATION_CREDENTIALS on the server.", 503);
  }
}

export async function readiness(): Promise<Readiness> {
  try {
    configuration();
    await googleHeaders(); // Credentials only; never starts a generation or incurs a Veo charge.
    return { ready: true, requiresPassword: Boolean(process.env.VEO_DEMO_PASSWORD), message: "Cloud credentials ready. Model access is checked when you generate." };
  } catch (error) {
    return { ready: false, requiresPassword: Boolean(process.env.VEO_DEMO_PASSWORD), message: error instanceof VeoError ? error.message : "Google Cloud setup is incomplete." };
  }
}

export function requireDemoPassword(request: Request) {
  const expected = process.env.VEO_DEMO_PASSWORD;
  if (!expected) return;
  const actual = Buffer.from(request.headers.get("x-veo-password") || "");
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) {
    throw new VeoError("Enter the demo password to generate a clip.", 401);
  }
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  // Headers remain compatible with Code Engine's TLS-terminating reverse proxy.
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
  const expectedHost = forwardedHost || request.headers.get("host") || new URL(request.url).host;
  if (origin) {
    try {
      if (new URL(origin).host === expectedHost) return;
    } catch { /* Reject malformed origins below. */ }
    throw new VeoError("Submit this scene from the app's own page.", 403);
  }
}

async function vertex(method: "predictLongRunning" | "fetchPredictOperation", body: unknown): Promise<VertexOperation> {
  const config = configuration();
  const headers = await googleHeaders();
  headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`https://${config.location}-aiplatform.googleapis.com/v1/${config.path}:${method}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
      // Deliberately no retries here: retrying submission can create a second paid job.
    });
  } catch {
    throw new VeoError(method === "predictLongRunning"
      ? "The submission connection ended before Google confirmed a job. It may still have been accepted; check Google Cloud before submitting again."
      : "Could not reach Google to check this clip. Your existing generation reference is saved; check again shortly.", 504);
  }
  let result: VertexOperation;
  try {
    result = await response.json() as VertexOperation;
  } catch {
    throw new VeoError("Google returned an unreadable response. Check the existing request before trying again.", 502);
  }
  if (!response.ok) {
    if (response.status === 401) throw new VeoError("Google Cloud credentials were rejected. Refresh the server's Application Default Credentials.", 503);
    if (response.status === 403) throw new VeoError("Google denied this request. Check billing, enable aiplatform.googleapis.com, and grant this identity Vertex AI User in the selected project.", 403);
    if (response.status === 429) throw new VeoError("Google's Veo quota is currently unavailable. Check your project's Veo quota before trying again.", 429);
    if (response.status === 404) throw new VeoError("Google could not find this model or generation. Confirm Veo 3.1 access in us-central1 for your project.", 404);
    const detail = result.error?.message?.slice(0, 500);
    throw new VeoError(detail ? `Google: ${detail}` : `Google returned HTTP ${response.status}.`, response.status >= 500 ? 502 : 422);
  }
  return result;
}

export async function submitScene(prompt: string, image?: { bytes: Uint8Array; mimeType: string }, options: GenerationOptions = {}) {
  const config = configuration();
  const operation = await vertex("predictLongRunning", generationBody(prompt, image, options));
  validateOperationName(operation.name, config.path);
  return createJobToken(operation.name, config.secret);
}

export async function fetchScene(job: string | null): Promise<VertexOperation> {
  const config = configuration();
  const operationName = readJobToken(job, config.secret, config.path);
  const operation = await vertex("fetchPredictOperation", { operationName });
  operationState(operation); // Surface failed/filtered jobs before claiming completion.
  return operation;
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export function errorResponse(error: unknown) {
  if (error instanceof VeoError) return json({ error: error.message }, error.status);
  // Do not expose credential paths, access tokens, uploaded bytes, or stack traces.
  return json({ error: "The scene request failed. Please check the server configuration and try again." }, 500);
}
