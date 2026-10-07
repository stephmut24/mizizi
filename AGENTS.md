# AGENTS.md

## Project
**Mizizi** ("roots" in Swahili): a local-first app that helps someone walk with an elder
(a grandparent, a neighbor) and turn what the elder says about the plants around them
into a printable family herbarium.

The person types, or dictates with the phone keyboard, what the elder said about a plant.
A local open-weight AI model (Gemma through Ollama) organizes those notes into a clean
plant card. Every statement on a card must be traceable to the person's own notes.
The app then generates a printable booklet and a short list of questions to ask on the
next walk, so it sends people back outside, with the elder.

Built for one real person: [ELDER / FRIEND NAME OR ROLE]. Challenge theme "Touch Grass":
get people off the screen and into the world. The app is used before and after a walk,
never during it.

**Everything is in English**: UI text, code, comments, docs, prompts.

## Hard constraints (never break these)
1. **Local-first and offline.** After `npm install` and the model download, the app must run
   with no internet. No cloud AI APIs. The AI runs through Ollama with an open-weight model
   (default `gemma3:4b`).
2. **No invention.** The AI only reorganizes what is in the user's notes. It must never add
   facts, uses, doses, scientific names or identifications of its own.
3. **Evidence rule.** Each AI-proposed item comes with a `quote` that must appear verbatim
   (ignoring case and extra whitespace) in the raw notes. Items without a valid quote are
   dropped by the code, and the user is told how many were removed.
4. **The AI never saves by itself.** It proposes; the user reviews, edits and confirms.
5. **No medical advice.** Traditional uses are shown as "told by [elder]". Every card and
   printout carries: "Traditional knowledge shared by [elder]. Not medical advice." The AI
   never suggests treatments, doses or safety claims.
6. **Consent and privacy.** A plant cannot be saved for an elder unless consent is recorded.
   Each plant is `private` or `shareable`. Private plants are excluded from every print view
   and export, enforced on the server, not only in the UI.
7. **No location tracking.** No GPS, no coordinates. A place is only a short free-text label.
8. **No new dependency without asking me first** (the allowed list is below). No secrets or
   API keys in the repo.
9. **Do not run git commands.** I commit myself.

## Stack
- **Backend:** Node.js 22.21.1 (user-approved override), NestJS (TypeScript, strict mode), `better-sqlite3` used
  directly through a small DatabaseService (no ORM), WAL mode, `class-validator` and
  `class-transformer` for DTOs, `zod` to validate the model's JSON output, `@nestjs/config`,
  `@nestjs/serve-static` to serve the built frontend, `@nestjs/swagger` for `/docs`.
  Ollama is called with the built-in `fetch` and `AbortController` (no axios).
- **Frontend:** React 18 + Vite + TypeScript, `react-router-dom` with the hash router.
  Plain CSS (CSS variables, no UI framework, no Tailwind, no CDN, no remote fonts or icons;
  system fonts, inline SVG).
- **Tests:** Jest and supertest (backend), Vitest and Testing Library only if time allows.
- **Lint and format:** ESLint and Prettier.
- Node 22.21.1 is approved by the user, replacing the original Node 20 requirement.
  Keep dependencies compatible with this runtime and the development Mac (macOS 12).
- If `better-sqlite3` fails to install, stop and tell me; do not switch libraries silently.

## Visual identity
A pressed-plant field notebook: warm cream paper (#F7F1E3), ink green (#24402E), clay accent
(#B5562F), serif headings (system serif stack such as Georgia), calm generous spacing, plant
cards that look like herbarium sheets with a thin border and a small label strip. High
contrast, touch targets at least 48 px, mobile-first and responsive. Avoid generic dashboard looks.

## Commands
- Install everything: `npm run install:all` (root script)
- Dev: `npm run dev:backend` (port 3000) and `npm run dev:frontend` (Vite, proxies `/api`)
- Production-like run (also for phones on the same Wi-Fi): `npm run build` then
  `npm run start` (Nest serves the built frontend, listens on `0.0.0.0:3000`)
- Test: `npm test` (backend). Lint: `npm run lint` (both packages)
- Root scripts use `npm --prefix`, no extra tooling.

## Layout
```
backend/
  src/
    main.ts, app.module.ts
    config/            # env variables: DB path, Ollama URL, model, timeout
    database/          # DatabaseService, schema
    elders/ walks/ plants/ followups/   # controller, service, DTOs per feature
    assistant/         # ollama client, organizer, grounding guard, prompts
    printing/          # print data endpoints (private plants refused)
  scripts/             # seed-demo.ts, try-organize.ts
  test/
frontend/
  src/ pages/ components/ api/ styles/ (main.css, print.css)
data/                  # SQLite file and photos, gitignored
docs/
```

## Code style
- TypeScript strict, no `any` unless justified in a comment. Small functions.
- Business logic in services, no business logic in controllers.
- Clear error messages with proper HTTP status codes.
- If Ollama is unreachable, manual card writing still works and the UI says so plainly.
- Ollama calls must tolerate a slow CPU-only machine: timeout from config (default 180 s),
  short prompts, at most 3 few-shot examples.

## Testing rules
- Every service with logic gets Jest tests. The Ollama client sits behind an interface so
  tests inject a fake; the test suite must never need a running model.
- Never edit a test only to make it pass. Fix the code or tell me why the test is wrong.

## Working style
- For any task bigger than one file, propose a short plan first and wait for my approval.
- One task at a time, stay in scope, mention ideas for later instead of building them.
- When finished, report: what changed, how to run it, assumptions, what is missing.

## Definition of done (every task)
- `npm test` and `npm run lint` pass; the frontend builds with `npm run build`.
- The feature works when I run the app and try it.
- No unrelated files were changed.
