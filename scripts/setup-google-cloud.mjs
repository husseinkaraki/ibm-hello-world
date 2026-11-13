import { createPrivateKey, randomBytes } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const credentialSecret = 'veo-google-credentials';
const jobSecret = 'veo-job-signing';
const passwordSecret = 'veo-demo-access';
const mount = '/var/run/secrets/google-cloud';
class SetupError extends Error {}

export function runIBM(args, { input } = {}) {
  const local = join(homedir(), '.local/bin/ibmcloud');
  const cli = process.env.IBMCLOUD_CLI || (existsSync(local) ? local : 'ibmcloud');
  // Capture both streams: a failed secret command must not echo its payload.
  const env = { ...process.env };
  delete env.IBMCLOUD_TRACE;
  const result = spawnSync(cli, args, { input, env, encoding: 'utf8' });
  if (result.error) throw new SetupError('IBM Cloud CLI could not run. Install it or set IBMCLOUD_CLI.');
  if (result.status !== 0) throw new SetupError(`IBM Cloud ${args.slice(0, 3).join(' ')} failed (exit ${result.status}). CLI output was withheld to protect credentials.`);
  return result.stdout;
}

function json(text) {
  try { return JSON.parse(text); }
  catch { throw new SetupError('Unreadable JSON; file or CLI contents were not printed.'); }
}

function repositoryRoots() {
  try {
    return execFileSync('git', ['worktree', 'list', '--porcelain', '-z'], { cwd: root, encoding: 'utf8' })
      .split('\0').filter(line => line.startsWith('worktree ')).map(line => line.slice(9));
  } catch { return [root]; }
}

function externalFile(path, roots) {
  if (!path || !isAbsolute(path)) throw new SetupError('Supply an absolute credential/password file path outside every Git worktree.');
  let actual;
  try { actual = realpathSync(path); } catch { throw new SetupError('The supplied file is not accessible.'); }
  const inside = (file, directory) => {
    const part = relative(directory, file);
    return part === '' || (part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part));
  };
  if (roots.some(directory => inside(resolve(path), directory) || inside(actual, directory))) {
    throw new SetupError('Keep credential and password files outside every Git worktree, such as ~/.config/ibm-veo/.');
  }
  try { return readFileSync(actual); } catch { throw new SetupError('The supplied file could not be read.'); }
}

function credentialData(bytes) {
  const credential = json(bytes.toString('utf8'));
  if (credential?.type === 'service_account' && [credential.client_email, credential.private_key, credential.token_uri].every(value => typeof value === 'string' && value)) {
    try { createPrivateKey(credential.private_key); }
    catch { throw new SetupError('The service-account file does not contain a valid private key.'); }
  } else if (credential?.type === 'external_account' && [credential.audience, credential.subject_token_type, credential.token_url].every(value => typeof value === 'string' && value) && credential.credential_source && typeof credential.credential_source === 'object' && !Array.isArray(credential.credential_source)) {
    // WIF's subject-token source must already work inside the IBM container.
  } else {
    throw new SetupError('Use a trusted Google service-account JSON or Workload Identity Federation configuration, not an API key or local user ADC file.');
  }
}

function passwordValue(value) {
  const password = value.replace(/\r?\n$/, '');
  if (password.length < 16 || /[\r\n]/.test(password)) throw new SetupError('Choose a single-line demo password of at least 16 characters.');
  return password;
}

async function promptPassword() {
  if (!process.stdin.isTTY) throw new SetupError('For the first setup, run interactively or supply --demo-password-file with an existing file outside Git.');
  const muted = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const reader = createInterface({ input: process.stdin, output: muted, terminal: true, historySize: 0 });
  try {
    process.stderr.write('Demo password (16+ characters; hidden): ');
    const first = await reader.question('');
    process.stderr.write('\nConfirm demo password (hidden): ');
    const second = await reader.question('');
    process.stderr.write('\n');
    if (first !== second) throw new SetupError('The demo passwords did not match.');
    return passwordValue(first);
  } finally { reader.close(); }
}

