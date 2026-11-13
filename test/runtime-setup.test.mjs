import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runtimeBindingFingerprint } from '../scripts/runtime-bindings.mjs';
import { runIBM, setupGoogleCloud } from '../scripts/setup-google-cloud.mjs';

// Temporary, nonfunctional credentials exercise the helper against a fake CLI.
// No test contacts IBM or Google or uploads any credential.
function fixture(body) {
  const directory = mkdtempSync(join(tmpdir(), 'ibm-runtime-test-'));
  const credential = join(directory, 'credential.json');
  writeFileSync(credential, JSON.stringify(body || {
    type: 'external_account', audience: '//iam.googleapis.com/projects/123456789/locations/global/workloadIdentityPools/example/providers/example',
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt', token_url: 'https://sts.googleapis.com/v1/token',
    credential_source: { file: '/var/run/subject-token' },
  }));
  return { directory, credential, cleanup: () => rmSync(directory, { recursive: true, force: true }) };
}

test('setup sends secrets only over stdin and preserves the signing key on rerun', async () => {
  const files = fixture();
  const secrets = new Map();
  const calls = [];
  const messages = [];
  const run = (args, options = {}) => {
    calls.push({ args, input: options.input });
    if (args[1] === 'secret' && args[2] === 'list') return JSON.stringify({ secrets: [...secrets.keys()].map(name => ({ name })) });
    if (args[1] === 'secret' && args[2] === 'get') return JSON.stringify({ data: secrets.get(args[args.indexOf('--name') + 1]) });
    if (args[1] === 'secret' && ['create', 'update'].includes(args[2])) {
      const name = args[args.indexOf('--name') + 1];
      const source = args[args.indexOf('--from-file') + 1];
      assert.ok(source.endsWith('=/dev/stdin'));
      secrets.set(name, { [source.split('=')[0]]: Buffer.from(options.input).toString('utf8') });
    }
    return '{}';
  };
  const dependencies = { run, roots: [], log: message => messages.push(message) };
  try {
    await setupGoogleCloud({ project: 'example-project', credentials: files.credential }, dependencies);
    const signing = secrets.get('veo-job-signing').VEO_JOB_SECRET;
    assert.ok(signing.length >= 32);
    assert.ok(!JSON.stringify(calls.map(call => call.args)).includes(signing));
    assert.ok(!messages.join('\n').includes(signing));
    const update = calls.find(call => call.args[1] === 'app' && call.args[2] === 'update').args;
    assert.ok(update.includes('/var/run/secrets/google-cloud=veo-google-credentials'));
    assert.ok(update.includes('GOOGLE_APPLICATION_CREDENTIALS=/var/run/secrets/google-cloud/credentials.json'));
    assert.ok(update.includes('GOOGLE_CLOUD_LOCATION=us-central1'));
    assert.ok(update.includes('veo-job-signing:VEO_JOB_SECRET'));
    assert.ok(!update.includes('--visibility'));
    const count = calls.length;
    await setupGoogleCloud({ project: 'example-project', credentials: files.credential }, dependencies);
    assert.ok(secrets.get('veo-job-signing').VEO_JOB_SECRET === signing);
    assert.ok(!calls.slice(count).some(call => ['create', 'update'].includes(call.args[2]) && call.args.includes('veo-job-signing')));
    // Existing signing strings are plain JSON values, not base64.
    secrets.set('veo-job-signing', { VEO_JOB_SECRET: 'fixture'.padEnd(32, '!') });
    await setupGoogleCloud({ project: 'example-project', credentials: files.credential }, dependencies);
  } finally { files.cleanup(); }
});

