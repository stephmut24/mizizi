import request from 'supertest';
import { createTestApp, TestApp } from './test-app';

describe('HTTP API', () => {
  let context: TestApp;
  let elderId: number;
  beforeEach(async () => {
    context = await createTestApp();
    elderId = context.elders.create({
      display_name: 'Demo elder',
      consent_given: true,
    }).id;
  });
  afterEach(async () => {
    await context.close();
  });

  it('serves health and Swagger with required DTO fields and API paths', async () => {
    await request(context.server)
      .get('/api/health')
      .expect(200, { status: 'ok' });
    await request(context.server).get('/health').expect(404);
    await request(context.server).get('/api/missing').expect(404);
    await request(context.server)
      .get('/docs')
      .expect(200)
      .expect('Content-Type', /html/);
    const { body } = await request(context.server)
      .get('/docs-json')
      .expect(200);
    expect(body.paths).toHaveProperty('/api/elders');
    expect(body.paths).toHaveProperty('/api/plants/{id}');
    expect(body.components.schemas.CreatePlantDto.required).toEqual(
      expect.arrayContaining(['elder_id', 'local_name']),
    );
    expect(
      body.components.schemas.CreateWalkDto.properties.walk_date.example,
    ).toBe('2026-10-07');
  });

  it('creates an elder, walk, plant and follow-up entirely through HTTP', async () => {
    const elderResponse = await request(context.server)
      .post('/api/elders')
      .send({
        display_name: 'Another demo elder',
        languages: ['Swahili'],
        consent_given: true,
        consent_note: 'Fictional test consent.',
      })
      .expect(201);
    const elder = elderResponse.body as { id: number };
    await request(context.server)
      .get(`/api/elders/${elder.id}`)
      .expect(200, elderResponse.body);
    await request(context.server)
      .get('/api/elders')
      .expect(200)
      .expect((response) => {
        expect(response.body).toHaveLength(2);
      });
    const walkResponse = await request(context.server)
      .post('/api/walks')
      .send({
        elder_id: elder.id,
        walk_date: '2026-10-07',
        place_label: 'Garden',
        duration_minutes: 20,
      })
      .expect(201);
    const walk = walkResponse.body as { id: number };
    await request(context.server)
      .get(`/api/walks/${walk.id}`)
      .expect(200, walkResponse.body);
    const plantResponse = await request(context.server)
      .post('/api/plants')
      .send({
        elder_id: elder.id,
        walk_id: walk.id,
        local_name: 'Demo leaf',
        raw_notes: ' Original note. ',
      })
      .expect(201);
    const plant = plantResponse.body as { id: number };
    expect(plantResponse.body).toMatchObject({
      visibility: 'private',
      raw_notes: ' Original note. ',
      uses: [],
    });
    await request(context.server)
      .get(`/api/plants/${plant.id}`)
      .expect(200, plantResponse.body);
    await request(context.server)
      .patch(`/api/plants/${plant.id}`)
      .send({ visibility: 'shareable' })
      .expect(200)
      .expect((response) => {
        expect(response.body.visibility).toBe('shareable');
      });
    const followupResponse = await request(context.server)
      .post('/api/followups')
      .send({ plant_id: plant.id, question: 'Another memory?' })
      .expect(201);
    const followup = followupResponse.body as { id: number };
    await request(context.server)
      .get(`/api/followups/${followup.id}`)
      .expect(200, followupResponse.body);
    await request(context.server)
      .get(`/api/followups?plantId=${plant.id}`)
      .expect(200, [followupResponse.body]);
    await request(context.server)
      .patch(`/api/followups/${followup.id}`)
      .send({ answered: true })
      .expect(200)
      .expect((response) => {
        expect(response.body.answered).toBe(true);
      });
    await request(context.server)
      .delete(`/api/followups/${followup.id}`)
      .expect(204);
    await request(context.server)
      .get(`/api/followups/${followup.id}`)
      .expect(404);
    await request(context.server).delete(`/api/plants/${plant.id}`).expect(204);
    await request(context.server).get(`/api/plants/${plant.id}`).expect(404);
  });

  it('returns HTTP 400 without consent, then saves after consent is recorded', async () => {
    const elder = context.elders.create({ display_name: 'No consent yet' });
    const payload = { elder_id: elder.id, local_name: 'Leaf' };
    await request(context.server)
      .post('/api/plants')
      .send(payload)
      .expect(400)
      .expect((response) => {
        expect(response.body.message).toContain('Consent');
      });
    await request(context.server)
      .patch(`/api/elders/${elder.id}`)
      .send({ consent_given: true })
      .expect(200);
    const { body } = await request(context.server)
      .post('/api/plants')
      .send(payload)
      .expect(201);
    const plant = body as { id: number };
    await request(context.server)
      .patch(`/api/elders/${elder.id}`)
      .send({ consent_given: false })
      .expect(200);
    await request(context.server)
      .patch(`/api/plants/${plant.id}`)
      .send({ local_name: 'Changed' })
      .expect(400);
    expect(context.plants.get(plant.id).local_name).toBe('Leaf');
  });

  it.each([
    {},
    { local_name: '' },
    { local_name: ' \n ' },
    { local_name: null },
    { local_name: 4 },
    { local_name: 'Leaf', visibility: 'public' },
    { local_name: 'Leaf', visibility: null },
    { local_name: 'Leaf', extra: true },
    { local_name: 'Leaf', uses: 'not an array' },
    { local_name: 'Leaf', uses: [1] },
    { local_name: 'Leaf', uses: null },
    { local_name: 'Leaf', raw_notes: null },
    { local_name: 'Leaf', elder_id: '1' },
    { local_name: 'Leaf', elder_id: 0 },
    { local_name: 'Leaf', elder_id: null },
    { local_name: 'Leaf', walk_id: -1 },
  ])('rejects invalid plant input: %j', async (input) => {
    await request(context.server)
      .post('/api/plants')
      .send({ elder_id: elderId, ...input })
      .expect(400);
    expect(context.plants.list()).toEqual([]);
  });

  it.each([
    { local_name: null },
    { visibility: null },
    { visibility: 'public' },
    { elder_id: null },
    { uses: null },
    { raw_notes: null },
    { created_at: 'forged' },
  ])('rejects invalid partial updates: %j', async (input) => {
    const plant = context.plants.create({
      elder_id: elderId,
      local_name: 'Leaf',
    });
    await request(context.server)
      .patch(`/api/plants/${plant.id}`)
      .send(input)
      .expect(400);
    expect(context.plants.get(plant.id)).toEqual(plant);
  });

  it('rejects missing elder, unknown elder fields and invalid consent types', async () => {
    await request(context.server)
      .post('/api/plants')
      .send({ local_name: 'Leaf' })
      .expect(400);
    await request(context.server).post('/api/elders').send({}).expect(400);
    for (const input of [
      { display_name: 'Demo', unknown: true },
      { display_name: ' ' },
      { display_name: 'Demo', consent_given: 'false' },
      { display_name: 'Demo', consent_given: null },
      { display_name: 'Demo', languages: [5] },
    ]) {
      await request(context.server).post('/api/elders').send(input).expect(400);
    }
    await request(context.server)
      .patch(`/api/elders/${elderId}`)
      .send({ consent_given: null })
      .expect(400);
    expect(context.elders.get(elderId).consent_given).toBe(true);
  });

  it('validates walk calendar dates, duration, place labels and unknown fields', async () => {
    const valid = {
      elder_id: elderId,
      walk_date: '2026-10-07',
      place_label: 'Garden',
    };
    for (const input of [
      { walk_date: '2026-02-30' },
      { walk_date: '2026-10-07T10:00:00Z' },
      { duration_minutes: -1 },
      { duration_minutes: 1.5 },
      { place_label: ' ' },
      { place_label: 'x'.repeat(201) },
      { coordinates: [1, 2] },
    ]) {
      await request(context.server)
        .post('/api/walks')
        .send({ ...valid, ...input })
        .expect(400);
    }
    await request(context.server)
      .post('/api/walks')
      .send({ ...valid, duration_minutes: null })
      .expect(201);
    await request(context.server)
      .post('/api/walks')
      .send({ ...valid, duration_minutes: 0 })
      .expect(201);
  });

  it('combines elder, visibility and name filters, with literal SQL wildcard search', async () => {
    const other = context.elders.create({
      display_name: 'Other',
      consent_given: true,
    });
    const leaf = context.plants.create({
      elder_id: elderId,
      local_name: 'Garden Leaf',
      other_names: ['Family name'],
      visibility: 'shareable',
    });
    const privateLeaf = context.plants.create({
      elder_id: elderId,
      local_name: 'Private leaf',
    });
    context.plants.create({
      elder_id: other.id,
      local_name: 'Garden leaf',
      visibility: 'shareable',
    });
    const percent = context.plants.create({
      elder_id: elderId,
      local_name: '100% sample',
    });
    const underscore = context.plants.create({
      elder_id: elderId,
      local_name: 'under_score',
    });
    await request(context.server)
      .get('/api/plants')
      .query({ elderId, visibility: 'shareable', search: 'LEAF' })
      .expect(200, [leaf]);
    await request(context.server)
      .get('/api/plants')
      .query({ search: 'family' })
      .expect(200, [leaf]);
    await request(context.server)
      .get('/api/plants')
      .query({ visibility: 'private', search: 'leaf' })
      .expect(200, [privateLeaf]);
    await request(context.server)
      .get('/api/plants')
      .query({ search: '%' })
      .expect(200, [percent]);
    await request(context.server)
      .get('/api/plants')
      .query({ search: '_' })
      .expect(200, [underscore]);
    await request(context.server)
      .get('/api/plants')
      .query({ search: "' OR 1=1 --" })
      .expect(200, []);
    await request(context.server)
      .get('/api/plants')
      .query({ search: 'no match' })
      .expect(200, []);
  });

  it('returns walk plant counts including zero', async () => {
    const walk = context.walks.create({
      elder_id: elderId,
      walk_date: '2026-10-07',
      place_label: 'Garden',
    });
    const empty = context.walks.create({
      elder_id: elderId,
      walk_date: '2026-10-08',
      place_label: 'Yard',
    });
    context.plants.create({
      elder_id: elderId,
      walk_id: walk.id,
      local_name: 'One',
    });
    context.plants.create({
      elder_id: elderId,
      walk_id: walk.id,
      local_name: 'Two',
    });
    context.plants.create({ elder_id: elderId, local_name: 'Unlinked' });
    await request(context.server)
      .get('/api/walks')
      .expect(200, [
        { ...empty, plant_count: 0 },
        { ...walk, plant_count: 2 },
      ]);
  });

  it('validates query filters and route IDs', async () => {
    for (const query of [
      { elderId: 'invalid' },
      { elderId: -1 },
      { visibility: 'public' },
      { unknown: 1 },
    ]) {
      await request(context.server).get('/api/plants').query(query).expect(400);
    }
    await request(context.server)
      .get('/api/followups?plantId=invalid')
      .expect(400);
    await request(context.server).get('/api/followups?unknown=1').expect(400);
    for (const resource of ['elders', 'walks', 'plants', 'followups']) {
      await request(context.server).get(`/api/${resource}/invalid`).expect(400);
      await request(context.server).get(`/api/${resource}/-1`).expect(400);
      await request(context.server).get(`/api/${resource}/999`).expect(404);
    }
  });

  it('rejects orphan relations, mismatched elders, and invalid follow-up changes', async () => {
    const other = context.elders.create({
      display_name: 'Other',
      consent_given: true,
    });
    const walk = context.walks.create({
      elder_id: other.id,
      walk_date: '2026-10-07',
      place_label: 'Yard',
    });
    await request(context.server)
      .post('/api/plants')
      .send({ elder_id: elderId, walk_id: walk.id, local_name: 'Leaf' })
      .expect(400);
    await request(context.server)
      .post('/api/plants')
      .send({ elder_id: 999, local_name: 'Leaf' })
      .expect(404);
    await request(context.server)
      .post('/api/followups')
      .send({ plant_id: 999, question: 'Question?' })
      .expect(404);
    const plant = context.plants.create({
      elder_id: elderId,
      local_name: 'Leaf',
    });
    for (const input of [
      { question: ' ' },
      { question: 'Question?', answered: 'true' },
      { question: 'Question?', unexpected: 1 },
    ]) {
      await request(context.server)
        .post('/api/followups')
        .send({ plant_id: plant.id, ...input })
        .expect(400);
    }
    const followup = context.followups.create({
      plant_id: plant.id,
      question: 'Question?',
    });
    await request(context.server)
      .patch(`/api/followups/${followup.id}`)
      .send({ answered: null })
      .expect(400);
    await request(context.server)
      .patch(`/api/followups/${followup.id}`)
      .send({ plant_id: plant.id })
      .expect(400);
  });
});
