import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_SETTINGS, formatScenePrompt, parseDraft, parseTake, sameTake, type TakeSnapshot } from "../app/scene-creator/creator-state.ts";

const snapshot: TakeSnapshot = {
  episodeId: "E01", episodeTitle: "The Last Seat", shotId: "E01-S01", shotTitle: "Scene 01 · safe",
  focusWord: "safe", effectivePrompt: "An adult catches a falling board.",
  settings: { ...DEFAULT_SETTINGS }, referenceId: null, referenceName: null,
};

test("a previous take is never treated as the current scene after any generation input changes", () => {
  assert.equal(sameTake(snapshot, structuredClone(snapshot)), true);
  for (const changes of [
    { shotId: "E01-S02" }, { episodeId: "E02" }, { focusWord: "seat" },
    { effectivePrompt: "An adult sits beside a teammate." }, { referenceId: "new-photo" },
    { settings: { ...DEFAULT_SETTINGS, durationSeconds: 4 as const } },
    { settings: { ...DEFAULT_SETTINGS, aspectRatio: "16:9" as const } },
    { settings: { ...DEFAULT_SETTINGS, resolution: "1080p" as const } },
    { settings: { ...DEFAULT_SETTINGS, generateAudio: false } },
  ]) assert.equal(sameTake(snapshot, { ...snapshot, ...changes }), false);
});

test("changing video settings updates authored format instructions without losing scene edits", () => {
  const prompt = "Generate one continuous 8-second live-action-style shot in 9:16 portrait composition. My edited dialogue and camera direction.";
  assert.equal(formatScenePrompt(prompt, { ...DEFAULT_SETTINGS, durationSeconds: 4, aspectRatio: "16:9" }), "Generate one continuous 4-second live-action-style shot in 16:9 landscape composition. My edited dialogue and camera direction.");
  assert.equal(formatScenePrompt("  My entirely custom prompt.  ", DEFAULT_SETTINGS), "My entirely custom prompt.");
});

test("drafts restore selection, edits, and supported settings while ignoring corrupt or incompatible data", () => {
  const draft = { episodeId: "E01", shotId: "E01-S01", prompt: "An edited scene prompt.", settings: DEFAULT_SETTINGS };
  assert.deepEqual(parseDraft(JSON.stringify(draft)), draft);
  for (const raw of [null, "{broken", "null", JSON.stringify({ ...draft, settings: { ...DEFAULT_SETTINGS, durationSeconds: 5 } }), JSON.stringify({ ...draft, settings: { ...DEFAULT_SETTINGS, durationSeconds: 4, resolution: "1080p" } })]) {
    assert.equal(parseDraft(raw), null);
  }
});

test("saved requests retain their original prompt and settings; unknown legacy settings remain explicit", () => {
  const take = { job: "signed-job-fixture", snapshot };
  assert.deepEqual(parseTake(JSON.stringify(take)), take);
  assert.deepEqual(parseTake(JSON.stringify({ job: "legacy-job", snapshot: null })), { job: "legacy-job", snapshot: null });
  for (const raw of [null, "{broken", "null", JSON.stringify({ job: "", snapshot }), JSON.stringify({ job: "fixture", snapshot: {} })]) {
    assert.equal(parseTake(raw), null);
  }
});
