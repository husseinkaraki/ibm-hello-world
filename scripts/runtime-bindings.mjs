import { createHash } from 'node:crypto';

const sorted = values => [...(values || [])].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

// Keep values in process memory; never include them in errors or CI output.
export function runtimeBindingFingerprint(app) {
  const spec = app?.spec?.template?.spec;
  if (!Array.isArray(spec?.containers)) throw new Error('Unrecognized Code Engine application configuration.');
  const bindings = {
    containers: spec.containers.map(container => ({
      name: container.name,
      env: sorted(container.env),
      envFrom: sorted(container.envFrom),
      mounts: sorted(container.volumeMounts),
    })),
    volumes: sorted(spec.volumes),
  };
  return createHash('sha256').update(JSON.stringify(bindings)).digest('hex');
}
