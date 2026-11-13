import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { adaptEpisode, episode, episodes, generationPrompt } from "../lib/drama-episode.ts";
import { composeScenePrompt } from "../lib/scene-prompt.ts";
import { validatePrompt, validateFocusWord } from "../lib/veo-contract.ts";

const authored = JSON.parse(readFileSync(new URL("../content/finding-love-at-a-hackathon/shot-data/episode-01.json", import.meta.url), "utf8"));

test("the main product uses the authored ten-shot episode with one protagonist and word per shot", () => {
  assert.equal(episode.title, "The Last Seat");
  assert.equal(episode.shots.length, 10);
  assert.equal(authored.audio_mode, "full_scene_audio_focus_word_silently_mouthed");
  assert.deepEqual(episode.shots.map(shot => shot.focusWord), ["safe", "seat", "help", "small", "work", "share", "try", "team", "name", "wait"]);
  for (const shot of episode.shots) {
    assert.equal(validateFocusWord(shot.focusWord), shot.focusWord);
    assert.ok(shot.scenePrompt.includes("[name]"));
    assert.match(shot.scenePrompt, /FULL SCENE SOUNDTRACK/);
    assert.doesNotMatch(shot.scenePrompt, /Render silent source|focus word.*beginning near|halfway through the shot/);
    assert.equal(shot.dialogue, authored.shots.find((source: { id: string }) => source.id === shot.id).learner_line.text);
    for (const selfie of [false, true]) assert.doesNotThrow(() => validatePrompt(composeScenePrompt(generationPrompt(shot, selfie), shot.focusWord)));
  }
});

test("the shared catalog exposes all ten authored episodes and validates every composed prompt", () => {
  assert.equal(episodes.length, 10);
  assert.deepEqual(episodes.map(item => item.number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const item of episodes) {
    assert.equal(item.shots.length, 10);
    for (const shot of item.shots) {
      assert.equal(validateFocusWord(shot.focusWord), shot.focusWord);
      for (const selfie of [false, true]) for (const generateAudio of [false, true]) {
        assert.doesNotThrow(() => validatePrompt(composeScenePrompt(generationPrompt(shot, selfie), shot.focusWord, { generateAudio })));
      }
    }
  }
});

test("invalid episode counts, duplicate IDs, invisible protagonists, and multiple focus words fail at the adapter", () => {
  for (const mutate of [
    (source: typeof authored) => source.shots.pop(),
    (source: typeof authored) => { source.shots[1].id = source.shots[0].id; },
    (source: typeof authored) => { source.shots[0].protagonist_visible_throughout = false; },
    (source: typeof authored) => { source.shots[0].focus_word.word = "two words"; },
  ]) {
    const source = structuredClone(authored); mutate(source);
    assert.throws(() => adaptEpisode(source));
  }
});
