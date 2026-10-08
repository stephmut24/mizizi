import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { AssistantBadOutputError, AssistantUnavailableError } from './errors';
import { LlmClient } from './llm-client';

const responseSchema = z.object({
  message: z.object({ content: z.string().min(1) }),
  done: z.literal(true),
  done_reason: z.string().optional(),
});

@Injectable()
export class OllamaClient implements LlmClient {
  constructor(private readonly config: ConfigService) {}

  async chatJson(
    system: string,
    user: string,
    jsonSchema: Record<string, unknown>,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = this.config.getOrThrow<number>('OLLAMA_TIMEOUT_S');
    const model = this.config.getOrThrow<string>('OLLAMA_MODEL');
    const url = this.config
      .getOrThrow<string>('OLLAMA_URL')
      .replace(/\/+$/, '');
    const timer = setTimeout(() => controller.abort(), timeout * 1000);
    try {
      const response = await fetch(`${url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'error',
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          stream: false,
          format: jsonSchema,
          options: {
            temperature: 0,
            num_ctx: 4096,
            num_predict: 1536,
            num_gpu: 0,
          },
        }),
      });
      if (!response.ok) {
        throw new AssistantUnavailableError(
          response.status === 404
            ? `The configured Ollama model "${model}" is unavailable. Check ollama list. You can still write the card by hand.`
            : `Ollama could not complete the request (HTTP ${response.status}). Please try again or write the card by hand.`,
        );
      }
      // Parse here so malformed envelopes and message JSON follow the same error path.
      const envelope: unknown = JSON.parse(await response.text());
      const parsed = responseSchema.safeParse(envelope);
      if (!parsed.success || parsed.data.done_reason === 'length')
        throw new AssistantBadOutputError();
      return JSON.parse(parsed.data.message.content) as unknown;
    } catch (error) {
      if (controller.signal.aborted) {
        throw new AssistantUnavailableError(
          `Ollama took longer than ${timeout} seconds. Please try shorter notes or write the card by hand.`,
        );
      }
      if (
        error instanceof AssistantUnavailableError ||
        error instanceof AssistantBadOutputError
      )
        throw error;
      if (error instanceof SyntaxError) throw new AssistantBadOutputError();
      throw new AssistantUnavailableError(
        'Ollama is not reachable. Start Ollama on this computer, or write the card by hand.',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
