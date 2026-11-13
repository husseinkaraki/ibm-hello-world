import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

// All video requests are fulfilled here; these tests never call Google or create paid jobs.
const clip = readFileSync(new URL("./fixtures/scene.mp4", import.meta.url));
const photo = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=", "base64");

async function cloudFixture(page: Page, mode: "success" | "transient" | "failed" | "uncertain" = "success") {
  let submissions = 0;
  let checks = 0;
  const bodies: FormData[] = [];
  await page.route("**/api/veo**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/veo/video") return route.fulfill({ contentType: "video/mp4", body: clip });
    if (url.pathname === "/api/veo/status") {
      checks++;
      if (mode === "transient" && checks === 1) return route.fulfill({ status: 503, json: { error: "Fixture: temporary connection failure. Existing job preserved." } });
      if (mode === "failed" && submissions === 1) return route.fulfill({ status: 422, json: { error: "Fixture: generation was filtered. Request a new take explicitly." } });
      return route.fulfill({ json: { state: "complete", videoUrl: `/api/veo/video?job=fixture-${submissions}` } });
    }
    if (request.method() === "POST") {
      submissions++;
      const body = await new Request(request.url(), { method: "POST", headers: { "content-type": request.headers()["content-type"] }, body: new Uint8Array(request.postDataBuffer()!) }).formData();
      bodies.push(body);
      if (mode === "uncertain") return route.abort("failed");
      // Make submission/loading state observable without contacting an upstream service.
      await delay(150);
      return route.fulfill({ status: 202, json: { state: "pending", job: `fixture-${submissions}`, retryAfterSeconds: 5 } });
    }
    return route.fulfill({ json: { ready: true, requiresPassword: false, message: "Browser QA fixture" } });
  });
  return { get submissions() { return submissions; }, get checks() { return checks; }, bodies };
}

