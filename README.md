# Mizizi

Mizizi ("roots" in Swahili) is a local family herbarium for preserving what an
elder shares about plants during a walk. Use it before and after going outside.
Traditional knowledge shared by the elder. Not medical advice.

This first milestone contains a NestJS/SQLite API and a React health-check page.
AI organization, review screens, photo handling, printing and exports are future
milestones. No model, account, API key or internet connection is needed to run
this milestone after installation.

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
| `PORT`             | `3000`                   |

Ollama settings are reserved configuration only: no AI calls exist yet. If you
change `PORT`, adjust the development proxy in `frontend/vite.config.ts` too.
Startup validates the settings, creates missing data directories and tables,
enables SQLite WAL and foreign keys, and closes the database on shutdown.
The initial schema is idempotent; future schema changes will need migrations.

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
- `frontend/src/`: the minimal React page and local CSS.
- `AGENTS.md`: contributor constraints; `plan.md`: the overall project plan.

Nest/React runtime packages, their TypeScript types, Jest's TypeScript adapter,
ts-node, and ESLint's TypeScript adapter are supporting tooling for the agreed
stack. No ORM or cloud service is used. A scoped npm override upgrades Swagger's
`js-yaml` dependency to a patched 5.x release; remove it once Swagger itself
requires the corrected version.
