import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { after, before, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

let server;
let base;

before(async () => {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['.next/standalone/server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), HOSTNAME: '127.0.0.1', NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  server.on('error', error => { throw error; });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Production server exited early: ${server.exitCode}`);
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(500) });
      if (response.status === 200) return;
    } catch { /* Wait for the production server to become ready. */ }
    await delay(100);
  }
  throw new Error('Production server startup timed out');
});

after(async () => {
  if (server && server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    await exited;
  }
});

test('production Next.js page serves HTML and its stylesheet', async () => {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^text\/html/);
  const html = await response.text();
  assert.match(html, /<h1>Hello World!<\/h1>/);
  assert.match(html, /Your Next\.js application is running/);
  const cssPath = html.match(/href="([^\"]+\.css(?:\?[^\"]*)?)"/)?.[1];
  assert.ok(cssPath, 'Page must include a generated stylesheet');
  const css = await fetch(new URL(cssPath.replaceAll('&amp;', '&'), base));
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type'), /^text\/css/);
});

test('health identifies the Next.js and TypeScript application', async () => {
  const response = await fetch(`${base}/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const status = await response.json();
  assert.equal(status.status, 'ok');
  assert.equal(status.app, 'ibm-hello-world');
  assert.equal(status.framework, 'Next.js');
  assert.equal(status.language, 'TypeScript');
  assert.match(status.nextVersion, /^16\./);
});

test('HEAD succeeds without sending a response body', async () => {
  const response = await fetch(base, { method: 'HEAD' });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
});

test('unknown routes and unsupported methods have correct HTTP status', async () => {
  const missing = await fetch(`${base}/missing`);
  assert.equal(missing.status, 404);
  const post = await fetch(`${base}/health`, { method: 'POST' });
  assert.equal(post.status, 405);
});
