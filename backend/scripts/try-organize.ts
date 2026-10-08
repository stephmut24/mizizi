import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { backendRoot, validateEnvironment } from '../src/config/environment';
import { AssistantModule } from '../src/assistant/assistant.module';
import { OrganizerService } from '../src/assistant/organizer.service';
import {
  AssistantBadOutputError,
  AssistantUnavailableError,
} from '../src/assistant/errors';
import { applyGuard } from '../src/assistant/grounding';

// Deliberately not AppModule: trying the organizer must never open SQLite.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(backendRoot, '.env'),
      validate: validateEnvironment,
    }),
    AssistantModule,
  ],
})
class OrganizerCliModule {}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((argument) => !argument.startsWith('--'));
  if (
    !file ||
    args.filter((argument) => !argument.startsWith('--')).length !== 1 ||
    args.some(
      (argument) =>
        argument.startsWith('--') && argument !== '--demo-invalid-quote',
    )
  ) {
    console.error(
      'Usage: npm run try:organize -- notes.txt [--demo-invalid-quote]',
    );
    process.exitCode = 1;
    return;
  }
  const callerDirectory = process.env.INIT_CWD ?? process.cwd();
  const notes = await readFile(resolve(callerDirectory, file), 'utf8');
  const app = await NestFactory.createApplicationContext(OrganizerCliModule, {
    logger: false,
    abortOnError: false,
  });
  const started = performance.now();
  try {
    const result = await app.get(OrganizerService).organizeNotes(notes);
    console.log(
      'Proposal only. Nothing was saved. Traditional knowledge shared by the elder. Not medical advice.',
    );
    console.log(JSON.stringify(result, null, 2));
    if (args.includes('--demo-invalid-quote')) {
      const demo = applyGuard(
        {
          ...result.card,
          appearance: [
            ...result.card.appearance,
            {
              text: 'Fictional demonstration item',
              quote: `CLI demonstration only: ${randomUUID()}`,
            },
          ],
        },
        notes,
      );
      console.log(
        'Guard demonstration only: the following item was inserted by the CLI, NOT returned by Ollama.',
      );
      console.log(
        JSON.stringify(
          { removed: demo.removed, rejected: demo.rejected },
          null,
          2,
        ),
      );
    }
  } finally {
    console.log(
      `Organizer elapsed: ${((performance.now() - started) / 1000).toFixed(2)} s`,
    );
    await app.close();
  }
}

void main().catch((error: unknown) => {
  if (
    error instanceof AssistantUnavailableError ||
    error instanceof AssistantBadOutputError
  ) {
    console.error(error.message);
  } else if (
    error instanceof Error &&
    'code' in error &&
    error.code === 'ENOENT'
  ) {
    console.error(
      'The notes file was not found. Check its path and try again.',
    );
  } else {
    console.error(
      error instanceof Error
        ? error.message
        : 'The organizer could not finish. Please check the configuration and notes file.',
    );
  }
  process.exitCode = 1;
});
