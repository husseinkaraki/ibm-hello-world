import type { DramaShot } from "./drama-episode";

/** Kept separate so the main player's client bundle does not import the whole catalog. */
export function generationPrompt(shot: DramaShot, hasSelfie: boolean): string {
  const instruction = "Use the supplied character/selfie reference for [name] and preserve that exact identity without inventing appearance or gender.";
  return hasSelfie ? shot.scenePrompt : shot.scenePrompt.replace(instruction, "Keep [name], the adult protagonist, visually consistent throughout.");
}
