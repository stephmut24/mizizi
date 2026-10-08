import { OrganizedCard } from '../src/assistant/organized-card';

export function emptyCard(): OrganizedCard {
  return {
    localName: null,
    otherNames: [],
    appearance: [],
    habitat: [],
    uses: [],
    preparation: [],
    warnings: [],
    story: [],
    missing: [],
  };
}

export function sampleCard(): OrganizedCard {
  return {
    ...emptyCard(),
    localName: { text: 'Kijani', quote: 'We call it Kijani.' },
    appearance: [{ text: 'Green leaves', quote: 'Its leaves are green.' }],
  };
}

export const sampleNotes = 'We call it Kijani. Its leaves are green.';
