import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const localCli = join(homedir(), '.local/bin/ibmcloud');
const cli = process.env.IBMCLOUD_CLI || (existsSync(localCli) ? localCli : 'ibmcloud');
const appName = process.env.CE_APP_NAME || 'hello-world';
let action = process.argv[2] || 'auto';
if (!['auto', 'create', 'update'].includes(action)) {
  console.error('Usage: ./deploy.sh [auto|create|update]');
  process.exit(2);
}

function run(args, capture = false) {
  const result = spawnSync(cli, args, capture ? { encoding: 'utf8' } : { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture) console.error(result.stderr || 'IBM Cloud command failed.');
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

run(['target', '-r', process.env.CE_REGION || 'eu-es', '-g', process.env.CE_RESOURCE_GROUP || 'Default']);
run(['ce', 'project', 'select', '--name', process.env.CE_PROJECT_NAME || 'watsonx-Hackathon Code Engine']);
if (action === 'auto') {
  const apps = JSON.parse(run(['ce', 'app', 'list', '--output', 'json'], true));
  action = apps.items.some(app => app.metadata.name === appName) ? 'update' : 'create';
}

const registry = process.env.CE_REGISTRY || 'es.icr.io';
const namespace = process.env.CE_REGISTRY_NAMESPACE || 'ibm-hello-2142ae67';
const tag = process.env.GITHUB_SHA || `local-${new Date().toISOString().replace(/[^0-9]/g, '')}`;
const args = [
  'ce', 'application', action,
  '--name', appName,
  '--build-source', fileURLToPath(new URL('..', import.meta.url)),
  '--build-strategy', 'dockerfile',
  '--build-size', 'small',
  '--build-timeout', '600',
  '--image', `${registry}/${namespace}/${appName}:${tag}`,
  '--registry-secret', process.env.CE_REGISTRY_SECRET || 'hello-world-registry',
  '--cpu', '0.125',
  '--memory', '0.25G',
  '--min-scale', '0',
  '--max-scale', '1',
  '--port', '8080',
  '--visibility', 'public',
  '--request-timeout', '30',
  '--wait-timeout', '900',
];
if (action === 'update') args.push('--commands-clear', '--arguments-clear');
run(args);
