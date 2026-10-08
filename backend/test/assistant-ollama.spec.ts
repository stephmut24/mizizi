import { ConfigService } from '@nestjs/config';
import { validateEnvironment } from '../src/config/environment';
import {
  AssistantBadOutputError,
  AssistantUnavailableError,
} from '../src/assistant/errors';
import { OllamaClient } from '../src/assistant/ollama.client';
import { OrganizerService } from '../src/assistant/organizer.service';
import { organizedCardJsonSchema } from '../src/assistant/organized-card';
import { sampleCard, sampleNotes } from './assistant-fixtures';

describe('Ollama client with mocked fetch (never needs Ollama)', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  let client: OllamaClient;
  const config = new ConfigService(
    validateEnvironment({ OLLAMA_TIMEOUT_S: 1 }),
  );
  const reply = (content: string) =>
    new Response(
      JSON.stringify({ message: { content }, done: true, done_reason: 'stop' }),
    );
  const call = () =>
    client.chatJson('System rules', 'User notes', organizedCardJsonSchema);
  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
    client = new OllamaClient(config);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('posts JSON-schema chat with CPU-only options and returns untrusted parsed data', async () => {
    fetchMock.mockResolvedValue(reply(JSON.stringify(sampleCard())));
    await expect(call()).resolves.toEqual(sampleCard());
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:11434/api/chat');
    expect(options).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(options?.body))).toMatchObject({
      model: 'gemma3:4b',
      stream: false,
      format: organizedCardJsonSchema,
      options: { temperature: 0, num_gpu: 0 },
      messages: [
        { role: 'system', content: 'System rules' },
        { role: 'user', content: 'User notes' },
      ],
    });
  });

  it.each([404, 429, 500])(
    'reports HTTP %s as unavailable without retries',
    async (status) => {
      fetchMock.mockResolvedValue(new Response('Upstream details', { status }));
      await expect(call()).rejects.toBeInstanceOf(AssistantUnavailableError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('maps a connection error to a friendly availability error', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(call()).rejects.toThrow('Ollama is not reachable');
  });

  it('aborts the request on timeout and cleans up its timer', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        }),
    );
    const assertion = expect(call()).rejects.toThrow('longer than 1 seconds');
    await jest.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps the timeout active while reading the response body', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(
      async (_url, options) =>
        new Response(
          new ReadableStream({
            start(controller) {
              options?.signal?.addEventListener(
                'abort',
                () =>
                  controller.error(new DOMException('Aborted', 'AbortError')),
                { once: true },
              );
            },
          }),
        ),
    );
    const assertion = expect(call()).rejects.toBeInstanceOf(
      AssistantUnavailableError,
    );
    await jest.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each(['{broken', '```json\n{}\n```', ''])(
    'reports malformed content for the organizer to retry: %s',
    async (content) => {
      fetchMock.mockResolvedValue(reply(content));
      await expect(call()).rejects.toBeInstanceOf(AssistantBadOutputError);
    },
  );

  it.each([
    'not-json',
    '{}',
    '{"message":{"content":"{}"},"done":false}',
    '{"message":{"content":"{}"},"done":true,"done_reason":"length"}',
  ])('rejects bad or truncated envelopes', async (body) => {
    fetchMock.mockResolvedValue(new Response(body));
    await expect(call()).rejects.toBeInstanceOf(AssistantBadOutputError);
  });

  it('clears the timer after successful responses too', async () => {
    jest.useFakeTimers();
    fetchMock.mockResolvedValue(reply('{}'));
    await call();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('makes exactly two HTTP calls for invalid JSON then invalid schema', async () => {
    fetchMock
      .mockResolvedValueOnce(reply('{broken'))
      .mockResolvedValueOnce(reply('{}'));
    const service = new OrganizerService(client, config);
    await expect(service.organizeNotes(sampleNotes)).rejects.toBeInstanceOf(
      AssistantBadOutputError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('recovers from malformed JSON with one real-client retry', async () => {
    fetchMock
      .mockResolvedValueOnce(reply('{broken'))
      .mockResolvedValueOnce(reply(JSON.stringify(sampleCard())));
    await expect(
      new OrganizerService(client, config).organizeNotes(sampleNotes),
    ).resolves.toMatchObject({ kept: 2, removed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
