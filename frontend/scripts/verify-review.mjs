import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser, until } from './review-browser.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = mkdtempSync(join(tmpdir(), 'mizizi-review-'));
const report = {
  artifacts,
  externalRequests: [],
  pageErrors: [],
  plantWrites: 0,
  checks: [],
  screenshots: [],
};
const notes = 'We call it Kijani. Its leaves are green. It grows by the wall.';
const fixture = {
  localName: { text: 'Kijani', quote: 'We call it Kijani.' },
  otherNames: [],
  appearance: [{ text: 'Green leaves', quote: 'Its leaves are green.' }],
  habitat: [{ text: 'By the wall', quote: 'It grows by the wall.' }],
  uses: [],
  preparation: [],
  warnings: [],
  story: [{ text: 'Invented story', quote: 'My grandmother planted it.' }],
  missing: [],
};
let mode = 'valid';
let calls = 0;
let cancellations = 0;
const fake = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  assert.equal(request.url, '/api/chat');
  const body = JSON.parse(Buffer.concat(chunks).toString());
  assert.equal(body.stream, false);
  assert.equal(body.options.num_gpu, 0);
  calls++;
  response.once('close', () => {
    if (!response.writableEnded) cancellations++;
  });
  if (mode === 'pending') return;
  response.setHeader('Content-Type', 'application/json');
  if (mode === 'unavailable') {
    response.writeHead(503);
    response.end('{}');
    return;
  }
  const card = mode === 'invalid' ? {} : fixture;
  response.end(
    JSON.stringify({ message: { content: JSON.stringify(card) }, done: true }),
  );
});
await new Promise((resolve) => fake.listen(0, '127.0.0.1', resolve));
const fakePort = fake.address().port;
const probe = createServer();
await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['dist/main.js'], {
  cwd: join(root, 'backend'),
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    DB_PATH: join(artifacts, 'test.db'),
    PHOTOS_DIR: join(artifacts, 'photos'),
    OLLAMA_URL: `http://127.0.0.1:${fakePort}`,
    OLLAMA_TIMEOUT_S: '180',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (data) => {
  log += data;
});
server.stderr.on('data', (data) => {
  log += data;
});
let browser;
try {
  await until(async () => {
    if (server.exitCode !== null) throw new Error(log);
    return fetch(`${origin}/api/health`)
      .then((response) => response.ok)
      .catch(() => false);
  }, 'temporary notebook server');
  const api = async (path, body, method = 'POST') => {
    const response = await fetch(`${origin}/api/${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    assert(response.ok, `${path}: ${response.status}`);
    return response.json();
  };
  const person = await api('elders', {
    display_name: 'Fictional review elder',
    consent_given: true,
  });
  const snapshot = async () =>
    Promise.all(
      ['elders', 'walks', 'plants', 'followups'].map((path) =>
        api(path, undefined, 'GET'),
      ),
    );
  const before = await snapshot();
  browser = await openBrowser(artifacts, origin, report);
  const { command, evaluate, fill, click } = browser;
  const organizer = '[aria-label="Local AI notes organizer"]';
  const has = (text) =>
    evaluate(`document.body.textContent.includes(${JSON.stringify(text)})`);
  async function newPlant() {
    // Hash navigation to the same route can retain the existing React form.
    // Start a fresh document so scenarios never inherit the previous review.
    await command('Page.navigate', { url: 'about:blank' });
    await until(
      () => evaluate(`location.href === 'about:blank'`),
      'fresh document',
    );
    await command('Page.navigate', { url: `${origin}/#/herbarium/new` });
    await until(
      () => evaluate(`Boolean(document.getElementById('elder_id'))`),
      'new plant form',
    );
    await fill('elder_id', String(person.id));
    await fill('raw_notes', notes);
  }
  async function review() {
    await click('Organize my notes with local AI');
    await until(
      () => has('Here is what I found in your notes'),
      'review proposal',
    );
  }
  await newPlant();
  await fill('habitat', 'Manual habitat stays');
  await fill('warnings', 'Manual warning stays');
  await review();
  assert(
    await has(
      '3 items kept, 1 removed because they were not found in your notes.',
    ),
  );
  assert(!(await has('Invented story')));
  assert.deepEqual(await snapshot(), before);
  for (const width of [390, 1280]) {
    await command('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    assert(
      await evaluate('document.documentElement.scrollWidth <= innerWidth'),
      `overflow ${width}`,
    );
    const small = await evaluate(
      `Array.from(document.querySelector(${JSON.stringify(organizer)}).querySelectorAll('button, input:not([type="checkbox"]), .check-row')).filter(element => element.getBoundingClientRect().height < 48).length`,
    );
    assert.equal(small, 0, `48px review targets at ${width}`);
    const { data } = await command('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
    });
    const filename = `review-${width}.png`;
    writeFileSync(join(artifacts, filename), Buffer.from(data, 'base64'));
    report.screenshots.push(filename);
  }
  await evaluate(`document.querySelectorAll('.quote-link')[1].click()`);
  assert.equal(
    await evaluate(
      `(() => { const notes = document.getElementById('raw_notes'); return notes.value.slice(notes.selectionStart, notes.selectionEnd); })()`,
    ),
    'Its leaves are green',
  );
  await evaluate(
    `document.querySelectorAll('.review-line input[type="checkbox"]')[2].click()`,
  );
  await fill('review-1', 'Green leaves, reviewed by me');
  assert.equal(
    await evaluate(`document.getElementById('appearance').value`),
    '',
  );
  await click('Use these in my card');
  assert.equal(
    await evaluate(`document.getElementById('local_name').value`),
    'Kijani',
  );
  assert.equal(
    await evaluate(`document.getElementById('appearance').value`),
    'Green leaves, reviewed by me',
  );
  assert.equal(
    await evaluate(`document.getElementById('habitat').value`),
    'Manual habitat stays',
  );
  assert.equal(
    await evaluate(`document.getElementById('warnings').value`),
    'Manual warning stays',
  );
  assert.deepEqual(await snapshot(), before);
  assert.equal(report.plantWrites, 0);
  await click('Save plant');
  await until(
    () => evaluate(`document.querySelector('h1')?.textContent === 'Kijani'`),
    'saved plant detail',
  );
  const plants = await api('plants', undefined, 'GET');
  assert.equal(plants.length, 1);
  assert.deepEqual(plants[0].appearance, ['Green leaves, reviewed by me']);
  assert.deepEqual(plants[0].habitat, ['Manual habitat stays']);
  assert.equal(plants[0].raw_notes, notes);
  assert.equal(report.plantWrites, 1);
  assert(
    await has(
      'Traditional knowledge shared by Fictional review elder. Not medical advice.',
    ),
  );
  await command('Page.navigate', { url: `${origin}/#/herbarium` });
  await until(() => has('Kijani'), 'saved herbarium card');
  report.checks.push(
    'Review, evidence highlighting, uncheck/edit/apply, no writes before Save, saved card and notice.',
  );

  await newPlant();
  await fill('local_name', 'Manual name');
  await review();
  await click('Cancel', organizer);
  assert.equal(
    await evaluate(`document.getElementById('local_name').value`),
    'Manual name',
  );
  await review();
  await fill('raw_notes', `${notes} Changed.`);
  assert(!(await has('Here is what I found in your notes')));
  mode = 'pending';
  for (const action of ['cancel', 'edit', 'navigate']) {
    await newPlant();
    const calledBefore = calls;
    const cancelledBefore = cancellations;
    await click('Organize my notes with local AI');
    await until(() => calls > calledBefore, 'pending local model');
    assert(await has('The model runs on this computer and may take a minute.'));
    if (action === 'cancel') {
      // A model request must survive the normal API client's 15 second timeout.
      await until(async () => {
        const elapsed = await evaluate(
          `window.__reviewTicks = (window.__reviewTicks || 0) + 1`,
        );
        return elapsed >= 160;
      }, 'long AI wait');
      assert(
        await has('The model runs on this computer and may take a minute.'),
      );
      await click('Cancel', organizer);
    } else if (action === 'edit')
      await fill('raw_notes', 'Changed notes during inference.');
    else await evaluate(`location.hash = '#/walks'`);
    await until(() => cancellations > cancelledBefore, 'abort reached Ollama');
    assert(!(await has('Here is what I found in your notes')));
  }
  report.checks.push(
    'Cancel discards review; changed notes discard stale proposals; request survives 15s; cancel/edit/navigation abort upstream.',
  );

  mode = 'valid';
  await newPlant();
  // Deliberately emulate a transport that ignores abort and resolves late.
  await evaluate(`(() => {
    const original = window.fetch.bind(window);
    window.fetch = (url, options) => {
      if (url === '/api/assistant/organize' && !window.__heldReview) {
        window.__heldReview = true;
        return new Promise(resolve => {
          window.__finishOldReview = () => resolve(new Response(JSON.stringify({
            card: ${JSON.stringify({ ...fixture, story: [] })}, kept: 999, removed: 0, missing: [], rejected: []
          }), { headers: { 'Content-Type': 'application/json' } }));
        });
      }
      return original(url, options);
    };
  })()`);
  await click('Organize my notes with local AI');
  await click('Cancel', organizer);
  await review();
  await evaluate(
    `window.__finishOldReview(); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`,
  );
  assert(!(await has('999 items kept')));
  assert(await has('3 items kept'));
  report.checks.push(
    'A cancelled request resolving after a newer proposal cannot replace that proposal.',
  );

  mode = 'invalid';
  await newPlant();
  const invalidBefore = calls;
  await click('Organize my notes with local AI');
  await until(() => has('The model gave an unusable answer.'), '422 fallback');
  assert.equal(calls - invalidBefore, 2);
  mode = 'unavailable';
  await click('Organize my notes with local AI');
  await until(
    () => has('Writing the card by hand still works.'),
    '503 fallback',
  );
  await fill('raw_notes', 'x'.repeat(4001));
  const tooLongBefore = calls;
  await click('Organize my notes with local AI');
  await until(
    () => has('Keep the notes within 4000 characters.'),
    '400 validation',
  );
  assert.equal(calls, tooLongBefore);
  await fill('local_name', 'Manual fallback plant');
  await fill('raw_notes', notes);
  await click('Save plant');
  await until(
    () =>
      evaluate(
        `document.querySelector('h1')?.textContent === 'Manual fallback plant'`,
      ),
    'manual fallback save',
  );
  assert.equal((await api('plants', undefined, 'GET')).length, 2);
  report.checks.push(
    '422 after one retry, 503 friendly fallback, 400 length limit, successful manual save without AI.',
  );

  mode = 'valid';
  await newPlant();
  await review();
  await click('Use these in my card');
  await api(`elders/${person.id}`, { consent_given: false }, 'PATCH');
  await click('Save plant');
  await until(
    () =>
      evaluate(
        `Array.from(document.querySelectorAll('[role="alert"]')).some(element => element.textContent.includes('Consent must be recorded'))`,
      ),
    'consent validation error',
  );
  assert.equal((await api('plants', undefined, 'GET')).length, 2);
  assert.equal(
    await evaluate(`document.getElementById('local_name').value`),
    'Kijani',
  );
  report.checks.push(
    'Consent revoked after review is rejected by the existing save endpoint; form preserved.',
  );
  // Stop only our fake service, never the user's actual Ollama process.
  await api(`elders/${person.id}`, { consent_given: true }, 'PATCH');
  fake.closeAllConnections();
  await new Promise((resolve) => fake.close(resolve));
  await newPlant();
  await click('Organize my notes with local AI');
  await until(
    () => has('Writing the card by hand still works.'),
    'stopped model server fallback',
  );
  report.checks.push(
    'Stopping the isolated model server produces the friendly unavailable message in the real UI.',
  );
  assert.deepEqual(report.externalRequests, []);
  assert.deepEqual(report.pageErrors, []);
  report.checks.push(
    'Production build at 390/1280px: no overflow, 48px controls, zero external page requests and browser exceptions.',
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  browser?.close();
  server.kill('SIGTERM');
  fake.closeAllConnections();
  await new Promise((resolve) => fake.close(resolve));
  writeFileSync(
    join(artifacts, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(`Artifacts retained: ${artifacts}`);
}
