import type { OrganizedTopic, OrganizerProposal } from '../api/types';

export const reviewFields = {
  localName: ['local_name', 'Local name', 'Nothing about its local name yet'],
  otherNames: ['other_names', 'Other names', 'Nothing about other names yet'],
  appearance: ['appearance', 'Appearance', 'Nothing about how it looks yet'],
  habitat: ['habitat', 'Habitat', 'Nothing about where it grows yet'],
  uses: ['uses', 'Uses, as told', 'Nothing about its uses yet'],
  preparation: [
    'preparation',
    'Preparation, as told',
    'Nothing about preparation yet',
  ],
  warnings: ['warnings', 'Warnings, as told', 'Nothing about warnings yet'],
  story: ['story', 'Story or proverb', 'Nothing about a story or proverb yet'],
} as const;

export type ReviewItem = {
  field: OrganizedTopic;
  text: string;
  quote: string;
  selected: boolean;
};
export type ReviewedFields = Partial<
  Record<(typeof reviewFields)[OrganizedTopic][0], string>
>;

export function reviewItems(proposal: OrganizerProposal): ReviewItem[] {
  return (Object.keys(reviewFields) as OrganizedTopic[]).flatMap((field) => {
    const value = proposal.card[field];
    const entries = Array.isArray(value) ? value : value ? [value] : [];
    return entries.map((item) => ({ ...item, field, selected: true }));
  });
}

export function reviewedFields(items: ReviewItem[]): ReviewedFields {
  const fields: ReviewedFields = {};
  for (const field of Object.keys(reviewFields) as OrganizedTopic[]) {
    const selected = items.filter(
      (item) => item.field === field && item.selected && item.text.trim(),
    );
    // Empty or entirely rejected groups leave the user's manual work untouched.
    if (selected.length)
      fields[reviewFields[field][0]] = selected
        .map((item) => item.text.trim())
        .join('\n');
  }
  return fields;
}

// Map a normalized match back to UTF-16 textarea offsets, without modifying notes.
export function quoteRange(
  quote: string,
  notes: string,
): [number, number] | null {
  const needle = quote
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '');
  if (Array.from(needle).length < 3) return null;
  let normalized = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  for (const character of notes) {
    const end = offset + character.length;
    const value = /\s/u.test(character) ? ' ' : character;
    if (value === ' ' && normalized.endsWith(' ')) ends[ends.length - 1] = end;
    else {
      normalized += value;
      for (let index = 0; index < value.toLowerCase().length; index++) {
        starts.push(offset);
        ends.push(end);
      }
    }
    offset = end;
  }
  const index = normalized.toLowerCase().indexOf(needle);
  return index < 0 ? null : [starts[index], ends[index + needle.length - 1]];
}
