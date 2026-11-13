import { cpSync } from 'node:fs';

// Next's standalone server needs its generated client assets alongside it.
cpSync(new URL('../.next/static', import.meta.url), new URL('../.next/standalone/.next/static', import.meta.url), { recursive: true });
