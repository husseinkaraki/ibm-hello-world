import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { parseGenerationRequest } from "../lib/veo-request.ts";
import { generationBody, MAX_IMAGE_BYTES } from "../lib/veo-contract.ts";
import { dramaGenerationIdentity, DRAMA_GENERATION_CONTRACT, DRAMA_SETTINGS } from "../lib/drama-generation.ts";

const learner = new Uint8Array([255, 216, 255, 0]);
const lucy = readFileSync(new URL("../content/finding-love-at-a-hackathon/media/lucy.png", import.meta.url));
function form() {
  const data = new FormData();
  data.set("prompt", "[name] catches the falling board beside Lucy.");
  data.set("focusWord", "safe"); data.set("durationSeconds", "8"); data.set("aspectRatio", "9:16");
  data.set("resolution", "720p"); data.set("generateAudio", "true");
  data.set("learnerImage", new File([learner], "learner-fixture.jpg", { type: "image/jpeg" }));
  data.set("castImage", new File([lucy], "lucy.png", { type: "image/png" }));
  return data;
}
const request = (data: FormData) => new Request("https://example.invalid/api/veo/drama", { method: "POST", body: data });

test("the product sends both ordered native asset references with distinct learner/Lucy instructions", async () => {
  const result = await parseGenerationRequest(request(form()), true);
  const body = generationBody(result.prompt, result.image, result.options, result.referenceImages);
  assert.equal("image" in body.instances[0], false);
  assert.equal(body.instances[0].referenceImages?.length, 2);
  assert.equal(body.instances[0].referenceImages?.every(reference => reference.referenceType === "asset"), true);
  assert.equal(body.instances[0].referenceImages?.[0].image.bytesBase64Encoded === Buffer.from(learner).toString("base64"), true);
  assert.equal(body.instances[0].referenceImages?.[1].image.bytesBase64Encoded === lucy.toString("base64"), true);
  assert.equal(body.parameters.durationSeconds, 8);
  assert.equal(body.parameters.generateAudio, true);
  assert.match(result.prompt, /Reference image 1 is the learner/);
  assert.match(result.prompt, /Reference image 2 is Lucy/);
  assert.match(result.prompt, /mouths only the focus word "safe"/);
  const identity = JSON.parse(dramaGenerationIdentity("[name] catches the falling board beside Lucy.", "safe", "learner-hash:lucy-hash"));
  assert.equal(identity.prompt, result.prompt);
  assert.equal(identity.contract, DRAMA_GENERATION_CONTRACT);
  assert.deepEqual(identity.settings, DRAMA_SETTINGS);
  assert.notEqual(dramaGenerationIdentity("Changed scene prompt", "safe", "learner-hash:lucy-hash"), JSON.stringify(identity));
  assert.notEqual(dramaGenerationIdentity("[name] catches the falling board beside Lucy.", "safe", "changed-photo:lucy-hash"), JSON.stringify(identity));
});

test("missing, substituted, duplicate, invalid, or oversized photos cannot reach paid generation", async () => {
  for (const change of [
    (data: FormData) => data.delete("learnerImage"),
    (data: FormData) => data.delete("castImage"),
    (data: FormData) => data.set("castImage", new File([learner], "wrong-cast.jpg", { type: "image/jpeg" })),
    (data: FormData) => data.set("learnerImage", new File([lucy], "same-photo.png", { type: "image/png" })),
    (data: FormData) => data.append("learnerImage", new File([learner], "duplicate.jpg", { type: "image/jpeg" })),
    (data: FormData) => data.set("learnerImage", new File(["not a photo"], "invalid.png", { type: "image/png" })),
    (data: FormData) => data.set("learnerImage", new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "large.png", { type: "image/png" })),
    (data: FormData) => data.set("durationSeconds", "4"),
    (data: FormData) => data.set("generateAudio", "false"),
  ]) {
    const data = form(); change(data);
    await assert.rejects(parseGenerationRequest(request(data), true));
  }
  const oversized = new Request("https://example.invalid/api/veo/drama", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=fixture" }, body: "x".repeat(2 * MAX_IMAGE_BYTES + 65537) });
  await assert.rejects(parseGenerationRequest(oversized, true), (error: { status?: number }) => error.status === 413);
  assert.throws(() => generationBody("A scene", { bytes: learner, mimeType: "image/jpeg" }, { durationSeconds: 8 }, [{ bytes: learner, mimeType: "image/jpeg" }]));
});
