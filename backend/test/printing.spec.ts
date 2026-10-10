import request from 'supertest';
import { createTestApp, TestApp } from './test-app';

describe('Privacy-filtered printing with a temporary database', () => {
  let context: TestApp;
  let elderId: number;
  let sharedId: number;
  let privateId: number;
  beforeEach(async () => {
    context = await createTestApp();
    elderId = context.elders.create({
      display_name: 'Demo elder',
      consent_given: true,
      consent_note: 'Hidden consent details',
    }).id;
    const walk = context.walks.create({
      elder_id: elderId,
      walk_date: '2026-10-10',
      place_label: 'Garden',
    });
    sharedId = context.plants.create({
      elder_id: elderId,
      walk_id: walk.id,
      local_name: 'Shared leaf',
      visibility: 'shareable',
      appearance: ['Round leaves'],
      raw_notes: 'Original private draft',
    }).id;
    privateId = context.plants.create({
      elder_id: elderId,
      local_name: 'SECRET NAME',
      story: 'SECRET STORY',
      raw_notes: 'SECRET NOTES',
    }).id;
  });
  afterEach(async () => context.close());

  it('returns only shareable card fields and a private count in a booklet', async () => {
    const response = await request(context.server)
      .get(`/api/print/booklet/${elderId}`)
      .expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({
      elder: { id: elderId, display_name: 'Demo elder' },
      skippedPrivateCount: 1,
      plants: [
        { id: sharedId, appearance: ['Round leaves'], walk_date: '2026-10-10' },
      ],
    });
    expect(response.body.plants).toHaveLength(1);
    expect(JSON.stringify(response.body)).not.toMatch(
      /SECRET|consent_note|raw_notes|photo_path|privateId/,
    );
    const card = await request(context.server)
      .get(`/api/print/plants/${sharedId}`)
      .expect(200);
    expect(card.body.plant).toEqual(response.body.plants[0]);
  });

  it('rejects a private card and rechecks visibility on every request', async () => {
    await request(context.server)
      .get(`/api/print/plants/${privateId}`)
      .expect(403)
      .expect(({ body }) => expect(body.message).toMatch(/private/));
    context.plants.update(sharedId, { visibility: 'private' });
    await request(context.server)
      .get(`/api/print/plants/${sharedId}`)
      .expect(403);
    const response = await request(context.server)
      .get(`/api/print/booklet/${elderId}`)
      .expect(200);
    expect(response.body).toMatchObject({ plants: [], skippedPrivateCount: 2 });
  });

  it('groups unanswered questions but reveals no private name or notes', async () => {
    context.followups.create({
      plant_id: privateId,
      question: 'What memory would you like to share?',
    });
    context.followups.create({
      plant_id: sharedId,
      question: 'Are there other names?',
    });
    context.followups.create({
      plant_id: sharedId,
      question: 'An answered question?',
      answered: true,
    });
    const other = context.elders.create({
      display_name: 'Other person',
      consent_given: true,
    });
    const plant = context.plants.create({
      elder_id: other.id,
      local_name: 'Unrelated',
    });
    context.followups.create({
      plant_id: plant.id,
      question: 'An unrelated question?',
    });
    const response = await request(context.server)
      .get(`/api/print/nextwalk/${elderId}`)
      .expect(200);
    expect(response.body.groups).toHaveLength(2);
    expect(response.body.groups[1]).toMatchObject({
      plant_id: privateId,
      label: `Folio #${privateId}`,
      questions: [{ question: 'What memory would you like to share?' }],
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /SECRET|answered question|unrelated|raw_notes|story|consent_note/,
    );
  });

  it('handles missing records, invalid ids and an empty notebook', async () => {
    await request(context.server).get('/api/print/plants/99999').expect(404);
    await request(context.server).get('/api/print/booklet/99999').expect(404);
    await request(context.server).get('/api/print/nextwalk/99999').expect(404);
    await request(context.server).get('/api/print/plants/nope').expect(400);
    const empty = context.elders.create({
      display_name: 'Empty',
      consent_given: true,
    });
    const booklet = await request(context.server)
      .get(`/api/print/booklet/${empty.id}`)
      .expect(200);
    expect(booklet.body).toMatchObject({ plants: [], skippedPrivateCount: 0 });
    const sheet = await request(context.server)
      .get(`/api/print/nextwalk/${empty.id}`)
      .expect(200);
    expect(sheet.body.groups).toEqual([]);
  });

  it('refuses all print views after consent is revoked', async () => {
    context.elders.update(elderId, { consent_given: false });
    for (const path of [
      `plants/${sharedId}`,
      `booklet/${elderId}`,
      `nextwalk/${elderId}`,
    ]) {
      await request(context.server).get(`/api/print/${path}`).expect(403);
    }
  });
});
