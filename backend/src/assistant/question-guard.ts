// Conservative screening, not a semantic guarantee: people still review every question.
const restricted =
  /\p{N}|\b(?:dose\w*|dosage\w*|mg|ml|spoons?|cups?|times\s+a\s+day|how\s+(?:much|often)|drink\w*|swallow\w*|ingest\w*|consume\w*|cure\w*|treat\w*|diagnos\w*|heal\w*|prescrib\w*|remed\w*|reliev\w*|prevent\w*|safe|safely|harmless|non[- ]?toxic|sans\s+danger|gu[ée]ri\w*|trait\w*|soign\w*|posolog\w*|cuill[èe]res?|tasses?|tibu|ponya)\b/iu;

export function isSafeQuestion(question: string): boolean {
  const text = question.trim();
  return (
    text.length > 1 &&
    text.length <= 140 &&
    text.endsWith('?') &&
    !restricted.test(text)
  );
}

export function guardQuestions(questions: string[]): string[] {
  const seen = new Set<string>();
  return questions
    .map((question) => question.trim())
    .filter((question) => {
      const key = question.toLowerCase().replace(/\s+/g, ' ');
      if (!isSafeQuestion(question) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);
}
