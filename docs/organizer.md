# Local notes organizer (Prompt 03)

The organizer proposes a card; it does not save anything. It uses only the local
Ollama chat API and the installed `gemma3:4b` model. No new dependencies were
added: Zod was already installed. No frontend or database schema changes are needed.

## Data flow

1. `OrganizerService.organizeNotes(rawNotes)` rejects blank notes and inputs over
   `ORGANIZER_MAX_NOTES_CHARS` (default 4000 UTF-16 code units, JavaScript's length).
   The limit applies before trimming; the original notes are preserved.
2. It sends the short system prompt plus a JSON-encoded `rawNotes` data message to
   the injected `LlmClient`. Instructions inside notes are explicitly untrusted.
3. `OllamaClient` posts `/api/chat` using built-in fetch, `stream: false`, the JSON
   schema in `format`, temperature 0, 4096 context tokens, a 1536 output-token cap
   and `num_gpu: 0` for CPU-only execution. It never downloads a model.
4. The client decodes the HTTP envelope and message JSON. The organizer validates
   the resulting unknown value with a strict Zod schema, then applies the guard.
5. It returns `{ card, kept, removed, missing, rejected }`. The additional `rejected`
   diagnostic lists each removed item's field, text, quote and rejection reason.
   Only `card` is a proposal; rejected items are not suggestions to use.

The JSON Schema is generated directly from Zod with `z.toJSONSchema`, including
`additionalProperties: false`. All nine card fields are required. Evidenced text
is limited to 1000 characters, quotes to 4000, and each topic to 12 items. Missing
topics are an allowlist of field keys, not arbitrary model-written claims.

`AssistantModule` exports the organizer. Prompt 04 adds a write-free HTTP endpoint
and browser review; see [review flow](review-flow.md). Loading the module does not
contact Ollama. The CLI creates an assistant-only Nest context,
not the full application: it never opens SQLite or creates a photos directory.
The build copies `prompts/organize-notes.md` beside the compiled organizer.

## Retry and availability contract

`LlmClient.chatJson(system, user, jsonSchema, signal?)` makes **one transport attempt** and
returns untrusted parsed JSON. `OrganizerService` owns a single retry budget for
both malformed JSON and schema mismatch: at most two HTTP calls overall, never
two independent retry loops. The retry adds a brief correction instruction.

`AssistantBadOutputError` is returned to the organizer's caller after that retry
fails. Invalid/truncated envelopes, fenced JSON and extra fields are rejected,
not silently repaired. Evidence rejections do not trigger another model call.

`AssistantUnavailableError` covers network failure, timeout and an unavailable
model/service. These errors are not retried. The abort timer covers both sending
the request and reading the full response, and is always cleared. Redirects are
refused. Configure `OLLAMA_URL` only for your trusted local Ollama server; notes
are sent to that configured address.

`OLLAMA_TIMEOUT_S` defaults to 180 seconds **per attempt**, so two invalid outputs
can take roughly twice that time. A time limit or output-token limit is not a
guarantee that this model will finish on every older CPU. Use shorter notes first,
or explicitly raise the timeout for a real-model trial.

## Evidence rules and limits

- Normalization lowercases text, collapses whitespace and trims surrounding
  Unicode punctuation. Internal punctuation and accents remain significant.
- A normalized quote must contain at least three Unicode code points and appear
  as a substring of normalized notes. This checks containment, not word boundaries.
- Names must additionally occur with their original spelling/case in the notes
  and appear in their own quote. No scientific-name identification is implemented.
- Numeric dosage-like fragments and selected treatment/diagnosis/safety words
  must occur in the **same item's quote**. A phrase elsewhere in the notes does
  not justify an item. Dose matching compares full detected fragments, not a
  substring such as `5 mg` inside `15 mg`.
- The guard is pure: it returns copied data and never mutates the input card.
- `missing` is recomputed from empty fields after filtering. It means **no grounded
  item was extracted**, not proof that the source never mentioned that topic.

This is a deterministic containment check plus a limited English/French heuristic,
not a semantic verifier, a medical classifier, or comprehensive multilingual
protection. It cannot prove a paraphrase follows from a quote, preserve every
negation automatically, or detect every invented claim or species name. A real
quote attached to an unrelated non-banned claim can pass. The prompt forbids such
behavior, but human review remains mandatory. Traditional knowledge shared by
the elder. Not medical advice.

No proposal is automatically saved. Prompt 04 lets the person review, edit and
apply suggestions before saving. The organize request contains only raw notes,
not an elder ID; consent is enforced by the existing plant endpoints at save time.
The UI also requires a consenting person before organizing. An optional abort
signal propagates browser cancellation through the organizer to Ollama; cancelled
calls are not retried and late results are ignored.

## Real-model verification

Run from the repository root:

```sh
ollama list
npm run try:organize -- docs/organizer-notes.txt
npm run try:organize -- docs/organizer-notes.txt --demo-invalid-quote
```

Replace the file path with your own UTF-8 notes file. Relative paths resolve from
the directory where npm was invoked. The seven fictional records in
`docs/organizer-examples.json` provide English, French, Swahili and mixed-language
evidence fixtures; tests use their expected items without invoking a model.
They are not a claim of seven successful real-model evaluations.

`--demo-invalid-quote` inserts a clearly labelled synthetic item into a copy of
the returned card and applies the real guard. The diagnostic distinguishes this
demonstration from the actual model response. Nothing is persisted in either case.

The CLI exits with code 1 and a friendly message on failure, without an uncaught
stack trace. Stopping Ollama is not needed to check this: point `OLLAMA_URL` to
an unused local port for the command only. Keep your working service running.

If Console Ninja instrumentation interferes with local execution, prefix the
command with `NODE_ENV=production`; this does not disable validation or tests.

## Automated verification

Observed on the development Mac, 8 October 2026, with Node 22.21.1 and
`gemma3:4b` (`a2af6cc3eb7f`):

- First real CLI trial reached the default timeout after **181.07 s** and exited
  cleanly with the friendly timeout message. Build work was also running during
  that trial; this is not an isolated inference benchmark.
- A second trial, with the model already loaded and a command-only timeout of
  360 seconds, completed in **59.48 s**. Three items were kept (name, appearance,
  habitat), zero model items were removed. The explicitly injected CLI demo item
  was removed with `quote_not_found`.
- `ollama ps` reported **100% CPU**, 4096 context tokens and a 5.3 GB loaded model.
  The default configuration remains 180 seconds, not 360.
- `NODE_ENV=production npm test`: **123 tests passed**, six suites. The normal
  `npm test` script is unchanged. Production mode avoids Console Ninja hooks on
  this development machine, not application checks.
- `npm run lint` and `npm run build` passed, including copying the prompt for the
  compiled organizer. No packages were installed or updated for this milestone.
- With `OLLAMA_URL` pointing to a verified unused local port, the CLI returned
  the friendly unavailable message in **0.12 s**, exited with code 1 and created
  neither the isolated database path nor the photos directory. The real Ollama
  service was not stopped. A compiled-service smoke test also loaded the copied
  prompt successfully and kept its grounded fixture item.

Timing covers the organizer call, including HTTP and validation, not TypeScript
CLI startup. It depends on model loading, CPU load, note length and generated output.

```sh
npm test
npm run lint
npm run build
```

Tests use a fake `LlmClient` and mocked fetch/abort signals; none needs a running
Ollama or downloads a model. Coverage includes all card fields, Unicode and short
quotes, invented/altered evidence, unsupported dosages, per-quote checks, strict
schema rejection, retry recovery/exhaustion, empty/oversized notes, configurable
limits, malformed/truncated envelopes, missing models, connectivity, timeouts
while reading the response, and timer cleanup.

## References

- [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs)
  describes schema-constrained generation followed by application-side validation.
- [Ollama chat API](https://docs.ollama.com/api/chat) documents the request and envelope.
- [Zod JSON Schema](https://zod.dev/json-schema) documents the shared schema conversion.
- [Gabriel Anhaia: JSON Mode vs Structured Output vs Zod Parsing](https://dev.to/gabrielanhaia/json-mode-vs-structured-output-vs-zod-parsing-which-guarantees-shape-4hdh)
  distinguishes structure from truth; this informed keeping Zod and evidence checks
  as separate boundaries. This is a design rationale, not an accuracy guarantee.
