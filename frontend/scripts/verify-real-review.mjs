// Opt-in real-model smoke test. Sends only these fictional notes to local Ollama.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowser, until } from './review-browser.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const timeout = Number(process.env.OLLAMA_TIMEOUT_S || 180);
assert(
  Number.isInteger(timeout) && timeout > 0,
  'Positive OLLAMA_TIMEOUT_S required',
);
const artifacts = mkdtempSync(join(tmpdir(), 'mizizi-real-review-'));
const report = {
  artifacts,
  externalRequests: [],
  pageErrors: [],
  plantWrites: 0,
  model: 'gemma3:4b',
  timeout,
};
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
    OLLAMA_URL: 'http://127.0.0.1:11434',
    OLLAMA_MODEL: 'gemma3:4b',
    OLLAMA_TIMEOUT_S: String(timeout),
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
let started;
try {
  await until(async () => {
    if (server.exitCode !== null) throw new Error(log);
    return fetch(`${origin}/api/health`)
      .then((response) => response.ok)
      .catch(() => false);
  }, 'temporary notebook');
  const response = await fetch(`${origin}/api/elders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      display_name: 'Fictional Gemma test elder',
      consent_given: true,
    }),
  });
  assert.equal(response.status, 201);
  const person = await response.json();
  browser = await openBrowser(artifacts, origin, report);
  const { command, evaluate, fill, click } = browser;
  await command('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await command('Page.navigate', { url: `${origin}/#/herbarium/new` });
  await until(
    () => evaluate(`Boolean(document.getElementById('elder_id'))`),
    'plant form',
  );
  await fill('elder_id', String(person.id));
  await fill('local_name', 'Kijani');
  await fill(
    'raw_notes',
    'We call it Kijani. Its leaves are green. It grows by the wall.',
  );
  started = performance.now();
  await click('Organize my notes with local AI');
  console.log(
    `Waiting for local gemma3:4b, CPU only, ${timeout}s per attempt.`,
  );
  await until(
    async () => {
      const error = await evaluate(
        `document.querySelector('[role="alert"]')?.textContent`,
      );
      if (error) throw new Error(error);
      return evaluate(`Boolean(document.getElementById('review-heading'))`);
    },
    'real Gemma review',
    (timeout * 2 + 20) * 10,
  );
  report.seconds = Number(((performance.now() - started) / 1000).toFixed(2));
  report.summary = await evaluate(
    `document.querySelector('.review-summary').textContent`,
  );
  console.log(
    JSON.stringify({ seconds: report.seconds, summary: report.summary }),
  );
  const lines = await evaluate(
    `Array.from(document.querySelectorAll('.review-line input:not([type="checkbox"])')).map(element => ({ id: element.id, text: element.value }))`,
  );
  assert(
    lines.length >= 2,
    'Need two grounded items for edit/deselect smoke test',
  );
  await evaluate(
    `document.querySelector('.review-line input[type="checkbox"]').click()`,
  );
  // Editing punctuation does not introduce a factual claim into the fictional card.
  await fill(lines[1].id, `${lines[1].text}.`);
  await evaluate(`document.querySelectorAll('.quote-link')[1].click()`);
  assert(
    await evaluate(
      `document.getElementById('raw_notes').selectionEnd > document.getElementById('raw_notes').selectionStart`,
    ),
  );
  await click('Use these in my card');
  assert.equal(report.plantWrites, 0);
  assert.deepEqual(await (await fetch(`${origin}/api/plants`)).json(), []);
  await click('Save plant');
  await until(
    () => evaluate(`document.querySelector('h1')?.textContent === 'Kijani'`),
    'saved real-model review',
  );
  const plants = await (await fetch(`${origin}/api/plants`)).json();
  assert.equal(plants.length, 1);
  assert.equal(report.plantWrites, 1);
  await command('Page.navigate', { url: `${origin}/#/herbarium` });
  await until(
    () => evaluate(`document.body.textContent.includes('Kijani')`),
    'herbarium card',
  );
  assert.deepEqual(report.externalRequests, []);
  assert.deepEqual(report.pageErrors, []);
  report.result =
    'Real Gemma review, deselect/edit/highlight/apply, zero writes before Save, saved herbarium card.';
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (started)
    report.seconds = Number(((performance.now() - started) / 1000).toFixed(2));
  report.error = error.message;
  throw error;
} finally {
  browser?.close();
  server.kill('SIGTERM');
  writeFileSync(
    join(artifacts, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(`Artifacts retained: ${artifacts}`);
}
