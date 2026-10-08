# Mizizi

Mizizi ("roots" in Swahili) is a local family herbarium for preserving what an
elder shares about plants during a walk. Use it before and after going outside.
Traditional knowledge shared by the elder. Not medical advice.

This milestone contains a NestJS/SQLite API and a responsive React notebook:
People, Walks and Herbarium. Record consent, log walks, write plant cards by hand,
and search, edit or delete them. Manual writing needs no model, account, API key
or internet after installation. The backend also has a local Ollama organizer
with verified source quotes, available through a CLI. Connecting it to the review
UI, photo uploads, printing and exports are future milestones.

## Requirements and installation

- Node **22.21.1** and npm. The owner approved Node 22 in place of the original
  Node 20 requirement; `.nvmrc` selects the Node 22 release line.
- Run from the repository root:

```sh
npm run install:all
```

The backend and frontend each have their own package lock. Keep both lockfiles
when sharing the repository. For a frozen dependency install, use
`npm --prefix backend ci` and `npm --prefix frontend ci`.

`better-sqlite3` is a native dependency. If npm cannot download a matching
prebuilt binary, compilation needs the platform's build tools (on macOS,
Xcode Command Line Tools and Python). If installation fails, report the error;
do not substitute another database library.

## Development

Start these in separate terminals:

```sh
npm run dev:backend
```

```sh
npm run dev:frontend
```

The backend listens on `http://localhost:3000`; Swagger is at
`http://localhost:3000/docs`, and `GET /api/health` returns `{"status":"ok"}`.
Restart the backend command after source changes. Vite provides frontend hot
reload at `http://localhost:5173` and proxies `/api` to backend port 3000.

For the built application, including access from a phone on the same Wi-Fi:

```sh
npm run build
npm start
```

Open `http://localhost:3000`, or `http://<your-computer-LAN-address>:3000` on the
phone. Nest listens on `0.0.0.0`. This is a single-household app with no login;
use a trusted network, not a public deployment. The normal notebook API includes
private plants; `visibility` controls future publishing/print/export behavior,
not authentication.

The backend starts even when `frontend/dist` does not exist. In that case `/`
returns 404 while `/api` and `/docs` remain available. Build the frontend and
restart the backend to serve the page. Only `frontend/dist` is served as static
content; database files and photos are not exposed.

## Use the notebook

1. Open **People**, add a name and languages, and record the person's actual
   agreement. The consent checkbox is unchecked by default. Saving a person
   without consent is allowed, but creating plants for them is not.
2. Open **Walks**, choose a person, date and short place label. Duration is optional.
3. Choose **Add a plant from this walk**, or **New plant** in Herbarium. Enter a
   local name and what they told you. List fields take one item per line; People
   languages take comma-separated values. Leave anything not discussed blank.
4. Plants default to **Private**. Choose **Shareable** only with their permission.
   Search by local/other name, filter by person, and open a card to edit or delete
   it. Deletion requires confirmation. Walk counts update after plant changes.

Use **Edit person** to correct their details or withdraw consent. Existing plants
remain visible and can be deleted; further plant edits are blocked without
consent. A walk can be recorded before consent, but no plants can be added for
that person. The server enforces these rules too.

The app uses hash routes (`#/herbarium`, `#/walks`, `#/people`). Records load when
the notebook opens and update after your own saves. Refresh to see changes made
from another browser. Unsaved form contents are not persisted across navigation.
The local server must stay running; offline means no internet is needed, not that
the phone stores an independent copy when disconnected from the computer.

### Development-only review layout

With the backend running, enable the fictional review fixture:

```sh
VITE_REVIEW_PREVIEW=true npm run dev:frontend
```

Add a consenting test person, then open **New plant**. Below the raw notes is a
clearly labelled preview with editable lines, checkboxes, source quotes, a summary
and missing-information reminders. Its controls never modify or save a real card.
The fixture is excluded from production builds, even when the flag is set. No AI
endpoint is called. The connection point is marked `TODO connect in prompt 04`.

## Configuration

Optionally create `backend/.env` using `backend/.env.example` as a reference.
Environment variables take precedence. Relative filesystem paths are resolved
against `backend/`, independently of the shell's working directory.

| Variable           | Default                  |
| ------------------ | ------------------------ |
| `DB_PATH`          | `../data/mizizi.db`      |
| `PHOTOS_DIR`       | `../data/photos`         |
| `OLLAMA_URL`       | `http://localhost:11434` |
| `OLLAMA_MODEL`     | `gemma3:4b`              |
| `OLLAMA_TIMEOUT_S` | `180`                    |
| `ORGANIZER_MAX_NOTES_CHARS` | `4000`          |
| `PORT`             | `3000`                   |

Ollama is only called when the organizer is explicitly invoked; the notebook can
still start and be used manually when Ollama is stopped. If you change `PORT`,
adjust the development proxy in `frontend/vite.config.ts` too.
Startup validates the settings, creates missing data directories and tables,
enables SQLite WAL and foreign keys, and closes the database on shutdown.
The initial schema is idempotent; future schema changes will need migrations.

## Try the local organizer (Prompt 03)

Start Ollama and confirm the exact installed model name:

```sh
ollama list
npm run try:organize -- docs/organizer-notes.txt
npm run try:organize -- docs/organizer-notes.txt --demo-invalid-quote
```

The default model is `gemma3:4b`. If it is not installed, download it beforehand
with `ollama pull gemma3:4b` (requires internet and disk space). Subsequent calls
stay local. `notes.txt` paths are relative to where you invoked npm.

