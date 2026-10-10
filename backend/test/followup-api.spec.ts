import request from 'supertest';
import { AssistantUnavailableError } from '../src/assistant/errors';
import { LlmClient } from '../src/assistant/llm-client';
import { createTestApp, TestApp } from './test-app';

describe('Reviewing and saving follow-up questions', () => {
  let context: TestApp;
  let plantId: number;
  let elderId: number;
  let chatJson: jest.MockedFunction<LlmClient['chatJson']>;
  beforeEach(async () => {
    chatJson = jest
      .fn()
      .mockResolvedValue([
        'Are there other names?',
        'Is there a family story?',
      ]);
    context = await createTestApp({ chatJson });
    elderId = context.elders.create({
      display_name: 'Demo',
      consent_given: true,
    }).id;
    plantId = context.plants.create({
      elder_id: elderId,
      local_name: 'Leaf',
    }).id;
  });
  afterEach(async () => context.close());

  function snapshot() {
    return ['elders', 'walks', 'plants', 'followups'].map((table) =>
      context.db.all(`SELECT * FROM ${table} ORDER BY id`),
    );
  }

  it('proposes without writing any table, saves only chosen questions, and marks answered', async () => {
    const before = snapshot();
    const proposal = await request(context.server)
      .post(`/api/plants/${plantId}/followups/suggest`)
      .expect(200);
    expect(proposal.body.questions).toHaveLength(2);
    expect(snapshot()).toEqual(before);
    const body = { questions: ['Are there other names?'] };
    const saved = await request(context.server)
      .post(`/api/plants/${plantId}/followups`)
      .send(body)
      .expect(201);
    expect(context.followups.list()).toHaveLength(1);
    expect(saved.body[0].answered).toBe(false);
    await request(context.server)
      .post(`/api/plants/${plantId}/followups`)
      .send(body)
      .expect(201);
    expect(context.followups.list()).toHaveLength(1);
    await request(context.server)
      .patch(`/api/followups/${saved.body[0].id}`)
      .send({ answered: true })
      .expect(200);
    expect(context.followups.list()[0].answered).toBe(true);
    expect(context.plants.get(plantId).local_name).toBe('Leaf');
  });

  it('falls back without writing when Ollama is unavailable', async () => {
    chatJson.mockRejectedValue(new AssistantUnavailableError('Offline'));
    const before = snapshot();
    const response = await request(context.server)
      .post(`/api/plants/${plantId}/followups/suggest`)
      .expect(200);
    expect(response.body.source).toBe('templates');
    expect(response.body.questions.length).toBeGreaterThan(0);
    expect(snapshot()).toEqual(before);
  });

  it.each([
    {},
    { questions: [] },
    { questions: ['Missing punctuation'] },
    { questions: ['Good question?', 'Use 5 mg?'] },
    { questions: ['A?', 'B?', 'C?', 'D?', 'E?'] },
    { questions: ['A?', 'A?'] },
    { questions: [null] },
    { questions: ['A?'], unexpected: true },
  ])('rejects invalid batches atomically: %j', async (body) => {
    await request(context.server)
      .post(`/api/plants/${plantId}/followups`)
      .send(body)
      .expect(400);
    expect(context.followups.list()).toEqual([]);
  });

  it('enforces consent for suggestions, chosen saves, edits, and answered status', async () => {
    const followup = context.followups.create({
      plant_id: plantId,
      question: 'A question?',
    });
    context.elders.update(elderId, { consent_given: false });
    await request(context.server)
      .post(`/api/plants/${plantId}/followups/suggest`)
      .expect(400);
    expect(chatJson).not.toHaveBeenCalled();
    await request(context.server)
      .post(`/api/plants/${plantId}/followups`)
      .send({ questions: ['Another question?'] })
      .expect(400);
    await request(context.server)
      .patch(`/api/followups/${followup.id}`)
      .send({ answered: true })
      .expect(400);
    expect(context.followups.get(followup.id).answered).toBe(false);
  });

  it('rechecks consent after a slow response', async () => {
    chatJson.mockImplementation(async () => {
      context.elders.update(elderId, { consent_given: false });
      return ['Another memory?'];
    });
    await request(context.server)
      .post(`/api/plants/${plantId}/followups/suggest`)
      .expect(400);
    expect(context.followups.list()).toEqual([]);
  });

  it('rolls back the whole batch if a database write fails', () => {
    const run = context.db.run.bind(context.db);
    let inserts = 0;
    const spy = jest
      .spyOn(context.db, 'run')
      .mockImplementation((sql, ...parameters) => {
        if (sql.startsWith('INSERT INTO followups') && ++inserts === 2)
          throw new Error('Simulated write failure');
        return run(sql, ...parameters);
      });
    try {
      expect(() =>
        context.followups.saveChosen(plantId, [
          'First question?',
          'Second question?',
        ]),
      ).toThrow('Simulated write failure');
      expect(context.followups.list()).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });

  it('checks missing records and guards legacy question creation and editing too', async () => {
    await request(context.server)
      .post('/api/plants/99999/followups/suggest')
      .expect(404);
    await request(context.server)
      .post('/api/plants/nope/followups')
      .send({ questions: ['A?'] })
      .expect(400);
    await request(context.server)
      .post('/api/followups')
      .send({ plant_id: plantId, question: 'Will it cure a cold?' })
      .expect(400);
    const followup = context.followups.create({
      plant_id: plantId,
      question: 'A memory?',
    });
    await request(context.server)
      .patch(`/api/followups/${followup.id}`)
      .send({ question: 'Use 5 ml?' })
      .expect(400);
    expect(context.followups.get(followup.id).question).toBe('A memory?');
  });
});
