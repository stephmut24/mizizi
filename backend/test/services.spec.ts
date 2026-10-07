import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Visibility } from '../src/plants/plants.dto';
import { createTestApp, TestApp } from './test-app';

describe('Services with a temporary SQLite file', () => {
  let context: TestApp;
  beforeEach(async () => {
    context = await createTestApp();
  });
  afterEach(async () => {
    await context.close();
  });

  it('creates, lists and updates elders, returning lists and booleans', () => {
    const elder = context.elders.create({
      display_name: ' Demo elder ',
      languages: ['English'],
    });
    expect(elder).toMatchObject({
      display_name: 'Demo elder',
      languages: ['English'],
      consent_given: false,
    });
    expect(context.elders.list()).toEqual([elder]);
    const updated = context.elders.update(elder.id, {
      consent_given: true,
      consent_note: 'Demo agreement',
    });
    expect(updated).toMatchObject({
      consent_given: true,
      consent_note: 'Demo agreement',
      languages: ['English'],
    });
    expect(context.elders.requireConsent(elder.id)).toEqual(updated);
    expect(() => context.elders.get(999)).toThrow(NotFoundException);
    expect(() => context.elders.update(999, {})).toThrow(NotFoundException);
    expect(() => context.elders.create({ display_name: '  ' })).toThrow(
      BadRequestException,
    );
  });

  it('enforces consent on creation, update, reassignment and after revocation', () => {
    const first = context.elders.create({ display_name: 'First' });
    const second = context.elders.create({ display_name: 'Second' });
    expect(() =>
      context.plants.create({ elder_id: first.id, local_name: 'Leaf' }),
    ).toThrow(/Consent/);
    expect(context.plants.list()).toHaveLength(0);
    context.elders.update(first.id, { consent_given: true });
    const plant = context.plants.create({
      elder_id: first.id,
      local_name: 'Leaf',
    });
    expect(plant.visibility).toBe('private');
    expect(() =>
      context.plants.update(plant.id, { elder_id: second.id }),
    ).toThrow(/Consent/);
    context.elders.update(second.id, { consent_given: true });
    context.elders.update(first.id, { consent_given: false });
    expect(() => context.plants.update(plant.id, { story: 'Changed' })).toThrow(
      /Consent/,
    );
    expect(() =>
      context.plants.update(plant.id, { elder_id: second.id }),
    ).toThrow(/Consent/);
    expect(context.plants.get(plant.id)).toEqual(plant);
    // Removal remains possible after consent is withdrawn.
    context.plants.delete(plant.id);
    expect(context.plants.list()).toHaveLength(0);
  });

  it('rejects empty names and invalid visibility inside the service too', () => {
    const elder = context.elders.create({
      display_name: 'Demo',
      consent_given: true,
    });
    expect(() =>
      context.plants.create({ elder_id: elder.id, local_name: '  ' }),
    ).toThrow(BadRequestException);
    expect(() =>
      context.plants.create({
        elder_id: elder.id,
        local_name: 'Leaf',
        visibility: 'public' as Visibility,
      }),
    ).toThrow(BadRequestException);
    const plant = context.plants.create({
      elder_id: elder.id,
      local_name: 'Leaf',
    });
    expect(() => context.plants.update(plant.id, { local_name: '' })).toThrow(
      BadRequestException,
    );
    expect(() =>
      context.plants.update(plant.id, { visibility: 'public' as Visibility }),
    ).toThrow(BadRequestException);
  });

  it('keeps raw notes verbatim and round-trips every list field', () => {
    const elder = context.elders.create({
      display_name: 'Demo',
      consent_given: true,
    });
    const fields = {
      other_names: ['Family name'],
      appearance: ['Small leaves'],
      habitat: ['By the fence'],
      uses: ['A family decoration'],
      preparation: ['Pressed in a notebook'],
      warnings: ['Unconfirmed'],
      story: 'A memory',
      raw_notes: '  Original NOTES\nwith spacing.  ',
    };
    const plant = context.plants.create({
      elder_id: elder.id,
      local_name: ' Leaf ',
      ...fields,
    });
    expect(plant).toMatchObject({
      ...fields,
      local_name: 'Leaf',
      walk_id: null,
      photo_path: null,
    });
    const updated = context.plants.update(plant.id, {
      visibility: 'shareable',
      other_names: [],
    });
    expect(updated).toMatchObject({
      ...fields,
      other_names: [],
      visibility: 'shareable',
    });
    expect(updated.created_at).toBe(plant.created_at);
    expect(Date.parse(updated.updated_at)).toBeGreaterThanOrEqual(
      Date.parse(plant.updated_at),
    );
    expect(() => context.plants.get(999)).toThrow(NotFoundException);
    expect(() => context.plants.update(999, {})).toThrow(NotFoundException);
    expect(() => context.plants.delete(999)).toThrow(NotFoundException);
  });

  it('checks walk ownership and updates counts on attach, detach and delete', () => {
    const elder = context.elders.create({
      display_name: 'First',
      consent_given: true,
    });
    const other = context.elders.create({
      display_name: 'Second',
      consent_given: true,
    });
    const walk = context.walks.create({
      elder_id: elder.id,
      walk_date: '2026-10-07',
      place_label: 'Garden',
    });
    const emptyWalk = context.walks.create({
      elder_id: other.id,
      walk_date: '2026-10-07',
      place_label: 'Yard',
      duration_minutes: 30,
    });
    expect(walk.duration_minutes).toBeNull();
    expect(() =>
      context.walks.create({
        elder_id: 999,
        walk_date: '2026-10-07',
        place_label: 'Garden',
      }),
    ).toThrow(NotFoundException);
    expect(() =>
      context.plants.create({
        elder_id: other.id,
        walk_id: walk.id,
        local_name: 'Leaf',
      }),
    ).toThrow(/same elder/);
    expect(() =>
      context.plants.create({
        elder_id: elder.id,
        walk_id: 999,
        local_name: 'Leaf',
      }),
    ).toThrow(NotFoundException);
    const first = context.plants.create({
      elder_id: elder.id,
      walk_id: walk.id,
      local_name: 'First',
    });
    const second = context.plants.create({
      elder_id: elder.id,
      walk_id: walk.id,
      local_name: 'Second',
    });
    expect(context.walks.list()).toEqual([
      { ...emptyWalk, plant_count: 0 },
      { ...walk, plant_count: 2 },
    ]);
    expect(() =>
      context.plants.update(first.id, { elder_id: other.id }),
    ).toThrow(/same elder/);
    expect(() =>
      context.plants.update(first.id, { walk_id: emptyWalk.id }),
    ).toThrow(/same elder/);
    context.plants.update(first.id, { walk_id: null });
    expect(
      context.walks.list().find((item) => item.id === walk.id)?.plant_count,
    ).toBe(1);
    context.plants.delete(second.id);
    expect(
      context.walks.list().find((item) => item.id === walk.id)?.plant_count,
    ).toBe(0);
  });

  it('handles follow-ups, filters, consent revocation and cascading deletion', () => {
    const elder = context.elders.create({
      display_name: 'Demo',
      consent_given: true,
    });
    const plant = context.plants.create({
      elder_id: elder.id,
      local_name: 'Leaf',
    });
    const otherPlant = context.plants.create({
      elder_id: elder.id,
      local_name: 'Other',
    });
    const question = context.followups.create({
      plant_id: plant.id,
      question: ' A question? ',
    });
    expect(question).toMatchObject({
      question: 'A question?',
      answered: false,
    });
    expect(context.followups.list({ plantId: plant.id })).toEqual([question]);
    expect(context.followups.list({ plantId: otherPlant.id })).toEqual([]);
    expect(
      context.followups.update(question.id, { answered: true }).answered,
    ).toBe(true);
    expect(() =>
      context.followups.create({ plant_id: plant.id, question: '  ' }),
    ).toThrow(BadRequestException);
    expect(() =>
      context.followups.create({ plant_id: 999, question: 'Question?' }),
    ).toThrow(NotFoundException);
    const disposable = context.followups.create({
      plant_id: otherPlant.id,
      question: 'Second?',
    });
    context.followups.delete(disposable.id);
    expect(() => context.followups.get(disposable.id)).toThrow(
      NotFoundException,
    );
    context.elders.update(elder.id, { consent_given: false });
    expect(() =>
      context.followups.create({ plant_id: plant.id, question: 'New?' }),
    ).toThrow(/Consent/);
    expect(() =>
      context.followups.update(question.id, { answered: false }),
    ).toThrow(/Consent/);
    context.plants.delete(plant.id);
    expect(context.followups.list()).toEqual([]);
    expect(() => context.followups.get(question.id)).toThrow(NotFoundException);
    expect(() => context.followups.update(999, {})).toThrow(NotFoundException);
    expect(() => context.followups.delete(999)).toThrow(NotFoundException);
  });
});
