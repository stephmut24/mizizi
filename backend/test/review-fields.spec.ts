// Pure browser helpers are tested here to avoid adding a frontend test dependency.
import {
  quoteRange,
  reviewItems,
  reviewedFields,
} from '../../frontend/src/components/review';
import { OrganizerProposal } from '../../frontend/src/api/types';
import { sampleCard } from './assistant-fixtures';

describe('Review helpers', () => {
  it('copies only checked nonblank edits, leaves manual-only fields absent and never copies quotes or raw notes', () => {
    const proposal: OrganizerProposal = {
      card: sampleCard(),
      kept: 2,
      removed: 0,
      missing: [],
      rejected: [],
    };
    const items = reviewItems(proposal);
    items[0].selected = false;
    items[1].text = 'Edited by the user';
    expect(reviewedFields(items)).toEqual({ appearance: 'Edited by the user' });
    expect(proposal.card.appearance[0].text).toBe('Green leaves');
    items[1].text = '  ';
    expect(reviewedFields(items)).toEqual({});
  });
  it('joins selected array/story entries with newlines', () => {
    expect(
      reviewedFields([
        {
          field: 'story',
          text: 'First line',
          quote: 'First line',
          selected: true,
        },
        {
          field: 'story',
          text: 'Second line',
          quote: 'Second line',
          selected: true,
        },
      ]),
    ).toEqual({ story: 'First line\nSecond line' });
  });
  it.each([
    ['“green leaves.”', 'Before: GREEN  \n leaves. After', 'GREEN  \n leaves'],
    ['its leaves', '🌿 Its leaves are green.', 'Its leaves'],
    ['à côté', 'Il pousse À  CÔTÉ du mur.', 'À  CÔTÉ'],
    ['i\u0307 leaves', 'İ leaves.', 'İ leaves'],
    ['οσ', 'ΟΣ', null],
    ['leaves', 'Leaves and leaves', 'Leaves'],
    ['invented', 'Original notes', null],
    ['ab', 'abc', null],
    ['   ', 'notes', null],
  ])(
    'maps normalized quote %s to the original textarea offsets',
    (quote, notes, expected) => {
      const range = quoteRange(quote, notes);
      expect(range ? notes.slice(...range) : null).toBe(expected);
    },
  );
});
