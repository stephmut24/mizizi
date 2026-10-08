import { resolve } from 'node:path';
import { z } from 'zod';

export const backendRoot = resolve(__dirname, '../..');
export const frontendDist = resolve(backendRoot, '../frontend/dist');

const environmentSchema = z.object({
  DB_PATH: z.string().trim().min(1).default('../data/mizizi.db'),
  PHOTOS_DIR: z.string().trim().min(1).default('../data/photos'),
  OLLAMA_URL: z.url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().trim().min(1).default('gemma3:4b'),
  OLLAMA_TIMEOUT_S: z.coerce.number().int().positive().default(180),
  ORGANIZER_MAX_NOTES_CHARS: z.coerce.number().int().positive().default(4000),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

export function validateEnvironment(values: Record<string, unknown>) {
  const parsed = environmentSchema.safeParse(values);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration: ${parsed.error.message}`,
    );
  }
  return {
    ...parsed.data,
    DB_PATH: resolve(backendRoot, parsed.data.DB_PATH),
    PHOTOS_DIR: resolve(backendRoot, parsed.data.PHOTOS_DIR),
  };
}
