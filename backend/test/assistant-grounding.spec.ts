import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import {
  applyGuard,
  hasUnsupportedContent,
  normalize,
  quoteInNotes,
} from '../src/assistant/grounding';
import { organizedCardSchema, topics } from '../src/assistant/organized-card';
import { emptyCard } from './assistant-fixtures';

describe('Evidence guard (no model)', () => {
  it('normalizes whitespace, case and surrounding Unicode punctuation only', () => {
    expect(normalize('  « GREEN\n  leaves! » ')).toBe('green leaves');
    expect(normalize("L'arbre, près du mur.")).toBe("l'arbre, près du mur");
    expect(
      quoteInNotes('« SOFT   green leaves! »', 'She said: soft green leaves.'),
    ).toBe(true);
    expect(quoteInNotes('pres du mur', 'près du mur')).toBe(false);
  });

  it.each(['', '...', 'ab', '!? a !', '🌱'])(
    'rejects normalized quotes shorter than 3 characters: %s',
    (quote) => {
      expect(quoteInNotes(quote, `Here is ${quote}`)).toBe(false);
    },
  );

  it('removes invented/altered quotes, not grounded items, without mutating the input', () => {
    const card = emptyCard();
    card.appearance = [
      { text: 'Green leaves', quote: 'The leaves are green.' },
      { text: 'Red leaves', quote: 'The leaves are red.' },
      { text: 'Striped leaves', quote: 'The leaves are green and striped.' },
    ];
    const original = JSON.stringify(card);
    const result = applyGuard(card, 'The leaves are green.');
    expect(result).toMatchObject({ kept: 1, removed: 2 });
    expect(result.card.appearance).toEqual([card.appearance[0]]);
    expect(result.rejected.map((item) => item.reason)).toEqual([
      'quote_not_found',
      'quote_not_found',
    ]);
    expect(result.card.missing).toContain('uses');
    expect(result.card.missing).not.toContain('appearance');
    expect(JSON.stringify(card)).toBe(original);
  });

  it.each([
    '5 mg',
    '5ml',
    '2 spoons',
    '1 cup',
    '3 times a day',
    '1/2 teaspoon',
    '2 tablespoons',
    '0.5 ml',
    '0,5 ml',
    '2 cuillères',
    '2 fois par jour',
    'cure',
    'cures',
    'treat',
    'treatment',
    'diagnose',
    'safe',
    'sans danger',
  ])('rejects an unsupported fragment in text: %s', (text) => {
    expect(
      hasUnsupportedContent({ text, quote: 'The leaves are green.' }),
    ).toBe(true);
  });

  it('checks the item’s own quote and the exact dose, not another part of the notes', () => {
    const card = emptyCard();
    card.uses = [{ text: '5 mg', quote: 'The leaves are green.' }];
    expect(
      applyGuard(card, 'The leaves are green. Synthetic test token: 5 mg.')
        .removed,
    ).toBe(1);
    expect(
      hasUnsupportedContent({ text: '5 mg', quote: 'Synthetic token: 15 mg.' }),
    ).toBe(true);
    expect(
      hasUnsupportedContent({ text: '5 mg', quote: 'Synthetic token: 5mg.' }),
    ).toBe(false);
    expect(
      hasUnsupportedContent({
        text: '2 times a day',
        quote: 'Synthetic token: 3 times a day.',
      }),
    ).toBe(true);
  });

  it('does not match unrelated words containing a banned word', () => {
    expect(
      hasUnsupportedContent({
        text: 'The texture is secure and curved.',
        quote: 'Green leaves.',
      }),
    ).toBe(false);
  });

  it('handles localName and every array; preserves exact names and recomputes missing', () => {
    const card = emptyCard();
    card.localName = { text: 'MINT', quote: 'We call it Mint.' };
    for (const topic of topics)
      if (topic !== 'localName')
        card[topic] = [{ text: 'Invented', quote: 'Not in these notes.' }];
    expect(applyGuard(card, 'We call it Mint.')).toMatchObject({
      kept: 0,
      removed: 8,
      card: { localName: null, missing: [...topics] },
    });
    card.localName = { text: 'Mint', quote: 'we CALL it mint.' };
    const kept = applyGuard(card, 'We call it Mint.');
    expect(kept.kept).toBe(1);
    expect(kept.card.missing).not.toContain('localName');
  });

  it('rejects whitespace-only text even with a present quote', () => {
    const card = emptyCard();
    card.story = [{ text: '   ', quote: 'A family story.' }];
    expect(applyGuard(card, 'A family story.').rejected[0].reason).toBe(
      'empty_text',
    );
  });
});

const exampleSchema = z.object({
  id: z.string(),
  notes: z.string(),
  expected: organizedCardSchema.partial(),
});
const examples = z
  .array(exampleSchema)
  .min(6)
  .parse(
    JSON.parse(
      readFileSync(
        join(__dirname, '../../docs/organizer-examples.json'),
        'utf8',
      ),
    ),
  );

describe('Published fictional multilingual examples', () => {
  it.each(examples)(
    '$id contains only expected items with present evidence',
    ({ notes, expected }) => {
      const card = organizedCardSchema.parse({ ...emptyCard(), ...expected });
      const result = applyGuard(card, notes);
      expect(result.removed).toBe(0);
      expect(result.kept).toBeGreaterThan(0);
      expect(result.card).toMatchObject(expected);
    },
  );
});
