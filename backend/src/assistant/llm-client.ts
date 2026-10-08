export const LLM_CLIENT = Symbol('LLM_CLIENT');

export interface LlmClient {
  // One transport attempt. The organizer owns the single JSON/schema retry.
  // Returning unknown prevents callers from trusting unvalidated model data.
  chatJson(
    system: string,
    user: string,
    jsonSchema: Record<string, unknown>,
  ): Promise<unknown>;
}
