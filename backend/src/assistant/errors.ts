export class AssistantUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssistantUnavailableError';
  }
}

export class AssistantBadOutputError extends Error {
  constructor(
    message = 'The assistant returned an invalid card. Please try again or write it by hand.',
  ) {
    super(message);
    this.name = 'AssistantBadOutputError';
  }
}
