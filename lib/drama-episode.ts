import authoredEpisode from "../content/finding-love-at-a-hackathon/shot-data/episode-01.json" with { type: "json" };
import episode02 from "../content/finding-love-at-a-hackathon/shot-data/episode-02.json" with { type: "json" };
import episode03 from "../content/finding-love-at-a-hackathon/shot-data/episode-03.json" with { type: "json" };
import episode04 from "../content/finding-love-at-a-hackathon/shot-data/episode-04.json" with { type: "json" };
import episode05 from "../content/finding-love-at-a-hackathon/shot-data/episode-05.json" with { type: "json" };
import episode06 from "../content/finding-love-at-a-hackathon/shot-data/episode-06.json" with { type: "json" };
import episode07 from "../content/finding-love-at-a-hackathon/shot-data/episode-07.json" with { type: "json" };
import episode08 from "../content/finding-love-at-a-hackathon/shot-data/episode-08.json" with { type: "json" };
import episode09 from "../content/finding-love-at-a-hackathon/shot-data/episode-09.json" with { type: "json" };
import episode10 from "../content/finding-love-at-a-hackathon/shot-data/episode-10.json" with { type: "json" };

export { generationPrompt } from "./drama-prompt.ts";

/** The only boundary between authored episode content and the interactive player. */
export type DramaShot = {
  id: string;
  title: string;
  focusWord: string;
  meaning: string;
  pronunciation?: string;
  scenePrompt: string;
  dialogue?: string;
};

export type DramaEpisode = {
  id: string;
  number: number;
  title: string;
  seriesTitle: string;
  shots: DramaShot[];
};

export type AuthoredEpisode = {
  episode_id: string;
  episode_number: number;
  episode_title: string;
  series_title: string;
  audio_mode: string;
  shots: {
    id: string;
    shot_number: number;
    duration_seconds: number;
    focus_word: { word: string; meaning: string };
    learner_line: { speaker: string; text: string };
    protagonist_visible_throughout: boolean;
    visible_cast: string[];
    video_prompt: string;
  }[];
};

export function adaptEpisode(source: AuthoredEpisode): DramaEpisode {
  if (source.audio_mode !== "full_scene_audio_focus_word_silently_mouthed") throw new Error("Use the authored full-audio episode with only its focus word silently mouthed.");
  if (source.shots.length !== 10) throw new Error("An episode must contain exactly ten shots.");
  if (new Set(source.shots.map(shot => shot.id)).size !== 10) throw new Error("Every shot needs a unique ID.");
  return {
    id: source.episode_id,
    number: source.episode_number,
    title: source.episode_title,
    seriesTitle: source.series_title,
    shots: source.shots.map(shot => {
      if (shot.duration_seconds !== 8 || !shot.protagonist_visible_throughout || !shot.visible_cast.includes("[name]") ||
          shot.learner_line.speaker !== "[name]" || !shot.video_prompt.includes("[name]") ||
          !/^\S+$/.test(shot.focus_word.word)) {
        throw new Error(`Shot ${shot.id} must visibly include [name] with one focus word in an eight-second shot.`);
      }
      return {
        id: shot.id,
        title: `Scene ${String(shot.shot_number).padStart(2, "0")} · ${shot.focus_word.word}`,
        focusWord: shot.focus_word.word,
        meaning: shot.focus_word.meaning,
        scenePrompt: shot.video_prompt,
        dialogue: shot.learner_line.text,
      };
    }),
  };
}

export const episodes: DramaEpisode[] = [authoredEpisode, episode02, episode03, episode04, episode05, episode06, episode07, episode08, episode09, episode10].map(adaptEpisode);
export const episode = episodes[0];
