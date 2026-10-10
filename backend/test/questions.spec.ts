import {
  AssistantBadOutputError,
  AssistantUnavailableError,
} from '../src/assistant/errors';
import { LlmClient } from '../src/assistant/llm-client';
import {
  guardQuestions,
  isSafeQuestion,
} from '../src/assistant/question-guard';
import {
  missingTopics,
  QuestionsService,
} from '../src/assistant/questions.service';

const plant = {
  local_name: 'Family leaf',
  other_names: [],
  appearance: ['Round leaves'],
  habitat: [],
  uses: [],
  preparation: [],
  warnings: [],
  story: '',
  raw_notes: 'Round leaves.',
};

describe('Question guard', () => {
  it.each([
    'No question mark',
    '?',
    `${'a'.repeat(140)}?`,
    'Should I use 20 mg?',
    'Can I take two cups?',
    'Could this treat a cold?',
    'Is it safe?',
    'Prendre une cuillère?',
    'Can it diagnose illness?',
    'Take ½ cup?',
    'Use ２ ml?',
    'How much should I take?',
    'Does it prevent fever?',
    'Is it sans danger?',
  ])('drops %s', (question) => {
    expect(isSafeQuestion(question)).toBe(false);
  });
  it('trims, deduplicates, keeps ordinary questions and limits the result to four', () => {
    expect(
      guardQuestions([
        ' What do you remember? ',
        'what do you remember?',
        'Not a question',
        'Are there other names?',
      ]),
    ).toEqual(['What do you remember?', 'Are there other names?']);
    expect(guardQuestions(['A?', 'B?', 'C?', 'D?', 'E?'])).toHaveLength(4);
  });
});

describe('Questions service with a fake local client', () => {
  let chatJson: jest.MockedFunction<LlmClient['chatJson']>;
  let service: QuestionsService;
  beforeEach(() => {
    chatJson = jest.fn();
    service = new QuestionsService({ chatJson });
  });
  it('treats whitespace-only saved fields as missing', () => {
    expect(
      missingTopics({ ...plant, appearance: [' ', '\n'], story: ' ' }),
    ).toContain('appearance');
    expect(missingTopics({ ...plant, story: ' ' })).toContain('story');
  });
  it('derives missing topics and screens model questions', async () => {
    chatJson.mockResolvedValue([
      'What memory does it bring back?',
      'Use 5 ml?',
      'Not a question',
    ]);
    const result = await service.suggestQuestions(plant);
    expect(result).toEqual({
      questions: ['What memory does it bring back?'],
      missing: missingTopics(plant),
      source: 'model',
    });
    expect(result.missing).not.toContain('appearance');
    const input = JSON.parse(chatJson.mock.calls[0][1]) as {
      missing: string[];
      written: { local_name: string };
    };
    expect(input.written.local_name).toBe('Family leaf');
    expect(input.missing).toContain('habitat');
  });
  it('uses screened templates immediately when unavailable', async () => {
    chatJson.mockRejectedValue(new AssistantUnavailableError('Offline'));
    const result = await service.suggestQuestions(plant);
    expect(result.source).toBe('templates');
    expect(result.questions).toHaveLength(4);
    expect(result.questions.every(isSafeQuestion)).toBe(true);
    expect(chatJson).toHaveBeenCalledTimes(1);
  });
  it('retries bad JSON once, then uses templates', async () => {
    chatJson.mockRejectedValue(new AssistantBadOutputError());
    expect((await service.suggestQuestions(plant)).source).toBe('templates');
    expect(chatJson).toHaveBeenCalledTimes(2);
  });
  it('retries a schema mismatch and accepts a valid second answer', async () => {
    chatJson
      .mockResolvedValueOnce({ questions: [] })
      .mockResolvedValueOnce(['Is there a family story?']);
    expect((await service.suggestQuestions(plant)).source).toBe('model');
    expect(chatJson).toHaveBeenCalledTimes(2);
  });
  it('uses templates if every proposal is rejected or the array is empty', async () => {
    chatJson.mockResolvedValue(['Use 5 cups?']);
    expect((await service.suggestQuestions(plant)).source).toBe('templates');
    chatJson.mockResolvedValue([]);
    expect((await service.suggestQuestions(plant)).source).toBe('templates');
  });
  it('still offers a memory question for a complete card', async () => {
    chatJson.mockRejectedValue(new AssistantUnavailableError('Offline'));
    const complete = {
      ...plant,
      other_names: ['Leaf'],
      habitat: ['Garden'],
      uses: ['Decoration'],
      preparation: ['Pressed'],
      warnings: ['As told'],
      story: 'A memory',
    };
    const result = await service.suggestQuestions(complete);
    expect(result.missing).toEqual([]);
    expect(result.questions).toEqual([
      'Is there another memory you would like me to write down?',
    ]);
  });
  it('does not turn cancellation into fallback or hide unexpected failures', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      service.suggestQuestions(plant, controller.signal),
    ).rejects.toThrow();
    expect(chatJson).not.toHaveBeenCalled();
    chatJson.mockRejectedValue(new Error('Unexpected'));
    await expect(service.suggestQuestions(plant)).rejects.toThrow('Unexpected');
  });
});
