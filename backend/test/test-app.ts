import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Server } from 'node:http';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { validateEnvironment } from '../src/config/environment';
import { DatabaseService } from '../src/database/database.service';
import { EldersService } from '../src/elders/elders.service';
import { WalksService } from '../src/walks/walks.service';
import { PlantsService } from '../src/plants/plants.service';
import { FollowupsService } from '../src/followups/followups.service';

export async function createTestApp() {
  const directory = mkdtempSync(join(tmpdir(), 'mizizi-test-'));
  const config = new ConfigService(
    validateEnvironment({
      DB_PATH: join(directory, 'nested/test.db'),
      PHOTOS_DIR: join(directory, 'photos'),
    }),
  );
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService)
    .useValue(config)
    .compile();
  const app = module.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  const server: Server = app.getHttpServer();
  return {
    app,
    server,
    directory,
    config,
    db: app.get(DatabaseService),
    elders: app.get(EldersService),
    walks: app.get(WalksService),
    plants: app.get(PlantsService),
    followups: app.get(FollowupsService),
    async close() {
      await app.close();
      // Only remove the unique directory this test created, never the app's data/.
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;
