import { Inject, Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { LLM_CLIENT, LlmClient } from './llm-client';
import { AssistantBadOutputError, AssistantUnavailableError } from './errors';
import { guardQuestions } from './question-guard';

const templates = {
  other_names: 'Are there other names you would like me to write down?',
  appearance: 'How do you recognize it when it is not in flower?',
  habitat: 'What kind of surroundings do you remember seeing it in?',
  uses: 'What would you like me to remember about its place in your daily life?',
  preparation:
    'Are there traditions around preparing it that you would like to talk about?',
  warnings: 'What cautions did your elders pass down with this knowledge?',
  story: 'Is there a story or proverb you associate with it?',
};
type Topic = keyof typeof templates;
type QuestionPlant = {
  local_name: string;
  raw_notes: string;
  story: string;
} & Record<Exclude<Topic, 'story'>, string[]>;
const topics = Object.keys(templates) as Topic[];
const outputSchema = z.array(z.string().min(1).max(1000)).max(4);
const jsonSchema = {
  type: 'array',
  maxItems: 4,
  items: { type: 'string', minLength: 1, maxLength: 140 },
};

export function missingTopics(plant: QuestionPlant): Topic[] {
  return topics.filter((topic) =>
    typeof plant[topic] === 'string'
      ? !plant[topic].trim()
      : !plant[topic].some((line) => line.trim()),
  );
}

@Injectable()
export class QuestionsService {
  private readonly prompt = readFileSync(
    join(__dirname, 'prompts/followup-questions.md'),
    'utf8',
  );

  constructor(@Inject(LLM_CLIENT) private readonly client: LlmClient) {}

  async suggestQuestions(plant: QuestionPlant, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const missing = missingTopics(plant);
    const fallback = () => ({
      questions: guardQuestions(
        missing.length
          ? missing.map((topic) => templates[topic])
          : ['Is there another memory you would like me to write down?'],
      ),
      missing,
      source: 'templates' as const,
    });
    // Bound the context for a slow local CPU. Notes are data, never instructions.
    const written = Object.fromEntries(
      ['local_name', ...topics].map((topic) => {
        const value = plant[topic as keyof QuestionPlant];
        return [
          topic,
          typeof value === 'string'
            ? value.slice(0, 500)
            : value.slice(0, 3).map((line) => line.slice(0, 160)),
        ];
      }),
    );
    const user = JSON.stringify({
      missing,
      written,
      rawNotes: plant.raw_notes.slice(0, 1500),
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await this.client.chatJson(
          this.prompt,
          user,
          jsonSchema,
          signal,
        );
        signal?.throwIfAborted();
        const parsed = outputSchema.safeParse(result);
        if (!parsed.success) throw new AssistantBadOutputError();
        const questions = guardQuestions(parsed.data);
        return questions.length
          ? { questions, missing, source: 'model' as const }
          : fallback();
      } catch (error) {
        signal?.throwIfAborted();
        if (error instanceof AssistantUnavailableError) return fallback();
        if (!(error instanceof AssistantBadOutputError)) throw error;
        if (attempt === 1) return fallback();
      }
    }
    return fallback();
  }
}
