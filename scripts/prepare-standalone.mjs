import { cpSync, mkdirSync } from 'node:fs';

// Next's standalone server needs its generated client assets alongside it.
cpSync(new URL('../.next/static', import.meta.url), new URL('../.next/standalone/.next/static', import.meta.url), { recursive: true });
const storyMedia = new URL('../content/finding-love-at-a-hackathon/media/lucy.png', import.meta.url);
const destination = new URL('../.next/standalone/content/finding-love-at-a-hackathon/media/', import.meta.url);
mkdirSync(destination, { recursive: true });
cpSync(storyMedia, new URL('lucy.png', destination));
