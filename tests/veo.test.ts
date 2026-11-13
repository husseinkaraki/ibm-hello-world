import assert from "node:assert/strict";
import { test } from "node:test";
import { generationBody, operationState, validateImage, validatePrompt, VEO_MODEL } from "../lib/veo-contract.ts";
import { createJobToken, modelPath, readJobToken, videoResponse } from "../lib/veo-job.ts";

const prefix = modelPath("test-project", "us-central1", VEO_MODEL);
const operation = `${prefix}/operations/12345678-abcd-1234-abcd-123456789abc`;
const secret = "a-test-secret-that-is-at-least-32-characters";

test("generation uses the documented Vertex REST body with one short silent clip", () => {
  const bytes = new Uint8Array([255, 216, 255, 0]);
  const body = generationBody("An adult smiles at the camera.", { bytes, mimeType: "image/jpeg" });
  assert.equal(body.instances[0].image?.bytesBase64Encoded, Buffer.from(bytes).toString("base64"));
  assert.deepEqual(body.parameters, {
    sampleCount: 1, durationSeconds: 4, aspectRatio: "16:9", resolution: "720p",
    generateAudio: false, personGeneration: "allow_adult",
  });
  assert.equal("storageUri" in body.parameters, false);
  assert.equal("image" in generationBody("A quiet cafe.").instances[0], false);
});

test("image uploads check real content as well as declared MIME type", () => {
  assert.doesNotThrow(() => validateImage(new Uint8Array([255, 216, 255]), "image/jpeg"));
  assert.doesNotThrow(() => validateImage(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), "image/png"));
  assert.throws(() => validateImage(new TextEncoder().encode("not a photo"), "image/jpeg"), /JPEG or PNG/);
  assert.throws(() => validateImage(new Uint8Array(5 * 1024 * 1024 + 1), "image/png"), /5 MB/);
});

test("empty, oversized, or non-text prompts cannot start paid work", () => {
  assert.equal(validatePrompt("  A quiet cafe.  "), "A quiet cafe.");
  for (const prompt of [null, "   ", "short", "x".repeat(2001)]) {
    assert.throws(() => validatePrompt(prompt));
  }
});

test("pending and completed states follow Google's REST operation response", () => {
  assert.equal(operationState({ name: operation }), "pending");
  assert.equal(operationState({ done: false }), "pending");
  assert.equal(operationState({ done: true, response: { videos: [{ bytesBase64Encoded: "fixture-only", mimeType: "video/mp4" }] } }), "complete");
});

test("Google errors, filtered results, and missing video never count as success", () => {
  assert.throws(() => operationState({ done: true, error: { code: 7, message: "Permission denied" } }), /Permission denied/);
  assert.throws(() => operationState({ done: true, response: { raiMediaFilteredCount: 1 } }), /safety filters/);
  assert.throws(() => operationState({ done: true, response: { videos: [] } }), /without a playable video/);
});

test("a signed job survives a different instance using the same secret", () => {
  const token = createJobToken(operation, secret, 1000);
  assert.equal(readJobToken(token, secret, prefix, 2000), operation);
});

test("signed jobs reject tampering, wrong secrets, other projects, and expiry", () => {
  const token = createJobToken(operation, secret, 1000);
  const [payload, signature] = token.split(".");
  assert.throws(() => readJobToken(`${payload}.x${signature.slice(1)}`, secret, prefix, 2000));
  assert.throws(() => readJobToken(token, "a-different-secret", prefix, 2000));
  assert.throws(() => readJobToken(token, secret, modelPath("other-project", "us-central1", VEO_MODEL), 2000));
  assert.throws(() => readJobToken(token, secret, prefix, 1000 + 24 * 60 * 60 * 1000), /expired/);
  assert.throws(() => readJobToken(`${token}.extra`, secret, prefix, 2000));
});

test("signed job references still cannot redirect the server to arbitrary resources", () => {
  for (const bad of ["https://example.com/video", `${prefix}/operations/../other`, `${prefix}/operations/`]) {
    assert.throws(() => readJobToken(createJobToken(bad, secret, 1000), secret, prefix, 2000));
  }
});

test("video endpoint serves exact MP4 byte ranges and rejects invalid ranges", async () => {
  const bytes = new Uint8Array([0, 1, 2, 3, 4, 5]);
  const full = videoResponse(bytes, null);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get("Content-Type"), "video/mp4");
  assert.deepEqual(new Uint8Array(await full.arrayBuffer()), bytes);
  for (const [range, expected] of [["bytes=1-3", [1, 2, 3]], ["bytes=3-", [3, 4, 5]], ["bytes=-2", [4, 5]], ["bytes=4-99", [4, 5]]] as const) {
    const response = videoResponse(bytes, range);
    assert.equal(response.status, 206);
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], expected);
  }
  for (const range of ["bytes=9-10", "bytes=4-1", "bytes=-0", "bytes=", "bytes=0-1,3-4"]) {
    assert.equal(videoResponse(bytes, range).status, 416);
  }
});