The CLI prints the proposed card, evidence quotes, kept/removed counts, rejected
items with reasons, missing topics and elapsed time. The demo flag adds one
clearly labelled fake item **after** the real model response and shows the guard
rejecting it; it is not a claim that Ollama generated that item.
Neither command opens SQLite or saves notes/cards. No HTTP organizer endpoint or
frontend AI connection is added in this milestone.

The timeout is 180 seconds per call. Only invalid JSON/schema output gets one
retry (at most two calls); connection errors, timeouts and missing models return
a friendly message with exit code 1 and no uncaught stack trace. Manual writing
remains available. See [organizer design, limits and verification](docs/organizer.md)
and [fictional multilingual examples](docs/organizer-examples.json).

## Try the API from Swagger

At `/docs`, expand each operation and select **Try it out**, then **Execute**.
Use the IDs returned by the preceding request in these fictional examples:

1. `POST /api/elders`:

   ```json
   {
     "display_name": "Demo elder",
     "languages": ["English"],
     "consent_given": true,
     "consent_note": "Fictional demo consent."
   }
   ```

2. `POST /api/walks`:

   ```json
   {
     "elder_id": 1,
     "walk_date": "2026-10-07",
     "place_label": "Family garden",
     "duration_minutes": 20
   }
   ```

3. `POST /api/plants`:

   ```json
   {
     "elder_id": 1,
     "walk_id": 1,
     "local_name": "Demo leaf",
     "appearance": ["Small leaves"],
     "raw_notes": "The elder said: small leaves.",
     "visibility": "private"
   }
   ```

For real records, record the elder's actual agreement before creating plants.
Creating or updating a plant without consent returns HTTP 400. Revoking consent
blocks further plant and follow-up writes; existing records remain available
for review or deletion. A linked walk must belong to the same elder.

| Resource         | Operations                                             |
| ---------------- | ------------------------------------------------------ |
| `/api/elders`    | `POST`, `GET`; `GET /:id`, `PATCH /:id`                |
| `/api/walks`     | `POST`, `GET` (includes `plant_count`); `GET /:id`     |
| `/api/plants`    | `POST`, `GET`; `GET /:id`, `PATCH /:id`, `DELETE /:id` |
| `/api/followups` | `POST`, `GET`; `GET /:id`, `PATCH /:id`, `DELETE /:id` |

Plant list filters: `?elderId=1&visibility=shareable&search=leaf`. Search matches
literal substrings of `local_name` and each `other_names` entry; ASCII letter
case is ignored. SQLite's default search does not perform full Unicode case
folding. Follow-ups can be filtered with `?plantId=1`; update `answered` with a
JSON boolean. Deleting a plant also deletes its follow-ups.

API bodies use `snake_case`, IDs are positive integers, and flags are JSON
booleans (stored as SQLite 0/1). `languages`, `other_names`, `appearance`,
`habitat`, `uses`, `preparation` and `warnings` are arrays of strings, stored as
JSON text. `story` and `raw_notes` are strings. Raw notes retain their original
spacing and capitalization. `walk_date` is `YYYY-MM-DD`; `duration_minutes` is a
nonnegative integer or null. `walk_id` and `photo_path` also accept null.
`photo_path` is metadata only in this milestone.

Unknown body fields and unknown plant/follow-up filters return 400; other invalid
input also returns 400, and missing records return 404. Plant visibility defaults
to `private`. No export or print endpoints exist in this milestone.

## Verification and layout

```sh
npm test
npm run lint
npm run build
```

Jest covers service rules, database lifecycle, configuration and HTTP behavior
using supertest. Each test app overrides its database and photos paths to a
unique temporary directory and removes that directory when done. Tests never
use the real `data/` database or a running model.

- `backend/src/config/`: environment validation and stable filesystem paths.
- `backend/src/database/`: direct `better-sqlite3` wrapper and initial schema.
- `backend/src/elders/`, `walks/`, `plants/`, `followups/`: DTOs, controllers,
  services and Nest modules. Services own business rules.
- `backend/test/`: isolated SQLite and HTTP tests.
- `backend/src/assistant/`: typed Ollama boundary, Zod schema, evidence guard,
  short prompt and organizer. No database dependency.
- `backend/scripts/try-organize.ts`: real-model CLI. The build copies the prompt
  into `dist/assistant/prompts/` for compiled use too.
- `frontend/src/api/`: typed API requests and shared notebook state.
- `frontend/src/pages/`: People, Walks, Herbarium, plant detail and plant form.
- `frontend/src/components/`: navigation, fields, notices, delete dialog and the
  development-only review preview.
- `frontend/src/styles/main.css`: Stitch-derived tokens and responsive plain CSS.
- `frontend/scripts/verify-ui.mjs`: optional isolated browser smoke test; see
  [UI verification](docs/ui-verification.md) for setup, coverage and visual deviations.
- `AGENTS.md`: contributor constraints; `plan.md`: the overall project plan.

Nest/React runtime packages, their TypeScript types, Jest's TypeScript adapter,
ts-node, and ESLint's TypeScript adapter are supporting tooling for the agreed
stack. No ORM or cloud service is used. A scoped npm override upgrades Swagger's
`js-yaml` dependency to a patched 5.x release; remove it once Swagger itself
requires the corrected version.

`react-router-dom` is the only new app dependency for the notebook milestone.
The UI uses local CSS, system fonts and inline SVG; nothing from the design
exports' CDNs or remote image servers is loaded.
