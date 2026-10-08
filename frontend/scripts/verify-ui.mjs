// Optional browser verification. Uses an existing Playwright installation, not an app dependency.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { createServer as createTcpServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE || 'playwright-core',
);
const root = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = mkdtempSync(resolve(tmpdir(), 'mizizi-ui-'));
// Reserve an available port before starting; never test against someone else's app.
const probe = createTcpServer();
await new Promise((accept, reject) => {
  probe.once('error', reject);
  probe.listen(Number(process.env.UI_TEST_PORT || 0), '127.0.0.1', accept);
});
const port = probe.address().port;
await new Promise((accept, reject) =>
  probe.close((error) => (error ? reject(error) : accept())),
);
const origin = `http://127.0.0.1:${port}`;
const server = spawn('npm', ['start'], {
  cwd: root,
  detached: true,
  env: {
    ...process.env,
    PORT: String(port),
    DB_PATH: resolve(artifacts, 'test.db'),
    PHOTOS_DIR: resolve(artifacts, 'photos'),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (data) => {
  serverLog += data;
});
server.stderr.on('data', (data) => {
  serverLog += data;
});
const report = {
  artifacts,
  screens: [],
  externalRequests: [],
  pageErrors: [],
  checks: [],
};
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      ready = (await fetch(`${origin}/api/health`)).ok;
    } catch {
      /* Starting. */
    }
    if (ready) break;
    if (server.exitCode !== null) throw new Error(serverLog);
    await delay(100);
  }
  assert(ready, serverLog || 'Server did not start.');
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => report.pageErrors.push(error.message));
  page.on('request', (request) => {
    if (
      !request.url().startsWith(origin) &&
      !/^(data|blob):/.test(request.url())
    )
      report.externalRequests.push(request.url());
  });
  const go = async (route) => {
    await page.goto(`${origin}/#${route}`);
    await page.getByRole('heading', { level: 1 }).waitFor();
  };
  const personForm = () =>
    page.getByRole('form', { name: 'Add a person', exact: true });
  await go('/herbarium');
  await page
    .getByRole('heading', { name: 'Your herbarium is empty' })
    .waitFor();
  assert.equal(await page.locator('.main-nav a').count(), 3);
  await go('/people');
  await personForm().getByRole('button', { name: 'Save person' }).click();
  await page.getByText('Please enter their name.', { exact: true }).waitFor();
  assert.equal(
    await page
      .locator('#display_name')
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await personForm().getByLabel('Name', { exact: true }).fill('Waiting Person');
  assert.equal(await personForm().getByRole('checkbox').isChecked(), false);
  await personForm().getByRole('button', { name: 'Save person' }).click();
  await page.getByRole('heading', { name: 'Waiting Person' }).waitFor();
  await go('/herbarium/new');
  await page
    .getByRole('heading', { name: 'Record their consent first' })
    .waitFor();
  report.checks.push(
    'Empty states, required name, consent unchecked by default, new plant blocked without consent',
  );
  await go('/people');
  await personForm().getByLabel('Name', { exact: true }).fill('Demo Elder');
  await personForm()
    .getByLabel('Languages', { exact: true })
    .fill('English, Swahili');
  await personForm().getByRole('checkbox').check();
  await personForm()
    .getByLabel('How did they agree?')
    .fill('Fictional consent for this isolated test.');
  await personForm().getByRole('button', { name: 'Save person' }).click();
  await page.getByRole('heading', { name: 'Demo Elder' }).waitFor();
  await go('/walks');
  await page.getByRole('button', { name: 'Save walk' }).click();
  await page
    .getByText('Choose the person you walked with.', { exact: true })
    .waitFor();
  await page
    .getByLabel('Person', { exact: true })
    .selectOption({ label: 'Demo Elder' });
  await page.getByLabel('Date', { exact: true }).fill('2026-10-07');
  await page.getByLabel('Minutes (optional)').fill('25');
  await page.getByLabel('Place label', { exact: true }).fill('Test garden');
  await page.getByRole('button', { name: 'Save walk' }).click();
  await page.getByText('0 plants', { exact: true }).waitFor();
  await page.getByRole('link', { name: 'Add a plant from this walk' }).click();
  assert.equal(
    await page.getByLabel('Person', { exact: true }).inputValue(),
    '2',
  );
  assert.equal(await page.getByLabel('Walk (optional)').inputValue(), '1');
  assert.equal(
    await page.locator('option', { hasText: 'Waiting Person' }).isDisabled(),
    true,
  );
  await page.getByRole('button', { name: 'Save plant', exact: true }).click();
  await page
    .getByText('Please give this plant its local name.', { exact: true })
    .waitFor();
  const notes =
    '  Fictional notes: small green leaves.\nOnly words shared during this test.  ';
  const fields = {
    'Local name': 'Garden leaf',
    'Other names': 'Test leaf\nNotebook leaf',
    'Raw notes': notes,
    'How to recognize it': 'Small leaves\nGreen stems',
    'Where it grows': 'By the kitchen wall',
    'What they told me about its uses': 'No uses were discussed.',
    'Preparation, as told': 'No preparation was discussed.',
    'Warnings, as told': 'No warnings were discussed.',
    'A story or proverb': 'A fictional family memory.',
  };
  for (const [label, value] of Object.entries(fields))
    await page.getByLabel(label, { exact: true }).fill(value);
  assert.equal(
    await page.getByLabel('Who may this plant be shared with?').inputValue(),
    'private',
  );
  await page.getByRole('button', { name: 'Save plant', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Garden leaf', exact: true })
    .waitFor();
  assert.equal(await page.locator('.source-notes').textContent(), notes);
  await page
    .getByText(
      'Traditional knowledge shared by Demo Elder. Not medical advice.',
      { exact: true },
    )
    .first()
    .waitFor();
  assert.equal(
    await page.getByText('Development preview', { exact: false }).count(),
    0,
  );
  report.checks.push(
    'Person → walk → plant created through mobile forms; all plant fields, raw-note whitespace, default private and safety notice',
  );

  const created = await (await fetch(`${origin}/api/plants/1`)).json();
  assert.deepEqual(created.appearance, ['Small leaves', 'Green stems']);
  for (const local_name of [
    'Second specimen',
    'Third specimen',
    'Fourth specimen',
  ]) {
    const result = await fetch(`${origin}/api/plants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        elder_id: 2,
        local_name,
        raw_notes: 'A fictional specimen for layout verification.',
      }),
    });
    assert.equal(result.status, 201);
  }
  // The setup above writes directly to the API, outside the React context.
  await page.reload();
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const [name, route] of [
      ['herbarium', '/herbarium'],
      ['detail', '/herbarium/1'],
      ['new-plant', '/herbarium/new'],
      ['walks', '/walks'],
      ['people', '/people'],
    ]) {
      await go(route);
      const dimensions = await page.evaluate(() => ({
        content: document.documentElement.scrollWidth,
        viewport: innerWidth,
      }));
      assert(
        dimensions.content <= dimensions.viewport,
        `${name} overflows at ${width}: ${JSON.stringify(dimensions)}`,
      );
      if (name === 'herbarium') {
        assert.equal(
          await page
            .locator('.herbarium-grid')
            .evaluate(
              (el) =>
                getComputedStyle(el).gridTemplateColumns.split(' ').length,
            ),
          width === 390 ? 1 : 3,
        );
        assert.equal(
          await page
            .locator('.main-nav')
            .evaluate((el) => getComputedStyle(el).position),
          width === 390 ? 'fixed' : 'static',
        );
      }
      const undersized = await page
        .locator(
          'button, .button, .main-nav a, input:not([type="checkbox"]), select',
        )
        .evaluateAll((elements) =>
          elements
            .filter(
              (el) =>
                el.getBoundingClientRect().height > 0 &&
                el.getBoundingClientRect().height < 48,
            )
            .map((el) => el.outerHTML),
        );
      assert.deepEqual(undersized, [], `${name}: touch targets below 48px`);
      const screenshot = `${name}-${width}.png`;
      await page.screenshot({
        path: resolve(artifacts, screenshot),
        fullPage: true,
      });
      report.screens.push(screenshot);
    }
  }
  await page.setViewportSize({ width: 820, height: 900 });
  await go('/herbarium');
  assert.equal(
    await page
      .locator('.herbarium-grid')
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
      ),
    2,
  );
  await page.getByLabel('Search by name').fill('NOTEBOOK');
  await page
    .getByRole('heading', { name: 'Garden leaf', exact: true })
    .waitFor();
  assert.equal(await page.locator('.plant-card').count(), 1);
  await page.getByLabel('Filter by person').selectOption('1');
  await page
    .getByRole('heading', { name: 'No plants match just yet' })
    .waitFor();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.waitForFunction(
    () => document.querySelectorAll('.plant-card').length === 4,
  );
  assert.equal(await page.locator('.plant-card').count(), 4);
  await go('/walks');
  await page.getByText('1 plant', { exact: true }).waitFor();
  report.checks.push(
    '10 responsive screenshots; no horizontal overflow; 48px controls; 1/2/3 columns; search on other names, person filter, walk count',
  );

  await go('/herbarium/1/edit');
  await page.getByLabel('Local name', { exact: true }).fill('Edited leaf');
  await page
    .getByLabel('Who may this plant be shared with?')
    .selectOption('shareable');
  await page.route('**/api/plants/1', (route) =>
    route.request().method() === 'PATCH' ? route.abort() : route.continue(),
  );
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page
    .getByRole('alert')
    .filter({ hasText: 'The server is not reachable.' })
    .waitFor();
  assert.equal(
    await page.getByLabel('Local name', { exact: true }).inputValue(),
    'Edited leaf',
  );
  await page.unroute('**/api/plants/1');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page
    .getByRole('heading', { name: 'Edited leaf', exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByRole('heading', { name: 'Edited leaf', exact: true })
    .waitFor();
  await page.getByText('Shareable', { exact: true }).waitFor();
  await go('/people');
  await page
    .locator('article')
    .filter({
      has: page.getByRole('heading', { name: 'Demo Elder', exact: true }),
    })
    .getByRole('button', { name: 'Edit person' })
    .click();
  await page
    .getByRole('form', { name: 'Edit person', exact: true })
    .getByRole('checkbox')
    .uncheck();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByRole('form', { name: 'Add a person', exact: true }).waitFor();
  await go('/herbarium/1/edit');
  await page
    .getByRole('heading', { name: 'Record their consent first' })
    .waitFor();
  await go('/herbarium/1');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  assert.equal(
    await page
      .getByRole('button', { name: 'Keep plant', exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete plant', exact: true }).click();
  await page.getByRole('heading', { name: 'Herbarium', exact: true }).waitFor();
  assert.equal((await fetch(`${origin}/api/plants/1`)).status, 404);
  await go('/walks');
  await page.getByText('0 plants', { exact: true }).waitFor();
  report.checks.push(
    'Failed save retains form; retry, edit, persistence, visibility, consent revocation, cancel/confirm deletion, updated walk count',
  );

  await page.route('**/api/**', (route) => route.abort());
  await page.reload();
  await page
    .getByRole('heading', { name: 'Let’s reconnect your notebook' })
    .waitFor();
  await page
    .getByText(
      'The server is not reachable. Is the computer on and on the same Wi-Fi?',
      { exact: true },
    )
    .waitFor();
  await page.unroute('**/api/**');
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.getByRole('heading', { name: 'Walks', exact: true }).waitFor();
  await page.route('**/api/**', async (route) => {
    await delay(500);
    await route.continue();
  });
  await page.reload();
  await page.getByRole('heading', { name: 'Opening your notebook…' }).waitFor();
  await page.getByRole('heading', { name: 'Walks', exact: true }).waitFor();
  await page.unroute('**/api/**');
  assert.deepEqual(report.externalRequests, []);
  assert.deepEqual(report.pageErrors, []);
  report.checks.push(
    'Loading, connection error and retry; zero external requests and zero uncaught browser errors in production',
  );

  await fetch(`${origin}/api/elders/2`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent_given: true }),
  });
  // The real review flow supersedes the old development fixture.
  // Run test:review for dependency-free Chrome coverage of that flow.
  console.log(JSON.stringify(report, null, 2));
} finally {
  writeFileSync(
    resolve(artifacts, 'report.json'),
    JSON.stringify(report, null, 2),
  );
  await browser?.close();
  if (server.exitCode === null) process.kill(-server.pid, 'SIGTERM');
  console.log(`Temporary database, screenshots and report: ${artifacts}`);
}
