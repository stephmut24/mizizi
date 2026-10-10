// Built-in Node APIs + installed Chrome. All records and servers are disposable.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser, until } from './review-browser.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = mkdtempSync(join(tmpdir(), 'mizizi-printing-'));
const report = {
  artifacts,
  externalRequests: [],
  pageErrors: [],
  plantWrites: 0,
  checks: [],
  screenshots: [],
};
let mode = 'valid';
let cancellations = 0;
const fake = createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString());
  assert.equal(request.url, '/api/chat');
  assert.equal(body.options.num_gpu, 0);
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
  response.end(
    JSON.stringify({
      done: true,
      message: {
        content: JSON.stringify([
          'Is there a family story?',
          'Are there other names?',
          'Should I use 5 mg?',
          'Not a question',
        ]),
      },
    }),
  );
});
await new Promise((resolve) => fake.listen(0, '127.0.0.1', resolve));
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
    OLLAMA_URL: `http://127.0.0.1:${fake.address().port}`,
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
  }, 'temporary print server');
  const api = async (path, body, method = 'POST') => {
    const response = await fetch(`${origin}/api/${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    assert(response.ok, `${path}: ${response.status}`);
    return response.json();
  };
  const elder = await api('elders', {
    display_name: 'Grandma Amani',
    consent_given: true,
    consent_note: 'SECRET CONSENT NOTE',
  });
  const walk = await api('walks', {
    elder_id: elder.id,
    walk_date: '2026-10-10',
    place_label: 'Family garden',
  });
  const plant = await api('plants', {
    elder_id: elder.id,
    walk_id: walk.id,
    local_name: 'Kijani',
    other_names: ['Our garden leaf'],
    appearance: ['Broad green leaves with a soft edge.'],
    habitat: ['Beside the family garden wall.'],
    uses: ['Grandma remembers using it as decoration.'],
    preparation: ['Pressed between notebook pages.'],
    warnings: ['No warnings recorded in this fictional example.'],
    story: 'We sat together after the walk and wrote down this memory.',
    raw_notes: 'SECRET RAW DRAFT',
    visibility: 'shareable',
  });
  const hidden = await api('plants', {
    elder_id: elder.id,
    local_name: 'SECRET PRIVATE NAME',
    story: 'SECRET PRIVATE STORY',
    raw_notes: 'SECRET PRIVATE NOTES',
  });
  await api(`plants/${hidden.id}/followups`, {
    questions: ['What memory would you like to share?'],
  });
  const longPlant = await api('plants', {
    elder_id: elder.id,
    local_name: 'A longer family memory',
    story: `${'We remembered walking together and noticing the shapes of the leaves. Nothing was added to this fictional account.\n\n'.repeat(28)}END OF LONG MEMORY`,
    visibility: 'shareable',
  });
  browser = await openBrowser(artifacts, origin, report);
  const { command, evaluate, click } = browser;
  const has = (text) =>
    evaluate(`document.body.textContent.includes(${JSON.stringify(text)})`);
  async function navigate(path, text) {
    await command('Page.navigate', { url: 'about:blank' });
    await until(
      () => evaluate(`location.href === 'about:blank'`),
      'fresh document',
    );
    await command('Page.navigate', { url: `${origin}/#${path}` });
    await until(() => has(text), text);
  }
  async function screenshots(label) {
    for (const width of [390, 1280]) {
      await command('Emulation.setDeviceMetricsOverride', {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      assert(
        await evaluate('document.documentElement.scrollWidth <= innerWidth'),
        `${label} overflow at ${width}`,
      );
      const { data } = await command('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
      });
      const name = `${label}-${width}.png`;
      writeFileSync(join(artifacts, name), Buffer.from(data, 'base64'));
      report.screenshots.push(name);
    }
  }
  const snapshot = () =>
    Promise.all(
      ['elders', 'walks', 'plants', 'followups'].map((path) =>
        api(path, undefined, 'GET'),
      ),
    );
  await navigate(`/herbarium/${plant.id}`, 'Questions for next time');
  await until(() => has('No questions saved yet.'), 'loaded followups');
  const before = await snapshot();
  await click('Suggest questions for next time');
  await until(() => has('Choose your questions'), 'question proposals');
  assert(!(await has('5 mg')));
  assert.deepEqual(await snapshot(), before);
  await screenshots('questions');
  await evaluate(
    `document.querySelectorAll('.question-proposals input')[1].click()`,
  );
  await click('Save selected questions');
  await until(() => has('Your chosen questions are saved'), 'chosen save');
  const saved = await api(`followups?plantId=${plant.id}`, undefined, 'GET');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].question, 'Is there a family story?');
  await click('Mark answered');
  await until(() => has('Question marked as answered.'), 'answered state');
  let sheet = await api(`print/nextwalk/${elder.id}`, undefined, 'GET');
  assert.equal(sheet.groups.length, 1);
  assert.equal(sheet.groups[0].label, `Folio #${hidden.id}`);
  await click('Ask again');
  await until(() => has('Question reopened'), 'reopened question');
  mode = 'pending';
  await click('Suggest questions for next time');
  await until(() => has('The model runs on this computer'), 'pending state');
  await click('Cancel suggestions');
  await until(() => cancellations > 0, 'cancel propagation');
  assert(!(await has('Choose your questions')));
  mode = 'unavailable';
  await click('Suggest questions for next time');
  await until(
    () => has('These notebook questions are based on gaps'),
    'offline templates',
  );
  assert(
    (await evaluate(
      `document.querySelectorAll('.question-proposals input').length`,
    )) > 0,
  );
  report.checks.push(
    'Suggest without writes; unsafe questions dropped; choose one, save, answer and reopen; cancel reaches local model; unavailable model yields templates.',
  );

  for (const [kind, id, text] of [
    ['card', plant.id, 'Plant card: Kijani'],
    ['booklet', elder.id, 'The Plants Grandma Amani Taught Me'],
    ['nextwalk', elder.id, 'Bring this, leave the phone in your pocket.'],
  ]) {
    await navigate(`/print/${kind}/${id}`, 'Print / Save as PDF');
    await until(
      () => evaluate(`Boolean(document.querySelector('.print-document'))`),
      `${kind} document`,
    );
    assert(
      await evaluate(
        `document.querySelector('.print-document').outerHTML.includes(${JSON.stringify(text)})`,
      ),
    );
    assert(!(await has('SECRET')));
    const paths = await evaluate(
      `performance.getEntriesByType('resource').map(item => new URL(item.name).pathname).filter(path => path.startsWith('/api/'))`,
    );
    assert(
      paths.length > 0 && paths.every((path) => path.startsWith('/api/print/')),
      `Print route fetched unfiltered records: ${paths}`,
    );
    await screenshots(kind);
    await evaluate(
      'window.printCalls = 0; window.print = () => { window.printCalls++; }',
    );
    await click('Print / Save as PDF');
    await until(
      () => evaluate('window.printCalls === 1'),
      'native print action',
    );
    const { data } = await command('Page.printToPDF', {
      printBackground: false,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });
    writeFileSync(join(artifacts, `${kind}.pdf`), Buffer.from(data, 'base64'));
  }
  report.checks.push(
    'Card, booklet and next-walk PDFs produced using Chrome native printing; 390px and 1280px previews have no overflow; print routes fetch only filtered endpoints.',
  );
  await navigate(`/print/card/${hidden.id}`, 'This plant is private.');
  assert.equal(
    await evaluate(`document.querySelector('.print-document')`),
    null,
  );
  assert(!(await has('SECRET')));
  await navigate(`/print/card/${plant.id}`, 'Print / Save as PDF');
  await until(
    () => evaluate(`Boolean(document.querySelector('.print-document'))`),
    'shareable preview',
  );
  await api(`plants/${plant.id}`, { visibility: 'private' }, 'PATCH');
  await evaluate(
    'window.printCalls = 0; window.print = () => { window.printCalls++; }',
  );
  await click('Print / Save as PDF');
  await until(
    () => has('This plant is private.'),
    'visibility rechecked before print',
  );
  assert.equal(await evaluate('window.printCalls'), 0);
  assert.equal(
    await evaluate(`document.querySelector('.print-document')`),
    null,
  );
  await api(`elders/${elder.id}`, { consent_given: false }, 'PATCH');
  await navigate(`/print/booklet/${elder.id}`, 'Consent must be recorded');
  assert.equal(
    await evaluate(`document.querySelector('.print-document')`),
    null,
  );
  report.checks.push(
    'Private direct URL denied; changing visibility after preview blocks Print and clears the document; revoked consent blocks booklet.',
  );
  assert(longPlant.id > plant.id);
  assert.deepEqual(report.externalRequests, []);
  assert.deepEqual(report.pageErrors, []);
  report.checks.push('Zero external page requests and browser exceptions.');
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
