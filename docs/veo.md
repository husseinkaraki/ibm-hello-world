# Scene Creator — Google Veo integration

A TypeScript / Next.js page at `/scene-creator` selects an authored episode scene and creates **one real Veo 3.1 Fast job** on Google Cloud, with an optional JPEG/PNG starting frame. `/veo` redirects to it. Submission, status polling, and MP4 playback use the existing server-side API routes. See [Scene Creator](scene-creator.md) for selection, editing, settings, audio direction, and persistence behavior.

## Run locally

Use Node.js 24 or newer:

```sh
npm install
npm run dev
```

Open [Scene Creator](http://localhost:8080/scene-creator). The page and photo preview work without credentials; generation stays disabled with an honest connection message. A completed video appears only after Google returns one.

## Connect Google Cloud

1. Select the Google Cloud project holding your credits. It needs billing and the [Vertex AI / Agent Platform API](https://console.cloud.google.com/flows/enableapi?apiid=aiplatform.googleapis.com) enabled. The calling identity needs the `roles/aiplatform.user` role and permission to consume services in that project.
2. Install the [official Google Cloud CLI](https://docs.cloud.google.com/sdk/docs/install) if needed, then authenticate local Application Default Credentials:

   ```sh
   gcloud auth application-default login
   gcloud auth application-default set-quota-project YOUR_PROJECT_ID
   ```

3. Set `GOOGLE_CLOUD_PROJECT` in your ignored `.env` or `.env.local`. Set `GOOGLE_CLOUD_LOCATION=us-central1` and a random `VEO_JOB_SECRET` of at least 32 characters. Use `.env.example` as a template without overwriting existing secret files. Signing keys and Google credentials are not copied between worktrees. To generate a new signing secret: `openssl rand -hex 32`.
4. Restart the dev server, load `/scene-creator`, and generate one short clip. A Gemini Developer API key alone does not configure this Google Cloud OAuth integration.

The model is `veo-3.1-fast-generate-001`, with one clip per request and `personGeneration: allow_adult`. The creator defaults to eight seconds, portrait 9:16, 720p, and full audio. It offers four/six/eight seconds, 9:16 or 16:9, 720p or eight-second 1080p, and audio on/off through the shared validated API. With audio on, only the protagonist's focus word is instructed to be silently mouthed; the rest of the soundtrack stays normal. This instruction is not a verified guarantee. The optional upload is the **first frame**, rather than a separate identity-reference system. Photo uploads are capped at 5 MB and checked for JPEG/PNG signatures. Use [Google's current pricing](https://cloud.google.com/model-garden/pricing#veo) to check costs; each new submission is paid. Status polling never resubmits a generation.

## Server behavior

| Endpoint | Behavior |
| --- | --- |
| `GET /api/veo` | Checks configuration and ADC token availability, without a paid generation. This does not prove model permissions, quota, or billing. |
| `POST /api/veo` | Multipart `prompt`, optional `focusWord`, `durationSeconds`, `aspectRatio`, `resolution`, `generateAudio`, and optional `image`; returns HTTP 202 with a signed `job` reference. Optional demo password is sent in `x-veo-password`. |
| `GET /api/veo/status?job=…` | Checks Google's long-running operation and returns `pending`, `complete`, or a real error. |
| `GET /api/veo/video?job=…` | Fetches Google's finished bytes and serves private MP4, including byte-range support for the browser player. |

The browser polls at the API's recommended interval. Scene Creator saves the signed job reference and submitted prompt/settings locally, so a refresh can check the same request and clearly label previews that differ from the current editor. Session storage keeps scene selection, prompt edits, and settings; photo bytes and passwords are not stored. Transient polling failures offer **Check this clip again** without creating new paid work. After 15 minutes, automatic polling pauses; manual checking remains available. Job references expire after 24 hours. Videos and selfie bytes are not persisted by this app; download the MP4 after generation.

The server uses the documented `predictLongRunning` and `fetchPredictOperation` REST methods, with `google-auth-library` supplying OAuth and the ADC quota-project header. Each call has a 45-second upstream timeout; submission does not wait for rendering and is never automatically retried. A lost submission response can leave a job running on Google; the UI reports that uncertainty. No in-memory job map or filesystem storage is needed across requests or instances.

## IBM runtime configuration

Keep these values **server-side**; none use the `NEXT_PUBLIC_` prefix:

| Name | Purpose |
| --- | --- |
| `GOOGLE_CLOUD_PROJECT` | Billed Google project ID or project number. |
| `GOOGLE_CLOUD_LOCATION` | `us-central1`. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Absolute path to a mounted ADC-compatible service-account or Workload Identity Federation configuration file on IBM. Local ADC login can use its default file instead. |
| `VEO_JOB_SECRET` | Random signing key, at least 32 characters; shared across all instances and revisions that must read existing jobs. |
| `VEO_DEMO_PASSWORD` | Shared password for the hosted hackathon demo. |
| `VEO_TRUSTED_PRIVATE_DEPLOYMENT` | Optional `true` only if access is already authenticated outside these routes; otherwise production requires `VEO_DEMO_PASSWORD`. |

Mount credentials as a runtime secret; install/build steps do not need them. No Google access token or private key is returned to the browser. A signed job reference is a temporary capability to check and download that one clip.

`.gitignore`, `.bobignore`, and `.dockerignore` exclude `.env*`, credential directories/files, and private-key formats. Only the sanitized `.env.example` is allowed in Git/Bob. IBM's [official Bob documentation](https://bob.ibm.com/docs/ide/configuration/bobignore) confirms Git-style patterns and negation syntax. Bob ignore rules govern Bob tools; Git and build exclusions are separate controls.

## Validate

```sh
npm run check
npm test
npm run build
```

Veo tests cover request/operation shapes, filtered and failed jobs, image/prompt validation, signed capability expiry/tampering, and MP4 ranges. Creator tests additionally cover setting/prompt/photo mismatches and safe restoration of saved requests and drafts. Their video bytes are fixtures and do not represent a newly generated video. Browser QA uses intercepted generation/status/video responses.

Creator regression testing does not submit paid generations. Local builds and passing fixtures do not prove Google account access; runtime credentials and model permissions are verified separately from UI checks.

## Feature boundaries

`app/scene-creator` owns the creator UI; `app/veo` is its compatibility redirect. The creator reuses the learning product's scene catalog and prompt helper plus `app/api/veo` and `lib/veo-*`. It preserves `/health`, runtime secret mounts, deployment helpers, and build/source exclusions. Google authentication remains server-side through `google-auth-library` and `server-only`.

The application was prepared against canonical base `37fbd53ecfc3311aa4b66e61674a16bea1081d2f`. Account access remains a separate runtime requirement; builds and tests do not start paid jobs.

## Official references

- [User-supplied Google notebook source](https://github.com/GoogleCloudPlatform/generative-ai/blob/main/vision/getting-started/veo3_video_generation.ipynb)
- [Stable Veo 3.1 models and supported region](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/veo/3-1-generate)
- [Google REST generation and polling examples](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/generate-videos-from-text)
- [Google Gen AI SDK video configuration](https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateVideosConfig.html)
- [Application Default Credentials for local development](https://docs.cloud.google.com/docs/authentication/set-up-adc-local-dev-environment)