export async function setupGoogleCloud(options, dependencies = {}) {
  const run = dependencies.run || runIBM;
  const log = dependencies.log || console.log;
  const roots = dependencies.roots || repositoryRoots();
  if (!/^(?:[a-z][a-z0-9-]{4,61}[a-z0-9]|\d+)$/.test(options.project || '') || options.project === 'your-project-id') {
    throw new SetupError('Supply the real Google Cloud project ID or project number with --project.');
  }
  const credentials = externalFile(options.credentials, roots);
  credentialData(credentials);
  let password = options.demoPasswordFile ? passwordValue(externalFile(options.demoPasswordFile, roots).toString('utf8')) : undefined;
  const app = process.env.CE_APP_NAME || 'hello-world';
  // Disable file-based HTTP tracing before any authenticated secret request.
  run(['config', '--trace', 'false']);
  run(['target', '-c', process.env.IBM_CLOUD_ACCOUNT_ID || '2142ae6722f5478e9f37cf83403b9cbe', '-r', process.env.CE_REGION || 'eu-es', '-g', process.env.CE_RESOURCE_GROUP || 'Default']);
  run(['ce', 'project', 'select', '--name', process.env.CE_PROJECT_NAME || 'watsonx-Hackathon Code Engine']);
  json(run(['ce', 'app', 'get', '--name', app, '--output', 'json']));
  const listing = json(run(['ce', 'secret', 'list', '--format', 'generic', '--output', 'json']));
  const names = new Set(listing.secrets.map(secret => secret.name));
  const requireKey = (name, key, minimum) => {
    const secret = json(run(['ce', 'secret', 'get', '--name', name, '--output', 'json']));
    // The CLI's JSON API returns plain values; its table output uses base64.
    const value = secret.data?.[key];
    if (typeof value !== 'string' || value.length < minimum) {
      throw new SetupError(`Existing secret ${name} lacks a usable ${key}; its contents were not printed.`);
    }
  };
  if (names.has(jobSecret)) requireKey(jobSecret, 'VEO_JOB_SECRET', 32);
  if (names.has(passwordSecret) && !password) requireKey(passwordSecret, 'VEO_DEMO_PASSWORD', 1);
  if (!names.has(passwordSecret) && !password) password = passwordValue(await (dependencies.promptPassword || promptPassword)());

  const save = (name, key, value) => {
    run(['ce', 'secret', names.has(name) ? 'update' : 'create', '--name', name,
      ...(!names.has(name) ? ['--format', 'generic'] : []), '--from-file', `${key}=/dev/stdin`], { input: value });
  };
  save(credentialSecret, 'credentials.json', credentials);
  log('Google credential saved as an IBM runtime secret; contents withheld.');
  if (!names.has(jobSecret)) {
    save(jobSecret, 'VEO_JOB_SECRET', Buffer.from(randomBytes(32).toString('base64url')));
    log('Stable job-signing secret created.');
  } else log('Existing job-signing secret preserved.');
  if (password) save(passwordSecret, 'VEO_DEMO_PASSWORD', Buffer.from(password));
  else log('Existing demo password preserved.');
  log('Deploying credential mounts and secret-backed environment variables...');
  run(['ce', 'app', 'update', '--name', app,
    '--mount-secret', `${mount}=${credentialSecret}`,
    '--env', `GOOGLE_APPLICATION_CREDENTIALS=${mount}/credentials.json`,
    '--env', `GOOGLE_CLOUD_PROJECT=${options.project}`,
    '--env', 'GOOGLE_CLOUD_LOCATION=us-central1',
    '--env-from-secret', `${jobSecret}:VEO_JOB_SECRET`,
    '--env-from-secret', `${passwordSecret}:VEO_DEMO_PASSWORD`,
    '--revision-name', `${app.slice(0, 40)}-cfg-${Date.now().toString(36)}`,
    '--wait-timeout', '600']);
  log('Runtime secret bindings deployed. Check /api/veo for OAuth readiness; no video generation was submitted.');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const { values } = parseArgs({ options: { project: { type: 'string' }, credentials: { type: 'string' }, 'demo-password-file': { type: 'string' }, help: { type: 'boolean' } } });
    if (values.help) console.log('Usage: node scripts/setup-google-cloud.mjs --project PROJECT_ID --credentials /absolute/path/to/credentials.json [--demo-password-file /absolute/path/to/password.txt]\nRun after CI deployment finishes. The first setup prompts privately for the demo password; later runs reuse it unless a password file is supplied.');
    else await setupGoogleCloud({ project: values.project, credentials: values.credentials, demoPasswordFile: values['demo-password-file'] });
  } catch (error) {
    console.error(error instanceof SetupError ? error.message : 'Setup failed; credential details were withheld. Check the documented options and IBM access.');
    process.exitCode = 1;
  }
}
