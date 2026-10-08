import {
  Evidenced,
  OrganizedCard,
  Topic,
  listTopics,
  topics,
} from './organized-card';

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '');
}

export function quoteInNotes(quote: string, notes: string): boolean {
  const normalized = normalize(quote);
  return [...normalized].length >= 3 && normalize(notes).includes(normalized);
}

// A small conservative heuristic, not a medical or semantic classifier.
const restricted =
  /(?<![\p{L}\p{N}])(?:\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?\s*(?:mg|ml|milligrams?|millilit(?:er|re)s?|(?:tea|table)?spoons?|cups?|times\s+a\s+day|fois\s+par\s+jour|cuill[eè]res?|tasses?)|cur(?:e[sd]?|ing)|treat(?:s|ed|ing|ment[s]?)?|diagnos(?:e[sd]?|ing|is|tic)|gu[eé]ri(?:r|t|s|son)?|trait(?:er|e|é|ement[s]?)|diagnosti(?:c|quer)|safe|harmless|non-toxic|sans\s+(?:danger|risque))(?![\p{L}\p{N}])/gu;

function restrictedFragments(text: string): string[] {
  return [...normalize(text).matchAll(restricted)].map(([match]) =>
    match.replace(/\s+/gu, ''),
  );
}

export function hasUnsupportedContent(item: Evidenced): boolean {
  const quoted = new Set(restrictedFragments(item.quote));
  return restrictedFragments(item.text).some(
    (fragment) => !quoted.has(fragment),
  );
}

export interface RejectedItem {
  field: Topic;
  item: Evidenced;
  reason:
    | 'empty_text'
    | 'quote_not_found'
    | 'unsupported_content'
    | 'name_not_verbatim';
}

export interface GuardResult {
  card: OrganizedCard;
  kept: number;
  removed: number;
  rejected: RejectedItem[];
}

export function applyGuard(card: OrganizedCard, notes: string): GuardResult {
  let kept = 0;
  const rejected: RejectedItem[] = [];
  function keep(field: Topic, item: Evidenced): boolean {
    let reason: RejectedItem['reason'] | undefined;
    if (!item.text.trim()) reason = 'empty_text';
    else if (!quoteInNotes(item.quote, notes)) reason = 'quote_not_found';
    else if (hasUnsupportedContent(item)) reason = 'unsupported_content';
    else if (
      (field === 'localName' || field === 'otherNames') &&
      (!notes.includes(item.text) ||
        !normalize(item.quote).includes(normalize(item.text)))
    )
      reason = 'name_not_verbatim';
    if (reason) {
      rejected.push({ field, item: { ...item }, reason });
      return false;
    }
    kept++;
    return true;
  }
  const cleaned: OrganizedCard = {
    localName:
      card.localName && keep('localName', card.localName)
        ? { ...card.localName }
        : null,
    otherNames: [],
    appearance: [],
    habitat: [],
    uses: [],
    preparation: [],
    warnings: [],
    story: [],
    missing: [],
  };
  for (const field of listTopics) {
    cleaned[field] = card[field]
      .filter((item) => keep(field, item))
      .map((item) => ({ ...item }));
  }
  // Do not trust model-authored free text or stale "missing" claims after filtering.
  // Empty means no grounded item was extracted, not proof the topic is absent.
  cleaned.missing = topics.filter((field) =>
    field === 'localName'
      ? cleaned.localName === null
      : cleaned[field].length === 0,
  );
  return { card: cleaned, kept, removed: rejected.length, rejected };
}
