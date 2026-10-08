import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AssistantBadOutputError, AssistantUnavailableError } from './errors';
import { applyGuard, GuardResult } from './grounding';
import { LLM_CLIENT, LlmClient } from './llm-client';
import {
  organizedCardJsonSchema,
  organizedCardSchema,
  Topic,
} from './organized-card';

export type OrganizerResult = GuardResult & { missing: Topic[] };

@Injectable()
export class OrganizerService {
  private readonly system = readFileSync(
    join(__dirname, 'prompts/organize-notes.md'),
    'utf8',
  );

  constructor(
    @Inject(LLM_CLIENT) private readonly client: LlmClient,
    private readonly config: ConfigService,
  ) {}

  async organizeNotes(rawNotes: string): Promise<OrganizerResult> {
    const limit = this.config.getOrThrow<number>('ORGANIZER_MAX_NOTES_CHARS');
    if (typeof rawNotes !== 'string' || !rawNotes.trim())
      throw new BadRequestException('Please write some notes first.');
    if (rawNotes.length > limit)
      throw new BadRequestException(
        `Keep the notes within ${limit} characters.`,
      );
    const user = JSON.stringify({ rawNotes });
    // One shared retry budget for transport JSON decoding and domain validation.
    // Availability errors are not retried on a slow CPU-only computer.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const system =
          attempt === 0
            ? this.system
            : `${this.system}\nThe previous response was invalid. Return one complete JSON object, all required keys, no extra keys or prose.`;
        const output = await this.client.chatJson(
          system,
          user,
          organizedCardJsonSchema,
        );
        const parsed = organizedCardSchema.safeParse(output);
        if (!parsed.success) throw new AssistantBadOutputError();
        const result = applyGuard(parsed.data, rawNotes);
        return { ...result, missing: [...result.card.missing] };
      } catch (error) {
        if (error instanceof AssistantUnavailableError) throw error;
        if (!(error instanceof AssistantBadOutputError)) throw error;
        if (attempt === 1) throw new AssistantBadOutputError();
      }
    }
    throw new AssistantBadOutputError();
  }
}
