import { VEO_MODEL } from "./veo-contract.ts";
import { composeScenePrompt } from "./scene-prompt.ts";

// Bump when serialization/identity rules change without changing prompt/settings.
export const DRAMA_GENERATION_CONTRACT = "learner-lucy-assets-v4";
export const DRAMA_SETTINGS = { durationSeconds: 8, aspectRatio: "9:16", resolution: "720p", generateAudio: true } as const;

export function dramaGenerationIdentity(prompt: string, focusWord: string, references: string) {
  return JSON.stringify({
    contract: DRAMA_GENERATION_CONTRACT,
    model: VEO_MODEL,
    references,
    prompt: composeScenePrompt(prompt, focusWord, { ...DRAMA_SETTINGS, castReferences: true }),
    settings: DRAMA_SETTINGS,
  });
}
