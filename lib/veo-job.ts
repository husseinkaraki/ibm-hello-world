import { createHmac, timingSafeEqual } from "node:crypto";
import { VeoError } from "./veo-contract.ts";

const JOB_LIFETIME_MS = 24 * 60 * 60 * 1000;

export function modelPath(project: string, location: string, model: string) {
  return `projects/${project}/locations/${location}/publishers/google/models/${model}`;
}

export function validateOperationName(operation: unknown, prefix: string): asserts operation is string {
  if (typeof operation !== "string" || !operation.startsWith(`${prefix}/operations/`) ||
      !/^[a-zA-Z0-9_-]+$/.test(operation.slice(`${prefix}/operations/`.length))) {
    throw new VeoError("Invalid generation reference.", 400);
  }
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest();
}

export function createJobToken(operation: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ operation, expiresAt: now + JOB_LIFETIME_MS })).toString("base64url");
  return `${payload}.${sign(payload, secret).toString("base64url")}`;
}

export function readJobToken(token: string | null, secret: string, prefix: string, now = Date.now()): string {
  if (!token || token.length > 2048) throw new VeoError("Missing or invalid generation reference.");
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) throw new VeoError("Invalid generation reference.");
  const actual = Buffer.from(signature, "base64url");
  const expected = sign(payload, secret);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new VeoError("Invalid generation reference.");
  }
  let parsed: { operation?: unknown; expiresAt?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new VeoError("Invalid generation reference.");
  }
  if (!parsed || typeof parsed.expiresAt !== "number" || parsed.expiresAt <= now) {
    throw new VeoError("This generation link has expired. Create a new clip.", 410);
  }
  validateOperationName(parsed.operation, prefix);
  return parsed.operation;
}

/** Range support lets the native video player seek without writing files to disk. */
export function videoResponse(bytes: Uint8Array, range: string | null): Response {
  const headers = new Headers({
    "Content-Type": "video/mp4",
    "Content-Disposition": 'inline; filename="my-scene.mp4"',
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  });
  if (!range) {
    headers.set("Content-Length", String(bytes.length));
    return new Response(new Uint8Array(bytes), { headers });
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) {
    headers.set("Content-Range", `bytes */${bytes.length}`);
    return new Response(null, { status: 416, headers });
  }
  const start = match[1] ? Number(match[1]) : Math.max(0, bytes.length - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= bytes.length) {
    headers.set("Content-Range", `bytes */${bytes.length}`);
    return new Response(null, { status: 416, headers });
  }
  headers.set("Content-Range", `bytes ${start}-${end}/${bytes.length}`);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(new Uint8Array(bytes.slice(start, end + 1)), { status: 206, headers });
}
