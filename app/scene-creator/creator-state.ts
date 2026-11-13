import type { GenerationOptions } from "../../lib/veo-contract";

export type CreatorSettings = Required<GenerationOptions>;
export const DEFAULT_SETTINGS: CreatorSettings = {
  durationSeconds: 8,
  aspectRatio: "9:16",
  resolution: "720p",
  generateAudio: true,
};

export type TakeSnapshot = {
  episodeId: string;
  episodeTitle: string;
  shotId: string;
  shotTitle: string;
  focusWord: string;
  effectivePrompt: string;
  settings: CreatorSettings;
  referenceId: string | null;
  referenceName: string | null;
};

export type SavedTake = { job: string; snapshot: TakeSnapshot | null };
export type CreatorDraft = {
  episodeId: string;
  shotId: string;
  prompt: string;
  settings: CreatorSettings;
};

export function isSettings(value: unknown): value is CreatorSettings {
  if (!value || typeof value !== "object") return false;
  const settings = value as CreatorSettings;
  return [4, 6, 8].includes(settings.durationSeconds) &&
    ["16:9", "9:16"].includes(settings.aspectRatio) &&
    ["720p", "1080p"].includes(settings.resolution) &&
    typeof settings.generateAudio === "boolean" &&
    (settings.resolution !== "1080p" || settings.durationSeconds === 8);
}

/** Update only the authored format sentence; leave the user's scene direction intact. */
export function formatScenePrompt(prompt: string, settings: CreatorSettings): string {
  const orientation = settings.aspectRatio === "9:16" ? "portrait" : "landscape";
  return prompt.trim().replace(
    /^Generate one continuous \d+-second live-action-style shot in (?:9:16|16:9) (?:portrait|landscape) composition\./,
    `Generate one continuous ${settings.durationSeconds}-second live-action-style shot in ${settings.aspectRatio} ${orientation} composition.`,
  );
}

export function sameTake(a: TakeSnapshot, b: TakeSnapshot): boolean {
  return a.episodeId === b.episodeId && a.shotId === b.shotId &&
    a.focusWord === b.focusWord && a.effectivePrompt === b.effectivePrompt &&
    a.referenceId === b.referenceId &&
    a.settings.durationSeconds === b.settings.durationSeconds &&
    a.settings.aspectRatio === b.settings.aspectRatio &&
    a.settings.resolution === b.settings.resolution &&
    a.settings.generateAudio === b.settings.generateAudio;
}

export function parseDraft(raw: string | null): CreatorDraft | null {
  try {
    const value = JSON.parse(raw || "null") as CreatorDraft | null;
    if (!value || typeof value.episodeId !== "string" || typeof value.shotId !== "string" ||
      typeof value.prompt !== "string" || value.prompt.length > 20_000 || !isSettings(value.settings)) return null;
    return value;
  } catch { return null; }
}

export function parseTake(raw: string | null): SavedTake | null {
  try {
    const value = JSON.parse(raw || "null") as SavedTake | null;
    if (!value || typeof value.job !== "string" || !value.job || value.job.length > 20_000) return null;
    if (value.snapshot === null) return value;
    const snapshot = value.snapshot;
    if (!snapshot || !isSettings(snapshot.settings) ||
      ![snapshot.episodeId, snapshot.episodeTitle, snapshot.shotId, snapshot.shotTitle, snapshot.focusWord, snapshot.effectivePrompt].every(item => typeof item === "string") ||
      snapshot.effectivePrompt.length > 20_000 ||
      !(snapshot.referenceId === null || typeof snapshot.referenceId === "string") ||
      !(snapshot.referenceName === null || typeof snapshot.referenceName === "string")) return null;
    return value;
  } catch { return null; }
}