async function threeTakes(page: Page) {
  for (let take = 1; take <= 3; take++) {
    await expect(page.getByRole("button", { name: "Next: your scene" })).toBeDisabled();
    await page.getByRole("button", { name: `Record attempt ${take}` }).click();
    await expect(page.getByRole("button", { name: "Stop recording" })).toBeVisible();
    // Actual MediaRecorder capture needs a nonempty duration, rather than synthetic app state.
    await page.waitForTimeout(450);
    await page.getByRole("button", { name: "Stop recording" }).click();
    await expect(page.getByRole("button", { name: `Play attempt ${take}` })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Next: your scene" })).toBeEnabled();
}

async function openScene(page: Page) {
  await page.getByRole("button", { name: "Next: your scene" }).click();
  if (await page.getByAltText("Your character reference").count() === 0) {
    await expect(page.getByLabel("Your photo", { exact: true })).toBeEnabled();
    await page.getByLabel("Your photo", { exact: true }).setInputFiles({ name: "selfie-fixture.png", mimeType: "image/png", buffer: photo });
  }
  await expect(page.getByAltText("Lucy recurring character reference")).toBeVisible();
}

test("three actual local recordings unlock the video, with simulated scores and no threshold", async ({ page }) => {
  const cloud = await cloudFixture(page);
  await page.addInitScript(() => {
    Math.random = () => 0;
    const tracks: MediaStreamTrack[] = [];
    Object.assign(window, { recordedTracks: tracks });
    const get = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      const stream = await get(constraints); tracks.push(...stream.getTracks()); return stream;
    };
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Finding Love at a Hackathon" })).toBeVisible();
  await expect(page.getByText("Random demo scores · not a speech assessment.", { exact: false })).toBeVisible();
  await threeTakes(page);
  await expect(page.getByRole("button", { name: "Record attempt 3" })).toBeDisabled();
  expect(await page.locator("strong").filter({ hasText: "55/100" }).count()).toBe(3);
  expect(await page.evaluate(() => (window as unknown as { recordedTracks: MediaStreamTrack[] }).recordedTracks.every(track => track.readyState === "ended"))).toBe(true);
  await page.getByRole("button", { name: "Play attempt 3" }).click();
  await expect(page.getByRole("button", { name: "Pause attempt 3" })).toBeVisible();
  await openScene(page);
  expect(cloud.submissions).toBe(0);
  await expect(page.getByRole("button", { name: "Generate my scene" })).toBeEnabled();
  await expect(page.getByText("AUDIO DIRECTION:", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Show scene prompt" }).click();
  await expect(page.getByText("AUDIO DIRECTION:", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Hide scene prompt" }).click();
  await expect(page.getByText("AUDIO DIRECTION:", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Generate my scene" }).click();
  await expect(page.getByRole("button", { name: "Sending your scene…" })).toBeVisible();
  await expect(page.getByLabel("Your generated scene using safe")).toBeVisible();
  const body = cloud.bodies[0];
  expect(body.get("focusWord")).toBe("safe");
  expect(body.get("durationSeconds")).toBe("8");
  expect(body.get("aspectRatio")).toBe("9:16");
  expect(body.get("resolution")).toBe("720p");
  expect(body.get("generateAudio")).toBe("true");
  expect(body.get("image")).toBeNull();
  expect((body.get("learnerImage") as File).name).toBe("selfie-fixture.png");
  expect((body.get("castImage") as File).name).toBe("lucy.png");
  await page.getByRole("button", { name: "Play scene", exact: true }).click();
  await expect.poll(() => page.locator("video").evaluate(video => (video as HTMLVideoElement).currentTime)).toBeGreaterThan(0.1);
  const playingVideo = await page.locator("video").elementHandle();
  await page.getByRole("button", { name: "Back to practice" }).click();
  expect(await playingVideo!.evaluate(video => (video as HTMLVideoElement).paused)).toBe(true);
  await openScene(page);
  await expect(page.getByLabel("Your generated scene using safe")).toBeVisible();
  expect(cloud.submissions).toBe(1);
  await page.getByRole("button", { name: "Next scene", exact: true }).click();
  await expect(page.getByLabel("Scene 2 of 10", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next: your scene" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Record attempt 1" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Play attempt 1" })).toHaveCount(0);
  await page.getByRole("button", { name: "Previous scene" }).click();
  await expect(page.getByRole("button", { name: "Next: your scene" })).toBeEnabled();
  expect(cloud.submissions).toBe(1);
});

test("a lost status check retries the existing job and restores it after reload", async ({ page }) => {
  const cloud = await cloudFixture(page, "transient");
  await page.goto("/"); await threeTakes(page);
  await openScene(page);
  await page.getByRole("button", { name: "Generate my scene" }).click();
  await page.getByRole("button", { name: "Check this generation again" }).click();
  await expect(page.locator("video")).toBeVisible();
  expect(cloud.submissions).toBe(1);
  await page.reload(); await threeTakes(page);
  await openScene(page);
  await expect(page.locator("video")).toBeVisible();
  expect(cloud.submissions).toBe(1);
});

test("failed jobs require an explicit new paid take", async ({ page }) => {
  const cloud = await cloudFixture(page, "failed");
  await page.goto("/"); await threeTakes(page);
  await openScene(page);
  await page.getByRole("button", { name: "Generate my scene" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("generation was filtered");
  expect(cloud.submissions).toBe(1);
  await page.getByRole("button", { name: "Back to practice" }).click();
  await openScene(page);
  expect(cloud.submissions).toBe(1);
  await page.getByRole("button", { name: "Retry generation · new paid take" }).click();
  await expect(page.locator("video")).toBeVisible();
  expect(cloud.submissions).toBe(2);
});

test("an ambiguous submission is never automatically resubmitted", async ({ page }) => {
  const cloud = await cloudFixture(page, "uncertain");
  await page.goto("/"); await threeTakes(page);
  await openScene(page);
  await page.getByRole("button", { name: "Generate my scene" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("may still have accepted");
  await page.getByRole("button", { name: "Back to practice" }).click();
  await openScene(page);
  expect(cloud.submissions).toBe(1);
  await expect(page.getByRole("button", { name: "Submit another paid request" })).toBeVisible();
});

test("microphone denial is friendly and never completes an attempt", async ({ page }) => {
  await cloudFixture(page);
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Fixture: blocked", "NotAllowedError")); });
  await page.goto("/");
  await page.getByRole("button", { name: "Record attempt 1" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Allow the microphone");
  await expect(page.getByRole("button", { name: "Next: your scene" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Play attempt 1" })).toHaveCount(0);
});

test("required learner photo and fixed Lucy reference are reused and changed photos invalidate cached clips", async ({ page }) => {
  const cloud = await cloudFixture(page);
  await page.goto("/");
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await threeTakes(page);
  await page.getByRole("button", { name: "Next: your scene" }).click();
  await expect(page.getByAltText("Lucy recurring character reference")).toBeVisible();
  await expect(page.getByRole("button", { name: "Generate my scene" })).toBeDisabled();
  const input = page.getByLabel("Your photo", { exact: true });
  await input.setInputFiles({ name: "invalid.png", mimeType: "image/png", buffer: Buffer.from("fixture invalid photo") });
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Choose a JPEG or PNG");
  await input.setInputFiles({ name: "selfie-fixture.png", mimeType: "image/png", buffer: photo });
  await page.getByRole("button", { name: "Generate my scene" }).click();
  await expect(page.locator("video")).toBeVisible();
  const replacement = Buffer.concat([photo, Buffer.from([0])]);
  await input.setInputFiles({ name: "replacement-fixture.png", mimeType: "image/png", buffer: replacement });
  await expect(page.locator("video")).toHaveCount(0);
  expect(cloud.submissions).toBe(1);
  await page.getByRole("button", { name: "Generate my scene" }).click();
  await expect(page.locator("video")).toBeVisible();
  expect(cloud.submissions).toBe(2);
  await page.getByRole("button", { name: "Next scene", exact: true }).click();
  await threeTakes(page);
  await openScene(page);
  await page.getByRole("button", { name: "Generate my scene" }).click();
  await expect(page.locator("video")).toBeVisible();
  expect(cloud.submissions).toBe(3);
  expect((cloud.bodies[2].get("learnerImage") as File).name).toBe("replacement-fixture.png");
  expect((cloud.bodies[2].get("castImage") as File).name).toBe("lucy.png");
  expect(Buffer.from(await (cloud.bodies[1].get("castImage") as File).arrayBuffer()).equals(Buffer.from(await (cloud.bodies[2].get("castImage") as File).arrayBuffer()))).toBe(true);
});

test("mobile practice and watch screens fit without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await cloudFixture(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Record attempt 1" })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await threeTakes(page);
  await openScene(page);
  await page.getByRole("button", { name: "Generate my scene" }).click();
  await expect(page.locator("video")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("all ten scenes repeat the practice-to-video flow and finish without an empty third page", async ({ page }) => {
  test.setTimeout(60_000);
  const cloud = await cloudFixture(page);
  await page.goto("/");
  for (let scene = 1; scene <= 10; scene++) {
    await expect(page.getByLabel(`Scene ${scene} of 10`, { exact: true })).toBeVisible();
    await threeTakes(page);
    await openScene(page);
    await page.getByRole("button", { name: "Generate my scene" }).click();
    await expect(page.locator("video")).toBeVisible();
    await page.getByRole("button", { name: scene === 10 ? "Finish episode" : "Next scene", exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "To be continued…" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Chapter complete" })).toBeDisabled();
  expect(cloud.submissions).toBe(10);
});
