# Google credentials on IBM Code Engine

The app uses Google Cloud OAuth through Application Default Credentials (ADC). A Gemini Developer API key does not configure this integration. Its Google project is **`mich-devfest-hackathon`** and its Google location is **`us-central1`**. IBM hosting remains in **`eu-es`**; these regions are independent.

The Google credential belongs in a **Code Engine runtime secret**, mounted as a file. It is not needed by GitHub Actions or the Docker build. The existing GitHub `IBM_CLOUD_API_KEY` only authenticates deployments to IBM.

## Obtain the Google credential

For a hackathon service-account credential:

1. Select **Mich DevFest Hackathon** (`mich-devfest-hackathon`) in the [Google Cloud console](https://console.cloud.google.com/). Confirm billing and enable `aiplatform.googleapis.com`. Model access and quota are separate from having a credential.
2. Under **IAM & Admin → Service accounts**, create a dedicated account, for example `veo-demo`, with project role **`roles/aiplatform.user`** (shown as Vertex AI User / Agent Platform User). Grant service-usage permission if the project requires it. The app needs no storage bucket role for its current inline-image/video flow. Do not grant Owner or Editor for this setup.
3. Open that account's **Keys** tab, choose **Add key → Create new key**, select **JSON**, and download it. Move it outside every repository/worktree, for example to `~/.config/ibm-veo/google-credentials.json`. Restrict the directory to mode `700` and the file to `600`. The private-key contents must not go into chat, Git, `.env.example`, or a browser bundle.

Google documents [service-account key creation](https://docs.cloud.google.com/iam/docs/keys-create-delete) and the required [project role](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/start?hl=en). If organization policy prevents key creation, use an administrator-approved identity rather than disabling that policy.

For an existing **Workload Identity Federation** setup, supply its trusted ADC JSON configuration instead. The Google trust configuration, service-account access, and a renewable `credential_source` must already work **inside the IBM container**. A configuration that points at a token file on your laptop or a GitHub Actions OIDC token will not work by itself on Code Engine. This helper uploads only the configuration file; it does not provision a federation provider, copy subject-token files, or enable executable credential sources. See [Google's WIF setup](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-other-providers).

`gcloud auth application-default login` remains useful for local development. This production helper intentionally accepts service-account/WIF files rather than uploading a user's local refresh-token ADC file. See [ADC file discovery](https://docs.cloud.google.com/docs/authentication/application-default-credentials).

## Install it using IBM CLI

Use Node.js 24 and the IBM Cloud CLI with the Code Engine plug-in. Run **after the current CI deployment has finished** so a runtime configuration change cannot race the deployment's preservation check.

From the repository or this chat's managed deployment worktree:

```sh
node scripts/setup-google-cloud.mjs \
  --project mich-devfest-hackathon \
  --credentials "$HOME/.config/ibm-veo/google-credentials.json"
```

On the first setup, the helper asks for and confirms a demo password with input hidden. Use at least 16 characters. Later runs reuse the existing password and job-signing key unless a replacement password file is explicitly supplied.

For unattended setup, provide an existing single-line password file outside Git:

```sh
node scripts/setup-google-cloud.mjs \
  --project mich-devfest-hackathon \
  --credentials "$HOME/.config/ibm-veo/google-credentials.json" \
  --demo-password-file "$HOME/.config/ibm-veo/demo-password.txt"
```

The password is not a command-line argument. The helper reads the file into memory, removes one final newline if present, and sends its bytes to the IBM CLI over stdin. It does not print passwords, private keys, raw CLI secret responses, or tokens. It refuses credential/password files inside any Git worktree, including the original checkout, and disables IBM CLI HTTP tracing before uploading secrets.

The helper targets the existing hackathon IBM account, resource group, project, and app. `IBM_CLOUD_ACCOUNT_ID`, `CE_REGION`, `CE_RESOURCE_GROUP`, `CE_PROJECT_NAME`, `CE_APP_NAME`, and `IBMCLOUD_CLI` override those defaults. It neither creates a cloud plan nor submits a Veo generation.

## Runtime bindings

| IBM secret | Contents / binding |
| --- | --- |
| `veo-google-credentials` | The supplied file under key `credentials.json`, mounted at `/var/run/secrets/google-cloud/credentials.json` |
| `veo-job-signing` | A random `VEO_JOB_SECRET`, generated once and reused across revisions/instances |
| `veo-demo-access` | `VEO_DEMO_PASSWORD`, exposed only as a secret-backed server environment variable |

Plain server environment configuration is `GOOGLE_CLOUD_PROJECT=mich-devfest-hackathon`, `GOOGLE_CLOUD_LOCATION=us-central1`, and `GOOGLE_APPLICATION_CREDENTIALS=/var/run/secrets/google-cloud/credentials.json`. None uses `NEXT_PUBLIC_`.

Re-running the helper updates the Google credential secret and creates a fresh application revision. It preserves the signing key so existing signed job references remain readable; it does not silently rotate it. A password file supplied on a later run intentionally replaces the demo password. Do not set `VEO_TRUSTED_PRIVATE_DEPLOYMENT=true` for this public app; the helper uses the demo password instead.

The underlying IBM operations are `ce secret create/update --from-file KEY=/dev/stdin`, `ce app update --mount-secret DIRECTORY=SECRET`, and `--env-from-secret SECRET:KEY`. Secret values are sent through stdin, not shell arguments or temporary upload files. See IBM's [environment variables](https://cloud.ibm.com/docs/codeengine?topic=codeengine-envvar) and [secret file mounts](https://cloud.ibm.com/docs/codeengine?topic=codeengine-secretcm-reference-mountedfiles).

## CI behavior and verification

CI only updates the app image/build and runtime resource allocation. Its 60-second HTTP request timeout accommodates the Veo route's 45-second upstream calls. It does not replace/remove runtime environment variables or secret mounts. The deploy script compares the runtime bindings before and after an update and fails with a value-free message if they change unexpectedly. Do not run the setup helper during a CI rollout. Google keys, passwords, and signing keys are not GitHub Actions secrets.

Docker and Code Engine source allowlists include the app's `lib/` server code and exclude `.env*`, credential directories/files, and private-key formats, including nested files. The setup helper and documentation are not included in the image build context.

After a successful setup, open [Scene Lab](https://hello-world.2h3l0fzdglyt.eu-es.codeengine.appdomain.cloud/veo). Its `GET /api/veo` readiness check attempts Google OAuth authentication without starting a paid generation. A ready response verifies token acquisition, not Veo model access, quota, billing eligibility, or a completed generated video. Testing one real clip is a separate step.

## Installation status

The Google project is known. Supply the **absolute local path to the real service-account/WIF credential file** when executing setup. An operator can generate a demo password in the external, mode-`600` file above and report only its location. Local helper tests use temporary fixtures and a fake CLI; they install no real Google credential. Merging this helper alone does not install a credential; the setup command must complete against IBM. Project-specific `mich-devfest-hackathon-*.json` exclusions also protect downloaded credentials in the original IBM/Bob workspace and in repository/build contexts.
