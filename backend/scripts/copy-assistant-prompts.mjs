import { cpSync, mkdirSync } from 'node:fs';
import { URL } from 'node:url';

const target = new URL('../dist/assistant/prompts/', import.meta.url);
mkdirSync(target, { recursive: true });
cpSync(new URL('../src/assistant/prompts/', import.meta.url), target, {
  recursive: true,
});
