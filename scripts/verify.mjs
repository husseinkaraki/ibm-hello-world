import assert from 'node:assert/strict';

const base = process.argv[2];
if (!base || new URL(base).protocol !== 'https:') {
  throw new Error('Usage: node scripts/verify.mjs https://YOUR_IBM_APPLICATION_URL');
}
const home = await fetch(new URL('/', base), { signal: AbortSignal.timeout(120_000) });
assert.equal(home.status, 200, 'Home endpoint must return HTTP 200');
assert.match(home.headers.get('content-type'), /^text\/html/);
const html = await home.text();
assert.match(html, /<h1>Hello World!<\/h1>/);
assert.match(html, /Your Next\.js application is running/);
const health = await fetch(new URL('/health', base), { signal: AbortSignal.timeout(30_000) });
assert.equal(health.status, 200, 'Health endpoint must return HTTP 200');
const status = await health.json();
assert.equal(status.status, 'ok');
assert.equal(status.app, 'ibm-hello-world');
assert.equal(status.framework, 'Next.js');
assert.equal(status.language, 'TypeScript');
assert.match(status.nextVersion, /^16\./);
const cssPath = html.match(/href="([^\"]+\.css(?:\?[^\"]*)?)"/)?.[1];
assert.ok(cssPath, 'Page must include a generated stylesheet');
const css = await fetch(new URL(cssPath.replaceAll('&amp;', '&'), base), { signal: AbortSignal.timeout(30_000) });
assert.equal(css.status, 200, 'Next.js stylesheet must be accessible');
assert.match(css.headers.get('content-type'), /^text\/css/);
console.log(`Verified Next.js ${status.nextVersion} / TypeScript, health JSON, and CSS over HTTPS at ${base}`);
