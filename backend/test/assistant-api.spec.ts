import request from 'supertest';
import { AddressInfo } from 'node:net';
import {
  AssistantBadOutputError,
  AssistantUnavailableError,
} from '../src/assistant/errors';
import { LlmClient } from '../src/assistant/llm-client';
import { OrganizerResult } from '../src/assistant/organizer.service';
import { createTestApp, TestApp } from './test-app';
import { sampleCard, sampleNotes } from './assistant-fixtures';

describe('Organizer HTTP boundary (isolated SQLite, fake LLM)', () => {
  let context: TestApp;
  let chatJson: jest.MockedFunction<LlmClient['chatJson']>;
  let elderId: number;
  const snapshot = () =>
    ['elders', 'walks', 'plants', 'followups'].map((table) =>
      context.db.all(`SELECT * FROM ${table} ORDER BY id`),
    );
  beforeEach(async () => {
    chatJson = jest.fn().mockResolvedValue(sampleCard());
    context = await createTestApp({ chatJson });
    elderId = context.elders.create({
      display_name: 'Fictional elder',
      consent_given: true,
    }).id;
    const walk = context.walks.create({
      elder_id: elderId,
      walk_date: '2026-10-08',
      place_label: 'Test garden',
    });
    const plant = context.plants.create({
      elder_id: elderId,
      walk_id: walk.id,
      local_name: 'Existing plant',
    });
    context.followups.create({
      plant_id: plant.id,
      question: 'What is its other name?',
    });
  });
  afterEach(async () => {
    await context.close();
  });

  it('returns a guarded proposal and leaves all four populated tables unchanged', async () => {
    const card = sampleCard();
    card.habitat.push({ text: 'River bank', quote: 'It grows by the river.' });
    chatJson.mockResolvedValue(card);
    const before = snapshot();
    const { body } = await request(context.server)
      .post('/api/assistant/organize')
      .send({ rawNotes: sampleNotes })
      .expect(200);
    expect(body).toMatchObject({
      kept: 2,
      removed: 1,
      card: { habitat: [] },
      rejected: [{ reason: 'quote_not_found' }],
    });
    expect(body.missing).toContain('habitat');
    expect(snapshot()).toEqual(before);
    const docs = await request(context.server).get('/docs-json').expect(200);
    expect(docs.body.paths).toHaveProperty('/api/assistant/organize');
  });

  it.each([
    {},
    { rawNotes: '' },
    { rawNotes: ' \n ' },
    { rawNotes: 42 },
    { rawNotes: null },
    { rawNotes: ['notes'] },
    { rawNotes: 'x'.repeat(4001) },
    { rawNotes: sampleNotes, elderId: 1 },
  ])('rejects invalid input without contacting the model', async (body) => {
    const before = snapshot();
    await request(context.server)
      .post('/api/assistant/organize')
      .send(body)
      .expect(400);
    expect(chatJson).not.toHaveBeenCalled();
    expect(snapshot()).toEqual(before);
  });

  it.each(['Connection refused', 'Timeout', 'Model missing'])(
    'maps unavailable %s to 503 with a manual fallback',
    async (message) => {
      chatJson.mockRejectedValue(new AssistantUnavailableError(message));
      const before = snapshot();
      const { body } = await request(context.server)
        .post('/api/assistant/organize')
        .send({ rawNotes: sampleNotes })
        .expect(503);
      expect(body.message).toContain('Writing the card by hand still works');
      expect(chatJson).toHaveBeenCalledTimes(1);
      expect(snapshot()).toEqual(before);
    },
  );

  it('maps bad output to 422 after one retry without writing', async () => {
    chatJson.mockRejectedValue(new AssistantBadOutputError());
    const before = snapshot();
    const { body } = await request(context.server)
      .post('/api/assistant/organize')
      .send({ rawNotes: sampleNotes })
      .expect(422);
    expect(body.message).toBe(
      'The model gave an unusable answer. Try again or write the card by hand.',
    );
    expect(chatJson).toHaveBeenCalledTimes(2);
    expect(snapshot()).toEqual(before);
  });

  it('saves reviewed fields only through the normal endpoint and rechecks validation and current consent', async () => {
    const response = await request(context.server)
      .post('/api/assistant/organize')
      .send({ rawNotes: sampleNotes })
      .expect(200);
    const proposal = response.body as OrganizerResult;
    const reviewed = {
      elder_id: elderId,
      local_name: proposal.card.localName?.text,
      appearance: ['Edited green leaves'],
      raw_notes: sampleNotes,
    };
    await request(context.server)
      .post('/api/plants')
      .send({ ...reviewed, local_name: ' ' })
      .expect(400);
    await request(context.server)
      .post('/api/plants')
      .send({ ...reviewed, visibility: 'public' })
      .expect(400);
    await request(context.server)
      .post('/api/plants')
      .send({ ...reviewed, kept: 2 })
      .expect(400);
    const saved = await request(context.server)
      .post('/api/plants')
      .send(reviewed)
      .expect(201);
    expect(saved.body).toMatchObject({
      local_name: 'Kijani',
      appearance: ['Edited green leaves'],
      visibility: 'private',
    });
    context.elders.update(elderId, { consent_given: false });
    await request(context.server)
      .post('/api/plants')
      .send(reviewed)
      .expect(400);
    await request(context.server)
      .patch(`/api/plants/${saved.body.id}`)
      .send({ appearance: ['Another edit'] })
      .expect(400);
  });

  it('propagates a browser disconnect to the model without retrying or writing', async () => {
    let started!: () => void;
    let cancelled!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const aborted = new Promise<void>((resolve) => {
      cancelled = resolve;
    });
    chatJson.mockImplementation(
      (_system, _user, _schema, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener(
            'abort',
            () => {
              cancelled();
              reject(signal.reason);
            },
            { once: true },
          );
          started();
        }),
    );
    const before = snapshot();
    await context.app.listen(0, '127.0.0.1');
    const { port } = context.server.address() as AddressInfo;
    const controller = new AbortController();
    const call = fetch(`http://127.0.0.1:${port}/api/assistant/organize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawNotes: sampleNotes }),
      signal: controller.signal,
    });
    const result = expect(call).rejects.toMatchObject({ name: 'AbortError' });
    await ready;
    controller.abort();
    await result;
    await aborted;
    expect(chatJson).toHaveBeenCalledTimes(1);
    expect(snapshot()).toEqual(before);
  });
});
