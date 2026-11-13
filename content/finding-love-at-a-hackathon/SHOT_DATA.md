# Finding Love at a Hackathon
## Shot-data contract, schema 1.1

`shot-data/episode-01.json` is ready for the learning workflow and scene selection. A learning “scene” maps to one shot. Use the episode's ordered `shots` array; do not turn the source script into an additional shot. The canonical ID sequence is E01-S01 through E10-S10.

| Consumer concept | JSON field | Meaning |
| --- | --- | --- |
| Series title | `series_title` | Exactly Finding Love at a Hackathon. |
| Episode title and number | `episode_title`, `episode_number` | Subtitle and integer, 1–10. |
| Ordered scene records | `shots` | Exactly ten per episode. |
| Scene identifier | `shots[].id` | Stable shot ID, e.g. E01-S01. Equivalent to a consumer's `shot_id`. |
| Source and edit durations | `duration_seconds`, `source_duration_seconds` | Both eight seconds at shot level. Episode total is 80 seconds. |
| Edit placement | `episode_start_seconds`, `episode_end_seconds` | Contiguous eight-second positions. These do not locate the word. |
| Main learning word | `focus_word.word` | One plain lowercase word. |
| Meaning | `focus_word.meaning` | Brief English explanation. No translation language is assumed. |
| Primary/delivery rule | `focus_word.primary`, `focus_word.delivery` | `true`, `silently_mouthed_by_[name]`. |
| Practice line | `learner_line.text` | Plain line for learning, e.g. `It's safe.` |
| Performance line | `learner_line.performance_text` | `It's [silently mouthed: safe].` |
| Labelled line | `learner_line.labelled_text` | `[name]: It's [silently mouthed: safe].` |
| Actor and audio direction | `learner_line.speaker`, `learner_line.focus_delivery` | Exact speaker [name]; other words voiced, target word visibly mouthed without voice. |
| Normal supporting audio | `dialogue`, `sound_cues` | Dialogue in performance order, plus ambience, effects and score. Supporting rows have `delivery: voiced_normally`. |
| Generation text | `video_prompt` | Full copyable prompt. It contains identity/reference instructions, wardrobe, cast, light, framing, action, supporting dialogue, the precise target-only audio rule and continuity. |
| Visual continuity | `visible_cast`, `visible_action`, `camera`, `continuity` | Explicitly accounts for [name] throughout and the starting/ending prop states. |
| Added graphics | `edit_only_overlay` | Exact short text for the edit. Do not depend on generated screen lettering to communicate it. `None` means no required overlay. |

Every episode has `audio_mode: full_scene_audio_focus_word_silently_mouthed`. There is **no** `onset_seconds`, `focus_word_time_seconds`, learner audio window or target synchronization field. The plain practice text does not mean the target should be audibly spoken in the generated scene: the marked performance text and video prompt control that distinction. Do not send the plain line alone as an instruction to voice the entire line.

The recurring romantic co-star's cast/speaker identifier is `Lucy`; uppercase on-screen labels use `LUCY`. Image 1 is the uploaded learner reference for `[name]`; image 2 is the application-managed story asset `media/lucy.png`, served by `/api/cast-reference`. Leo and Jules keep their existing identifiers and roles. The episode schema remains 1.1 with the same JSON keys and field types. The first demo episode's multiline `video_prompt` strings contain cinematic second-ranged action segments and the complete two-image mapping. Existing app consumers can send that same string unchanged; no new per-segment or word-timing fields are added.

The manifest includes optional `reference_images` metadata for this mapping and the relative Lucy asset path. Its script hashes are regenerated from the canonical scripts. The companion product workstream owns the binary image and API packaging.

Example of the first record's learning fields:

```json
{
  "id": "E01-S01",
  "duration_seconds": 8,
  "focus_word": {
    "word": "safe",
    "meaning": "Protected from harm.",
    "primary": true,
    "delivery": "silently_mouthed_by_[name]"
  },
  "learner_line": {
    "speaker": "[name]",
    "text": "It's safe.",
    "performance_text": "It's [silently mouthed: safe].",
    "labelled_text": "[name]: It's [silently mouthed: safe].",
    "focus_delivery": "Visibly mouth only the focus word without voicing it; speak the rest of the line normally. No word timing or synchronization."
  }
}
```

The full file, not this abbreviated example, is the generation asset. It contains the self-contained prompt and production fields. These JSON keys describe content; they are not presented as a provider API request body. No video API, audio processing or application code runs in the exporter.

`shot-data/manifest.json` lists each canonical script, its SHA-256, corresponding JSON path, episode runtime and shot count. `tools/export_shots.py --check` compares all exported text against a fresh parse of the scripts. `tools/validate.py` enforces the requested ten-episode batch and the audio, identity, word, duration and cliffhanger constraints.
