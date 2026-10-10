# Paper herbarium and next-walk questions

## What is implemented

- Three filtered backend routes and standalone React print routes:
  `#/print/card/:id`, `#/print/booklet/:elderId`, `#/print/nextwalk/:elderId`.
- A5, black-on-white, system-serif cards; booklet cover and folio contents;
  personal question sheets with space for handwritten answers. Native browser
  printing and Save as PDF, with no PDF package.
- A question-review section on plant details. Suggest, select, explicitly save,
  mark answered or reopen. Cancel aborts the browser request and model call.
- No new runtime dependency, database table, column or migration. The existing
  organizer evidence guard is unchanged.

## Privacy and consent

The printing service queries explicit columns. A private card returns 403.
Booklets query only shareable plants and return `skippedPrivateCount`, never a
list of excluded plants. Raw notes, consent notes, photo paths and other internal
fields are not returned, even for shareable cards. All print routes refuse an
elder whose consent has been withdrawn.

The approved Prompt 05 exception is the personal next-walk sheet: it may contain
unanswered questions for a private plant, grouped under `Folio #ID`. Private
plant names and notes are not returned as fields. Chosen question text is returned
verbatim and can itself contain personal context; review the sheet before sharing.
Only questions belonging to the requested elder are included. Answered questions
are omitted, and deleting a plant still cascades to its questions.

Print pages sit outside the notebook data provider and fetch only print endpoints.
Responses use `Cache-Control: no-store`; the Print button refreshes permissions
and data before calling `window.print()`. If permission was revoked, it clears
the preview and shows an error. Normal notebook pages are hidden by print CSS.

This is not authentication or DRM. The household's normal CRUD API can read
private records. An already downloaded PDF, screenshot or open preview cannot be
remotely recalled; a browser's direct print command can print an already loaded
preview. Do not expose this single-household app on an untrusted network.

## Suggestion rules and persistence

Missing topics are derived from empty saved card fields, since organizer proposals
are not stored. The local model receives a bounded excerpt of the existing card
and notes. The prompt asks for questions only, with no invented premise, species
identification, treatment, amount or safety claim. Its JSON array is validated
with Zod, with one retry for bad output. Connection errors/timeouts, repeated bad
output, or a result with no retained questions use topic templates.

The pure guard trims and deduplicates questions, retains at most four, requires
`?` and at most 140 characters, and rejects numbers and a conservative vocabulary
of dosage/treatment/safety expressions. Rejecting all numbers is intentionally
stricter than rejecting dosage numbers alone. This heuristic is not a semantic
proof: people must review every question for fit and safety. Questions are not
evidenced plant facts and never fill card fields.

`POST /api/plants/:id/followups/suggest` writes nothing. Only
`POST /api/plants/:id/followups` saves selected questions, in one transaction.
The batch contains one to four strings. Retrying an exact saved question returns
the existing record, including its answered state, rather than duplicating it.
`PATCH /api/followups/:id` accepts `answered: true` or `false`.
Existing manual question creation/editing uses the same guard; old records are
not rewritten. Consent is enforced on suggestions, chosen saves, question edits
and answered-state changes, and rechecked after a slow model response.

## How to use and verify

```sh
npm test
npm run lint
npm run build
npm start
```

In a plant detail, save chosen questions, then open one of the three print views.
Print with A5 paper, normal scaling, and browser headers/footers disabled. Long
cards flow onto extra pages; no fixed-height clipping or automatic tiny type is
used. Folio numbers in contents remain stable when pagination changes. The
notice appears on each card, booklet cover and question sheet. A long card's
notice follows its final text, not every continuation page. Booklet imposition
for folded/duplex paper is left to the printer driver, not implemented in the app.

The optional browser check uses Node 22's built-in WebSocket and installed Chrome:

```sh
npm --prefix frontend run test:printing
```

It creates an isolated SQLite file and fake local model server, seeds fictional
records, exercises review/save/answer/cancel/fallback, checks privacy on direct
URLs and after revocation, and produces three PDFs plus 390px/1280px screenshots
in the temporary directory printed at completion. It never uses the real database
or requires Ollama. Set `CHROME_PATH` if Chrome is elsewhere.

On macOS, the optional system PDFKit checker rasterizes every PDF page, extracts
text, checks A5 dimensions, private-data exclusion and long-text continuation:

```sh
swift frontend/scripts/inspect-print.swift /absolute/path/to/test-artifacts
```

The script uses macOS frameworks only; it is not part of the production app.
Artifacts stay in the named temporary folder for manual inspection.

### Verification observed on 2026-10-10

- Node 22.21.1; `npm test`: 194 tests in 11 suites passed. This machine's
  test run used `NODE_ENV=production` to avoid local editor instrumentation;
  the test helper still injects a unique temporary database for every app.
- `npm run lint` and `npm run build`: passed.
- `npm --prefix frontend run test:review`: passed, including evidence highlighting,
  selection/edit/apply/save, cancellation, stale-response protection, validation,
  consent and manual writing when the fake model is stopped.
- `npm --prefix frontend run test:printing`: passed at 390px and 1280px, with
  zero external page requests and zero browser exceptions. Both browser suites
  used fake local model servers, not the user's Ollama process or real notebook.
- Native Chrome PDFs were inspected using macOS PDFKit and rendered previews:
  compact card, one A5 page; booklet with a deliberately long story, six A5
  pages; next-walk sheet with two real saved test questions, one A5 page.
  No blank page, missing final text, private plant fields or printed toolbar.
- Final browser artifacts: `mizizi-printing-W00lvu` and `mizizi-review-XYPXby`
  inside the system temporary directory. The printing folder contains the PDFs,
  responsive screenshots, browser report and page-by-page PDF report/previews.

## Limitations

No photo printing/upload, PDF library, cloud service, GPS, automatic saves or new
navigation tab. Physical printer margins and pagination in browsers other than
Chrome need device-specific checking. A new real-Gemma question timing has not
been measured for this milestone; the organizer's prior real-model trial is
documented separately in `review-flow.md`.
