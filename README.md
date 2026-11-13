# Next.js Hello World on IBM Cloud

A minimal TypeScript + Next.js 16 App Router application for IBM Cloud Code Engine. `/` serves the Hello World page; `/health` returns the application identity, framework version, and health status.

Source repository: [husseinkaraki/ibm-hello-world](https://github.com/husseinkaraki/ibm-hello-world) (private).

IBM application URL: <https://hello-world.2h3l0fzdglyt.eu-es.codeengine.appdomain.cloud>. The final Next.js deployment verification is recorded in the chat; the earlier plain Node proof has been replaced in this source.

## Run locally

Use Node.js 24 or newer. From this machine:

```sh
cd /Users/karaki/dev/ibm/hello-world
npm ci
npm run dev
```

Open <http://localhost:8080>. Stop the server with Control-C.

To build and run the production version:

```sh
npm run build
npm run check
npm test
npm start
```

`npm test` starts its own production standalone server on a temporary local port and checks the rendered HTML, generated CSS, health route, HEAD requests, 404s, and method rejection. Build before running these tests. No test server remains running afterward. `npm start` serves the production build on port 8080.

## Deploy to IBM

The project uses IBM Cloud CLI and its `code-engine` plug-in. On this machine, the CLI is at `~/.local/bin/ibmcloud`. Authentication is already configured for the hackathon account; to authenticate again without putting a password in shell history:

```sh
~/.local/bin/ibmcloud config --sso-otp auto
~/.local/bin/ibmcloud login --sso -r eu-es
```

Then run:

```sh
./deploy.sh auto
```

The deploy script selects the existing project, creates or updates the application, builds its Dockerfile remotely, and waits for readiness. A local Docker daemon is not required. The multi-stage Dockerfile builds Next.js and runs its standalone Node server as a non-root user. Client assets are copied beside the standalone server.

Defaults, overridable through environment variables or GitHub Actions repository variables:

| Variable | Default |
| --- | --- |
| `CE_REGION` | `eu-es` |
| `CE_RESOURCE_GROUP` | `Default` |
| `CE_PROJECT_NAME` | `watsonx-Hackathon Code Engine` |
| `CE_APP_NAME` | `hello-world` |
| `CE_REGISTRY` | `es.icr.io` |
| `CE_REGISTRY_NAMESPACE` | `ibm-hello-2142ae67` |
| `CE_REGISTRY_SECRET` | `hello-world-registry` |

`IBMCLOUD_CLI` can override the local CLI path. Images use the Git commit SHA in CI and a timestamp for local deployments. The existing project and registry credential must be available in the selected IBM account.

The runtime uses **0.125 vCPU, 0.25 GB RAM, minimum scale 0, maximum scale 1**, and port 8080. The remote build uses the small size with a 600-second timeout. An idle application can have a cold start. Free allowances depend on account-wide usage; the instance limit is not a spending cap, and retained registry images can incur storage charges. No account upgrade is performed by the script.

## GitHub Actions

`.github/workflows/deploy.yml` runs on pushes to `main`, pull requests, and manual dispatch:

1. Install locked dependencies, build the production Next.js app, type-check it, and run real HTTP checks against the standalone server.
2. For `main` pushes and manual runs on `main`, authenticate to IBM, remotely build the Dockerfile, and deploy the new image.
3. Verify the live HTTPS page, generated stylesheet, and health JSON. Add the verified URL to the Actions run summary.

Pull requests only run checks. Deployments are serialized, and a failed build or test prevents deployment. Official GitHub Actions are pinned to commit SHAs. The workflow has read-only repository contents permission.

The encrypted repository secret `IBM_CLOUD_API_KEY` is configured. It is not committed or passed in a command-line argument. A matching registry credential is stored in IBM Code Engine as `hello-world-registry`. This dedicated **user API key expires December 13, 2026** and inherits that IBM user's permissions; it is not a project-scoped service identity. Rotate it in both locations before expiry to keep CI and future cold starts working. IBM account permissions did not permit automatic assignment of registry service-ID policies, so deployment uses the explicitly configured registry credential.

Verify a live deployment yourself:

```sh
node scripts/verify.mjs https://hello-world.2h3l0fzdglyt.eu-es.codeengine.appdomain.cloud
```

## Environment files and Bob

This Hello World app requires no secrets. `.env.example` contains comments and placeholders only. Keep real development values in `.env.local`; do not prefix secrets with `NEXT_PUBLIC_`, which would make them available to browser code. Production runtime credentials belong in IBM Code Engine secrets and secret-backed environment variables.

`.bobignore` is present both in this repository and at `/Users/karaki/dev/ibm/.bobignore`, so either workspace root excludes `.env`, `.env.local`, and other `.env.*` files. `.gitignore` excludes the same files while allowing a sanitized `.env.example`. Docker and Code Engine uploads use explicit source allowlists and final environment-file exclusions, including files nested in the app directory. They do not upload `.env.example` either.

IBM documents `.bobignore` as gitignore syntax. It controls Bob's file tools; arbitrary shell commands and explicit file mentions can bypass those context restrictions, so it is not a complete secret sandbox.

## Cleanup

After selecting the correct project, `ibmcloud ce app delete --name hello-world` removes the application. Inspect and remove this demo's specific images in the `ibm-hello-2142ae67` registry namespace when no longer needed. Retained image tags can accumulate after deployments. Do not delete the shared hackathon project or other apps. Revoke the demo API key and delete its GitHub/Code Engine credentials when retiring CI.

## Official documentation

- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [IBM Code Engine local-source deployment](https://cloud.ibm.com/docs/codeengine?topic=codeengine-app-local-source-code)
- [IBM registry permissions](https://cloud.ibm.com/docs/codeengine?topic=codeengine-add-registry)
- [IBM Code Engine pricing](https://cloud.ibm.com/docs/codeengine?topic=codeengine-pricing)
- [GitHub Actions encrypted secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)
- [IBM Bob ignore files](https://bob.ibm.com/docs/ide/configuration/bobignore)
