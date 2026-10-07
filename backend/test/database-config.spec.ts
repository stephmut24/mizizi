import { ConfigService } from '@nestjs/config';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { backendRoot, validateEnvironment } from '../src/config/environment';
import { DatabaseService } from '../src/database/database.service';

describe('Configuration', () => {
  it('uses documented defaults, resolving paths relative to backend/', () => {
    expect(validateEnvironment({})).toEqual({
      DB_PATH: resolve(backendRoot, '../data/mizizi.db'),
      PHOTOS_DIR: resolve(backendRoot, '../data/photos'),
      OLLAMA_URL: 'http://localhost:11434',
      OLLAMA_MODEL: 'gemma3:4b',
      OLLAMA_TIMEOUT_S: 180,
      PORT: 3000,
    });
    expect(
      validateEnvironment({ PORT: '3010', OLLAMA_TIMEOUT_S: '240' }),
    ).toMatchObject({ PORT: 3010, OLLAMA_TIMEOUT_S: 240 });
  });

  it.each([
    { PORT: 'invalid' },
    { PORT: '0' },
    { PORT: '65536' },
    { DB_PATH: '' },
    { PHOTOS_DIR: ' ' },
    { OLLAMA_TIMEOUT_S: '-1' },
    { OLLAMA_TIMEOUT_S: '1.5' },
    { OLLAMA_MODEL: '' },
    { OLLAMA_URL: 'invalid' },
  ])('rejects invalid settings: %j', (values) => {
    expect(() => validateEnvironment(values)).toThrow(
      /Invalid environment configuration/,
    );
  });
});

describe('Database lifecycle', () => {
  it('creates directories, enables WAL and foreign keys, persists across restarts', () => {
    const directory = mkdtempSync(join(tmpdir(), 'mizizi-db-test-'));
    const settings = validateEnvironment({
      DB_PATH: join(directory, 'nested/db.sqlite'),
      PHOTOS_DIR: join(directory, 'photos'),
    });
    const config = new ConfigService(settings);
    const db = new DatabaseService(config);
    try {
      db.onModuleInit();
      expect(existsSync(settings.DB_PATH)).toBe(true);
      expect(existsSync(settings.PHOTOS_DIR)).toBe(true);
      expect(db.get('PRAGMA journal_mode')).toEqual({ journal_mode: 'wal' });
      expect(db.get('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
      db.run('INSERT INTO elders (display_name) VALUES (?)', 'Demo');
      expect(() =>
        db.run(
          "INSERT INTO walks (elder_id, walk_date, place_label) VALUES (999, '2026-10-07', 'Garden')",
        ),
      ).toThrow(/FOREIGN KEY/);
      expect(() =>
        db.run(
          "INSERT INTO plants (elder_id, local_name, visibility) VALUES (1, 'Leaf', 'public')",
        ),
      ).toThrow(/CHECK/);
      db.onModuleDestroy();
      db.onModuleInit();
      expect(db.get('SELECT display_name FROM elders')).toEqual({
        display_name: 'Demo',
      });
    } finally {
      db.onModuleDestroy();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
