# Notebook UI verification

## Run the application

Use Node 22.21.1. From the repository root, run `npm run install:all`,
`npm run build`, then `npm start`. Open `http://localhost:3000` or the computer's
LAN address from a phone on the same trusted Wi-Fi. No internet is needed at runtime.

## Checks performed

The complete functional browser run passed. After the final presentation
adjustments, all five production screens were checked again at 390 and 1280 px
using Chrome's debugging protocol directly from Node, without another project's
dependencies. The sticky header, mobile specimen placement, target sizes and
overflow checks passed. The development review controls passed the earlier
functional run; their final placement below the raw notes was not rechecked.

- `npm test`: 49 backend tests passed against temporary SQLite databases.
- Final repeat: `NODE_ENV=production npm test` passed all 49 tests in 6.4 seconds,
  with no shutdown warning. A diagnostic run with Console Ninja instrumentation
  had timed out on one HTTP test. Production mode avoids that instrumentation;
  no tests, timeouts or backend source were changed to obtain the passing result.
- `npm run lint` and `npm run build`: passed.
- Real Chromium browser against `npm start`, with an isolated temporary database:
  create a person without consent, verify the plant block, add a consenting person,
  log a walk, create a complete plant, edit it, reload, withdraw consent and delete it.
- Required-field validation, default private visibility, linked-walk preselection,
  multiline arrays, preserved raw-note whitespace, alternate-name search, person
  filtering, empty results and live walk counts.
- Network failure during save retains the form; retry works. Initial loading,
  unavailable-server messaging and recovery are checked too.
- Five screens captured at 390 and 1280 px: Herbarium, plant detail, New plant,
  Walks and People. No horizontal overflow; primary controls are at least 48 px.
  The herbarium grid has one column at 390, two at 820 and three at 1280 px.
- Production browser request monitoring: **zero external requests** across page
  loads and navigation; **zero uncaught JavaScript errors**. API requests go only
  to the local server. Deliberately failed requests test the error states.
- Development review controls are editable but cannot copy or save sample data.
  The fixture is absent from the production UI.

## Repeat the optional browser check

No browser-test dependency was added to the project. If an explicitly approved,
standalone Playwright Core installation and a compatible Chromium browser are
available, point to their absolute paths. Do not borrow another project's dependencies:

```sh
npm run build
PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core \
CHROME_PATH=/absolute/path/to/chrome \
  npm --prefix frontend run test:ui
```

The script starts and stops its own production server and development preview.
It allocates a temporary database and photos directory, never the real `data/`.
Screenshots and a JSON report remain in the printed temporary directory for
inspection. Browser installation is optional; `npm test` does not require it.

## Design interpretation and intentional differences

The supplied references are the ten HTML files in `design/`; no PNG reference
files were present. Colors, type sizes, spacing, card borders and responsive
arrangements were taken from those exports. Browser captures were inspected;
this is not a pixel-diff claim against original screenshots.

- Georgia/system sans-serif replace remote EB Garamond/Inter. Inline SVG replaces
  remote icons, avatar images and botanical pictures. Photo placeholders are
  deliberately generic, not plant identifications.
- Main buttons and secondary text use darker variants from the palette for contrast.
  Focus rings and 48 px targets are retained, even where exports are smaller.
- Only Herbarium, Walks and People are navigation destinations. Decorative account
  controls, fabricated scientific names, coordinates, verification seals, printing
  and AI action buttons are omitted because they are outside this milestone.
- All counts, names, dates and excerpts come from notebook records, not the export's
  sample content. The safety notice appears on every plant card and detail.
- The manual form includes all API fields. The fictional review panel appears only
  after enabling the development flag; the real organizer and review-save flow are
  reserved for later prompts. Consent notes use free text, not preset assertions.
- Person editing supports correcting or withdrawing consent. Revocation does not
  claim to archive or erase existing plants; it prevents further plant writes.

No backend source changes were needed. Photo upload, AI, printing and exports are
not implemented in this milestone. Hash navigation does not preserve unsaved forms;
reload the page to see edits made on a different device.
