# Scene Creator

`/scene-creator` is the standalone creator. `/veo` redirects to it, and both the header and footer return to the learning product at `/`.

The creator consumes the same `episodes` catalog, `DramaEpisode` / `DramaShot` adapter, `generationPrompt`, and `composeScenePrompt` as the learning product. The selected scene supplies the editable prompt, learner line, focus word, and meaning. Historical word-onset fields do not become controls or synchronization requirements.

The browser submits one multipart request to the existing `/api/veo` route only after the user presses **Generate scene**. Fields are `prompt` (the base prompt), `focusWord`, `durationSeconds`, `aspectRatio`, `resolution`, `generateAudio`, and optional `image`. The shared API composes the audio direction once. The final prompt preview uses that same composition, including the audio setting. The demo password is sent only in `x-veo-password` and is never persisted.

Defaults are eight seconds, portrait 9:16, 720p, and full audio on `veo-3.1-fast-generate-001`. Supported alternatives are four/six seconds, landscape 16:9, 1080p for eight-second clips, and audio off. Selecting 1080p selects eight seconds and disables shorter durations. The authored opening format sentence is adapted to the chosen duration and aspect ratio. Custom direction remains editable.

With audio enabled, the shared prompt instructs normal dialogue, ambience, music, and effects while the protagonist silently mouths only the focus word. This is a generation instruction; the UI does not claim timing detection, guaranteed selective silence, or audio analysis. Audio off requests a silent clip.

The optional JPEG/PNG upload is validated for size and file signature before submission, then validated again by the API. The existing backend uses it as a starting-frame image, not a separate identity-reference API. It stays selected while changing scenes; it is not stored and must be reattached after reloading.

Session storage preserves the selected episode/scene, prompt edits, and generation settings. Local storage preserves the latest signed job reference and the exact submitted prompt/settings. Restoring a page checks that existing job; it never submits another paid request. A preview always carries its own submitted settings. If any current input differs, an explicit notice identifies it as an earlier take. Original `/veo` job references are restored with unknown settings marked as such. Signed references retain the backend's normal expiration.

Status failures pause polling and offer a manual check without resubmitting. Submission failures never automatically retry. Playback and download reuse `/api/veo/video` and its existing MP4/range behavior.

Validation uses fixture video and intercepted API responses; no additional paid generation is needed for browser QA.
