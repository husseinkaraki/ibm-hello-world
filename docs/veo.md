# Scene Lab — Google Veo integration

A small TypeScript / Next.js page at `/veo`: an optional JPEG/PNG starting frame plus a scene prompt creates **one real Veo 3.1 Fast job** on Google Cloud. Submission, status polling, and MP4 playback use server-side API routes. No Colab runtime, Gemini Developer API key, storage bucket, or local job database is required.

## Run locally

Use Node.js 24 or newer:

```sh
npm install
npm run dev
```

Open [Scene Lab](http://localhost:8080/veo). The page and photo preview work without credentials; generation stays disabled with an honest connection message. A completed video appears only after Google returns one.

## Connect Google Cloud

1. Select the Google Cloud project holding your credits. It needs billing and the [Vertex AI / Agent Platform API](https://console.cloud.google.com/flows/enableapi?apiid=aiplatform.googleapis.com) enabled. The calling identity needs the `roles/aiplatform.user` role and permission to consume services in that project.
2. Install the [official Google Cloud CLI](https://docs.cloud.google.com/sdk/docs/install) if needed, then authenticate local Application Default Credentials:

   ```sh
   gcloud auth application-default login
   gcloud auth application-default set-quota-project YOUR_PROJECT_ID
   ```

3. Set `GOOGLE_CLOUD_PROJECT` in your ignored `.env` or `.env.local`. Set `GOOGLE_CLOUD_LOCATION=us-central1` and a random `VEO_JOB_SECRET` of at least 32 characters. Use `.env.example` as a template without overwriting existing secret files. Signing keys and Google credentials are not copied between worktrees. To generate a new signing secret: `openssl rand -hex 32`.
4. Restart the dev server, load `/veo`, and generate one short clip. A Gemini Developer API key alone does not configure this Google Cloud OAuth integration.

The fixed preset is `veo-3.1-fast-generate-001`, one 4-second, 16:9, 720p clip, `generateAudio: false`, and `personGeneration: allow_adult`. The optional upload is the **first frame**, rather than a separate identity-reference system. Photo uploads are capped at 5 MB and checked for JPEG/PNG signatures. Use [Google's current pricing](https://cloud.google.com/model-garden/pricing#veo) to check costs; each new submission is paid. Status polling never resubmits a generation.

## Server behavior

| Endpoint | Behavior |
| --- | --- |
| `GET /api/veo` | Checks configuration and ADC token availability, without a paid generation. This does not prove model permissions, quota, or billing. |
| `POST /api/veo` | Multipart `prompt` and optional `image`; returns HTTP 202 with a signed `job` reference. Optional demo password is sent in `x-veo-password`. |
| `GET /api/veo/status?job=…` | Checks Google's long-running operation and returns `pending`, `complete`, or a real error. |
| `GET /api/veo/video?job=…` | Fetches Google's finished bytes and serves private MP4, including byte-range support for the browser player. |

The browser polls every 10 seconds. It stores only the signed job reference locally, so a refresh can resume checking the same job. Photo and prompt are not written to local storage. Transient polling failures offer **Check this clip again** without creating new paid work. After 15 minutes, automatic polling pauses; manual checking remains available. Job references expire after 24 hours. Videos and selfie bytes are not persisted by this app; save the MP4 after generation.

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

The nine Veo tests cover the documented request/operation shapes, filtered and failed jobs, image/prompt validation, signed capability expiry/tampering, and MP4 ranges. The shared app also runs its four existing production runtime tests (13 total). Their video bytes are labeled fixtures and do not represent a generated video. Browser checks cover the actual local upload/form layout and missing-configuration state.

**Live generation status:** not verified. This machine had no `gcloud`, Google Cloud project setting, or Application Default Credentials when inspected. No paid generation was submitted. Local builds and passing fixtures do not prove account access.

## Feature boundaries

This feature adds `app/veo`, `app/api/veo`, three `lib/veo-*` modules, and `tests/veo.test.ts` to the canonical Next.js app. The home page, root layout, health route, Dockerfile, and deployment workflow are preserved. Production dependencies are `google-auth-library@11.3.4` and `server-only@0.0.1`. The TypeScript configuration allows explicit TypeScript imports for Node 24 tests. The container allowlist includes `lib/`, followed by secret-file exclusions.

The application was prepared against canonical base `37fbd53ecfc3311aa4b66e61674a16bea1081d2f`. Account access remains a separate runtime requirement; builds and tests do not start paid jobs.

## Official references

- [User-supplied Google notebook source](https://github.com/GoogleCloudPlatform/generative-ai/blob/main/vision/getting-started/veo3_video_generation.ipynb)
- [Stable Veo 3.1 models and supported region](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/veo/3-1-generate)
- [Google REST generation and polling examples](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/generate-videos-from-text)
- [Google Gen AI SDK video configuration](https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateVideosConfig.html)
- [Application Default Credentials for local development](https://docs.cloud.google.com/docs/authentication/set-up-adc-local-dev-environment)
