# Main learning workflow

`/` is the primary experience: record one focus word three times, view explicitly simulated scores, then generate/watch a scene. Next scene advances immediately to the next word. Scores never impose a passing threshold. Page two requires a learner photo and automatically includes the supplied Lucy reference. Recordings and the selected learner photo remain in browser memory; recordings are never uploaded. Reloading clears the learner photo. Signed jobs remain in tab-scoped session storage, keyed by the scene and SHA-256 of both images. Reselecting the same photos resumes the same job; changing either reference selects a fresh cache entry without automatically submitting a paid request.

The root uses the writing workstream's `content/finding-love-at-a-hackathon/shot-data/episode-01.json`. `lib/drama-episode.ts` adapts the ten authored episode JSON files to the UI without inventing another story, exports `episodes: DramaEpisode[]` for the Scene Creator catalog, and retains `episode` as the root's first-episode alias. It also re-exports `generationPrompt(shot, hasSelfie)`. The adapter requires exactly ten unique, eight-second shots per episode, a visibly present `[name]` protagonist, one focus word, its meaning, the protagonist's learner line, and the video prompt. Legacy timing metadata is not used. To update content, replace the authored JSON; keep the adapter separate from the interaction components. Both IBM source and Docker allowlists include exactly these ten JSON files and continue excluding nested secrets.

## Shared Scene Creator / API contract

The main product uses **`POST /api/veo/drama`**, a strict entry point into the same submission/status/video service. It requires `learnerImage` and `castImage` (one JPEG/PNG each, 5 MB per file), a focus word, eight-second duration, and audio enabled. The server rejects missing/duplicate files, identical photos, substituted cast images, and oversized multipart streams even without Content-Length. It checks the cast bytes against the packaged Lucy asset, then sends **both** images as ordered `instances[0].referenceImages` with `referenceType: "asset"`; it does not mix them with the mutually exclusive starting-frame `image` field. The learner is reference 1 / `[name]`; Lucy is reference 2 / `Lucy`. Main defaults remain portrait, 720p, full audio, and Veo 3.1 Fast. Scene Creator's existing single-image `POST /api/veo` stays compatible.

Lucy's single canonical asset is `content/finding-love-at-a-hackathon/media/lucy.png`, copied unchanged from the user's supplied photo. `GET /api/cast-reference` serves that image and the UI previews it on page two. The standalone preparation helper copies this exact asset into the same story-media path in the production artifact. IBM/Docker allowlists include only this media file; credentials and local environment files remain excluded. No runtime credential/signing bindings are changed. A missing/unreadable asset is an honest error and disables generation.

The current [Google reference-image guide](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/generate-videos-from-references) and [Fast model specification](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/veo/3-1-generate) list Fast asset-reference support and portrait output. The REST example uses up to three asset images and an eight-second clip. The official [SDK converter](https://github.com/googleapis/python-genai/blob/main/google/genai/models.py) maps `reference_images` to `instances[0].referenceImages`, and each image's `reference_type` to `referenceType`; [SDK types](https://github.com/googleapis/python-genai/blob/main/google/genai/types.py) disallow combining these references with a starting image, video, or last frame. No model switch or paid verification was needed. The guide's single-subject wording is narrower than Google's [multi-character ingredients dialogue example](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-veo-3-1). Separate learner/Lucy identity mapping is explicit prompt direction, not a guarantee of perfect likeness or selective silence.

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

The main product explicitly sends eight seconds, portrait, 720p, and audio enabled. Existing clients that omit fields keep their old behavior. Generation requires no demo password. Same-origin checks, input validation, and explicit paid-request controls still apply.

Import `composeScenePrompt(basePrompt, focusWord?, { generateAudio?: boolean, castReferences?: boolean })` from `lib/scene-prompt.ts` in clients to preview the final prompt. The helper's audio option defaults to true; explicitly passing false appends a silent-clip instruction instead of full-audio direction while retaining the focus word's mouth action. Submit **the base prompt and structured focus word separately**: the server validates both and applies the same helper once with the validated audio setting before submitting. With audio on, this requests normal dialogue/ambience/effects/music while only `[name]` mouths the focus word without vocalizing it. It is prompt-directed generation, not guaranteed selective muting. No detection, application synchronization, timed voice insertion, voice cloning, recorded-word insertion, or audio post-processing runs. Authored second ranges are cinematic prompt directions only. The returned video uses its own generated audio, played through ordinary browser video controls. The watch page tells the learner to get ready to mouth the word themselves; that moment is not captured or assessed.

The POST/status response shapes, signed jobs, runtime credentials, and mounted IBM secrets stay unchanged. A failed submission is never automatically retried. Ambiguous submissions warn that a job might already have been accepted; creating another request is an explicit paid action. Status/network failures retain the job and offer a status-only retry.

Google's [Veo 3.1 model specification](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/veo/3-1-generate) and [video parameter reference](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest/Shared.Types/VideoGenerationModelParams) describe the model settings.

## QA inventory

| Claim / interaction | Functional check | Visual states |
| --- | --- | --- |
| One word and exactly three takes | Capture real MediaRecorder blobs with a fake browser microphone; low random scores still unlock Next; no fourth take | Initial, recording, one take, three takes |
| Local recording playback and cleanup | Replay/pause attempts; microphone tracks end after each take; object URLs revoked on unmount | Replay state, permission error |
| Required learner photo and fixed Lucy reference | Reject invalid input, send both files, reuse across scene advances, and invalidate cached output when photos change | Required-photo panel on page two, Lucy preview |
| User-triggered generation and caching | No POST before Generate; verify parameters; revisit/reload without another POST | Awaiting, submitting, pending, ready |
| Errors and retries | Denied microphone, transient status failure, filtered job, ambiguous POST; retry status versus explicit new paid take | Each error notice and retry action |
| Working video and prompt toggle | Play the local fixture MP4; hide/show exact composed prompt | Native player, expanded prompt |
| Scene tally and advance | Next scene updates word/tally and resets attempts; previous scene restores its data | Scene 2 |
| Focused responsive layout | Check 1440px desktop and 390px phone, overflow and essential control bounds | Initial and watch screen at both sizes |

Run `npm run build`, `npm run check`, `npm test`, and `npm run test:browser`. Install the test browser with `npx playwright install chromium` (CI also installs its system dependencies). The Playwright suite uses a fake microphone, a tiny labeled local MP4 fixture with a test tone, and intercepted Veo endpoints. It cannot create paid Google generations. Set `PLAYWRIGHT_BASE_URL` to run the same mocked UI checks against the deployed build. Live model quality, prompt compliance, identity likeness, and selective word silence require the separately owned real smoke test.

For this follow-up, run only the focused payload checks and affected reference UI smoke locally; retain the existing required CI suite. No paid generation is authorized for implementation verification.
