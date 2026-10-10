import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  backendRoot,
  frontendDist,
  validateEnvironment,
} from './config/environment';
import { DatabaseModule } from './database/database.module';
import { EldersModule } from './elders/elders.module';
import { WalksModule } from './walks/walks.module';
import { PlantsModule } from './plants/plants.module';
import { FollowupsModule } from './followups/followups.module';
import { HealthController } from './health.controller';
import { AssistantModule } from './assistant/assistant.module';
import { PrintingModule } from './printing/printing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(backendRoot, '.env'),
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validate: validateEnvironment,
    }),
    ServeStaticModule.forRootAsync({
      useFactory: () =>
        existsSync(join(frontendDist, 'index.html'))
          ? [
              {
                rootPath: frontendDist,
                renderPath: '/',
                exclude: ['/api/{*path}', '/docs', '/docs/{*path}'],
              },
            ]
          : [],
    }),
    DatabaseModule,
    EldersModule,
    WalksModule,
    PlantsModule,
    FollowupsModule,
    AssistantModule,
    PrintingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
