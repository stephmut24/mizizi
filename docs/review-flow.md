# Local AI review flow (Prompt 04)

## Boundaries

- `POST /api/assistant/organize` takes exactly `{ "rawNotes": "..." }` and returns
  `{ card, kept, removed, missing, rejected }` with HTTP 200. It writes nothing and
  has no database dependency. Swagger lists it at `/docs`.
- Blank, non-string, oversized or unknown input fields produce HTTP 400. The
  configured `ORGANIZER_MAX_NOTES_CHARS` limit is checked by the existing service.
- Unreachable Ollama, timeout or missing model produce HTTP 503 with a manual
  fallback message. Invalid JSON/schema after one retry produces HTTP 422:
  "The model gave an unusable answer. Try again or write the card by hand."
- The evidence guard, prompt and database schema are unchanged. Quotes and
  counts come from the guarded response. Rejected diagnostics are never displayed
  as suggestions. If rejection reasons include more than missing quotes, the UI
  accurately says "did not pass the evidence checks".
- Request cancellation travels from the browser to the HTTP response-close
  handler and the Ollama fetch. The existing configurable backend timeout stays
  in charge; the frontend's usual 15-second CRUD deadline does not apply to AI.
  Cancelling the fetch asks Ollama to stop; immediate CPU release depends on Ollama.

## Review and save

The person must have recorded consent to use the organizer button. The endpoint
itself has no person ID and does not validate consent. The existing plant create
and update endpoints recheck current consent at save time, including revocation
after a review has already started. No authentication was added; use a trusted LAN.

Each proposal has an include checkbox, editable text and a read-only source quote.
Clicking the quote selects its first matching span in the raw-notes textarea,
with original UTF-16 offsets despite case/spacing differences. No HTML is injected.
Names and other names have separate labels to distinguish their destination fields.

Applying replaces only fields with selected, nonblank lines. Array fields use one
line per item; story items join with newlines. Entirely unchecked/empty groups leave
manual content unchanged. Raw notes, person, walk and visibility are never replaced.
The panel explains this replacement behavior before confirmation. Only the normal
Save action sends a plant write. Edits to proposal text are human edits, not newly
model-verified claims; the UI explicitly asks users to check them against the quote.

Cancel discards the proposal. Editing raw notes or switching person remounts the
review controls, aborting the old request and clearing its proposal. Navigation and
saving also cancel outstanding work. Each completion additionally checks request
identity and abort state, so late results cannot revive a cancelled review.
Missing topics mean no verified item was extracted, not proof the notes omit them.

## Run and verify

```sh
ollama list
npm run build
npm start
```

Open the notebook, choose a consenting person, paste fictional notes from
`docs/organizer-notes.txt`, then organize, uncheck a line, edit another, apply and
save. Try without a reachable model to see the manual fallback. Nothing calls an
external AI service or downloads a model automatically.

```sh
npm test
npm run lint
npm run build
npm --prefix frontend run test:review
```

The browser script uses only Node 22 built-ins and an installed Chrome. It defaults
to the macOS Chrome path; set `CHROME_PATH` for another installation. It starts its
own compiled backend, fake local Ollama and temporary SQLite database, never the
real `data/`. It retains screenshots and a JSON report in its printed temporary
directory and stops its own processes. No dependencies from another project are used.

For an opt-in real-model browser trial with fictional notes and a temporary database:

```sh
node frontend/scripts/verify-real-review.mjs
# Optional command-only override on a slow CPU:
OLLAMA_TIMEOUT_S=360 node frontend/scripts/verify-real-review.mjs
```

This script calls local `gemma3:4b` and reports the observed elapsed time. It does
not install/start/stop Ollama or alter the normal application configuration.

Jest uses fake LLMs and mocked fetch. Tests include all four populated tables
unchanged, error mappings, normal save validation/consent, cancellation reaching
the model, no retry after cancellation, reviewed-field mapping and quote offsets.
The browser check covers editing, deselection, applying without saving, saving,
quote highlighting, 390/1280px layouts, cancellation, stale proposal invalidation,
long requests, 400/422/503 fallbacks, manual save and post-review consent revocation.

If Console Ninja instrumentation interferes with tests on the development Mac,
use `NODE_ENV=production npm test`. This leaves all application checks enabled.

## Observed verification, 8 October 2026

- Node 22.21.1; 152 Jest tests passed across eight suites. No real model is used.
- The browser flow passed with a fake local Ollama and isolated SQLite, including
  390/1280px layouts, 48px controls, no external page requests and no uncaught
  JavaScript exceptions. Screenshots were inspected for both widths.
- The first real Gemma browser attempt, with the normal 180-second per-attempt
  configuration, returned the friendly unavailable message; no plant was written.
- A second real attempt with a command-only 360-second limit returned unavailable
  after **309.60 seconds**, again with zero writes and no browser exceptions.
  This was not a successful extraction or an inference benchmark. The response
  does not establish the precise underlying failure cause.
- `ollama list` confirmed `gemma3:4b` (`a2af6cc3eb7f`). During the second trial,
  `ollama ps` showed Gemma using 100% CPU, 4096 context tokens and 5.3 GB, alongside
  `llama3.1:8b` (6.6 GB) still marked `Stopping...`. Model unloading/resource
  contention is a possible contributor, not a proven diagnosis. No user service
  or unrelated model was stopped by these verification scripts.

The complete **real-Gemma browser workflow remains unverified** on this run.
Repeat the opt-in command after Ollama is responsive. The normal timeout remains
180 seconds; no persistent setting was raised to hide the failed trials.

## Scope and limitations

No new dependencies, schema migrations, cloud calls, GPS, auto-save, photo upload
or printing were added. Source quotes are transient review data, not stored in the
existing plant schema; original raw notes are saved unchanged with the card.
Reload/navigation still discards unsaved forms. Git commands are not run; commits
remain the repository owner's responsibility.

The model's evidence limitations and earlier real-model timings are documented in
[organizer notes](organizer.md). A browser test with a fake local model verifies the
flow deterministically, not Gemma's extraction accuracy or inference performance.

## Design reference

[Common Stale Closure Bugs in React](https://dev.to/cathylai/common-stale-closure-bugs-in-react-57l6)
by [Cathy Lai](https://dev.to/cathylai) informed cleanup and stale-response checks.
The [React effect documentation](https://react.dev/reference/react/useEffect)
also explains ignoring late responses. Cancellation and response ownership are
separate checks here; neither a request resolving nor a review being applied saves it.