test('service-account credentials are accepted and user ADC/API-key files are rejected before cloud access', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const files = fixture({ type: 'service_account', client_email: 'fixture@example.invalid', token_uri: 'https://oauth2.googleapis.com/token', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
  let called = false;
  try {
    await assert.rejects(setupGoogleCloud({ project: 'example-project', credentials: files.credential }, {
      roots: [], run: () => { called = true; throw new Error('stop before cloud access'); },
    }), /stop before cloud access/);
    assert.ok(called);
    for (const body of [{ type: 'authorized_user', refresh_token: 'fixture-only' }, { api_key: 'fixture-only' }, null]) {
      writeFileSync(files.credential, JSON.stringify(body));
      await assert.rejects(setupGoogleCloud({ project: 'example-project', credentials: files.credential }, {
        roots: [], run: () => { throw new Error('must not reach cloud'); },
      }), /service-account JSON or Workload Identity Federation/);
    }
  } finally { files.cleanup(); }
});

test('credentials inside any worktree are rejected without uploading', async () => {
  const files = fixture();
  try {
    await assert.rejects(setupGoogleCloud({ project: 'example-project', credentials: files.credential }, {
      roots: [files.directory], run: () => { throw new Error('must not reach cloud'); },
    }), /outside every Git worktree/);
  } finally { files.cleanup(); }
});

test('a failing IBM command cannot leak its output into the helper error', () => {
  const old = process.env.IBMCLOUD_CLI;
  const files = fixture();
  try {
    const cli = join(files.directory, 'fake-cli');
    writeFileSync(cli, '#!/bin/sh\nprintf "fixture-secret-must-not-escape" >&2\nexit 1\n', { mode: 0o700 });
    process.env.IBMCLOUD_CLI = cli;
    assert.throws(() => runIBM(['ce', 'secret', 'create']), error => {
      assert.match(error.message, /output was withheld/);
      assert.ok(!error.message.includes('fixture-secret-must-not-escape'));
      return true;
    });
  } finally {
    if (old === undefined) delete process.env.IBMCLOUD_CLI; else process.env.IBMCLOUD_CLI = old;
    files.cleanup();
  }
});

test('image changes preserve the binding fingerprint while removed or changed secret references do not', () => {
  const app = { spec: { template: { spec: { containers: [{ name: 'app', image: 'old', env: [{ name: 'GOOGLE_CLOUD_PROJECT', value: 'example-project' }], envFrom: [{ secretRef: { name: 'veo-job-signing' } }], volumeMounts: [{ name: 'google', mountPath: '/var/run/secrets/google-cloud' }] }], volumes: [{ name: 'google', secret: { secretName: 'veo-google-credentials' } }] } } } };
  const updated = structuredClone(app);
  updated.spec.template.spec.containers[0].image = 'new';
  assert.equal(runtimeBindingFingerprint(app), runtimeBindingFingerprint(updated));
  updated.spec.template.spec.volumes = [];
  assert.notEqual(runtimeBindingFingerprint(app), runtimeBindingFingerprint(updated));
  const changed = structuredClone(app);
  changed.spec.template.spec.containers[0].envFrom[0].secretRef.name = 'wrong-signing-secret';
  assert.notEqual(runtimeBindingFingerprint(app), runtimeBindingFingerprint(changed));
});

test('Code Engine upload includes the Veo server library and excludes nested credentials', () => {
  const files = fixture();
  const rules = fileURLToPath(new URL('../.ceignore', import.meta.url));
  try {
    const repo = join(files.directory, 'repo');
    mkdirSync(repo);
    execFileSync('git', ['init', '-q', repo]);
    for (const [name, ignored] of [['lib/veo-server.ts', false], ['content/finding-love-at-a-hackathon/media/lucy.png', false], ['content/finding-love-at-a-hackathon/media/credentials.json', true], ['content/finding-love-at-a-hackathon/shot-data/episode-01.json', false], ['content/finding-love-at-a-hackathon/shot-data/credentials.json', true], ['lib/credentials.json', true], ['app/.env.local', true], ['app/service-account.json', true], ['secrets/google.json', true], ['mich-devfest-hackathon-example.json', true], ['lib/mich-devfest-hackathon-example.json', true]]) {
      const result = spawnSync('git', ['-C', repo, '-c', `core.excludesFile=${rules}`, 'check-ignore', '--no-index', '-q', '--', name]);
      assert.equal(result.status, ignored ? 0 : 1, name);
    }
    assert.equal(readFileSync(rules, 'utf8'), readFileSync(new URL('../.dockerignore', import.meta.url), 'utf8'));
  } finally { files.cleanup(); }
});
