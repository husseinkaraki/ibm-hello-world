# Main learning workflow

`/` is the primary experience: record one focus word three times, view explicitly simulated scores, then generate/watch a scene. Next scene advances immediately to the next word. Scores never impose a passing threshold. Recordings and the optional selfie remain in browser memory; recordings are never uploaded. Reloading clears recordings and the selected photo. Signed generation references remain in tab-scoped session storage so reload, Back, and scene changes resume the existing job instead of creating paid requests.

The root uses the writing workstream's `content/finding-love-at-a-hackathon/shot-data/episode-01.json`. `lib/drama-episode.ts` adapts the ten authored episode JSON files to the UI without inventing another story, exports `episodes: DramaEpisode[]` for the Scene Creator catalog, and retains `episode` as the root's first-episode alias. It also re-exports `generationPrompt(shot, hasSelfie)`. The adapter requires exactly ten unique, eight-second shots per episode, a visibly present `[name]` protagonist, one focus word, its meaning, the protagonist's learner line, and the video prompt. Legacy timing metadata is not used. To update content, replace the authored JSON; keep the adapter separate from the interaction components. Both IBM source and Docker allowlists include exactly these ten JSON files and continue excluding nested secrets.

## Shared Scene Creator / API contract

Keep the existing `/api/veo`, `/api/veo/status?job=…`, and `/api/veo/video?job=…` routes. `POST /api/veo` takes multipart form fields:

| Field | Values | When omitted |
| --- | --- | --- |
| `prompt` | 10–4,000 characters including composed instructions | Required |
| `image` | JPEG/PNG, checked content, up to 5 MB | Text-to-video |
| `focusWord` | One word, 1–40 Unicode letters/marks with apostrophes or hyphens | No appended focus-word direction |
| `durationSeconds` | `4`, `6`, `8` | `4` |
| `aspectRatio` | `16:9`, `9:16` | `16:9` |
| `resolution` | `720p`, `1080p` | `720p` |
| `generateAudio` | `true`, `false` | `false` (legacy tester compatibility) |

The main product explicitly sends eight seconds, portrait, 720p, and audio enabled. Existing clients that omit fields keep their old behavior. The production demo-password guard is unchanged: read readiness and, when required, send `x-veo-password`. The main UI retains this password only in component memory for the current page session.

Import `composeScenePrompt(basePrompt, focusWord?, { generateAudio?: boolean })` from `lib/scene-prompt.ts` in clients to preview the final prompt. The helper's audio option defaults to true; explicitly passing false appends a silent-clip instruction instead of full-audio direction while retaining the focus word's mouth action. Submit **the base prompt and structured focus word separately**: the server validates both and applies the same helper once with the validated audio setting before submitting. With audio on, this requests normal dialogue/ambience/effects/music while only `[name]` mouths the focus word without vocalizing it. It is prompt-directed generation, not guaranteed selective muting. No detection, synchronization, fixed timestamps, voice cloning, recorded-word insertion, or audio post-processing runs. The returned video uses its own generated audio, played through ordinary browser video controls. The watch page tells the learner to get ready to mouth the word themselves; that moment is not captured or assessed.

The POST/status response shapes, signed jobs, runtime credentials, and mounted IBM secrets stay unchanged. A failed submission is never automatically retried. Ambiguous submissions warn that a job might already have been accepted; creating another request is an explicit paid action. Status/network failures retain the job and offer a status-only retry.

Google's [Veo 3.1 model specification](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/veo/3-1-generate) and [video parameter reference](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest/Shared.Types/VideoGenerationModelParams) describe the model settings.

## QA inventory

| Claim / interaction | Functional check | Visual states |
| --- | --- | --- |
| One word and exactly three takes | Capture real MediaRecorder blobs with a fake browser microphone; low random scores still unlock Next; no fourth take | Initial, recording, one take, three takes |
| Local recording playback and cleanup | Replay/pause attempts; microphone tracks end after each take; object URLs revoked on unmount | Replay state, permission error |
| Optional persistent selfie | Reject invalid content; choose a fixture PNG once and verify identical bytes on two scene requests | Photo panel, selected avatar |
| User-triggered generation and caching | No POST before Generate; verify parameters; revisit/reload without another POST | Awaiting, submitting, pending, ready |
| Errors and retries | Denied microphone, transient status failure, filtered job, ambiguous POST; retry status versus explicit new paid take | Each error notice and retry action |
| Working video and prompt toggle | Play the local fixture MP4; hide/show exact composed prompt | Native player, expanded prompt |
| Scene tally and advance | Next scene updates word/tally and resets attempts; previous scene restores its data | Scene 2 |
| Focused responsive layout | Check 1440px desktop and 390px phone, overflow and essential control bounds | Initial and watch screen at both sizes |

Run `npm run build`, `npm run check`, `npm test`, and `npm run test:browser`. Install the test browser with `npx playwright install chromium` (CI also installs its system dependencies). The Playwright suite uses a fake microphone, a tiny labeled local MP4 fixture with a test tone, and intercepted Veo endpoints. It cannot create paid Google generations. Set `PLAYWRIGHT_BASE_URL` to run the same mocked UI checks against the deployed build. Live model quality, prompt compliance, identity likeness, and selective word silence require the separately owned real smoke test.
