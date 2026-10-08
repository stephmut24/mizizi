// Node 22 + an installed Chrome: no browser automation package or remote service.
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { join } from 'node:path';

export async function until(check, description, attempts = 200) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (await check()) return;
    await delay(100);
  }
  throw new Error(`Timed out: ${description}`);
}

export async function openBrowser(directory, origin, report) {
  const chrome = spawn(
    process.env.CHROME_PATH ||
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    [
      '--headless=new',
      '--remote-debugging-port=0',
      '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${join(directory, 'chrome-profile')}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-extensions',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  let log = '';
  let failure;
  chrome.on('error', (error) => {
    failure = error;
  });
  chrome.stderr.on('data', (data) => {
    log += data;
  });
  let socket;
  const pending = new Map();
  const close = () => {
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error('Browser closed'));
    }
    pending.clear();
    socket?.close();
    chrome.kill('SIGTERM');
  };
  try {
    await until(() => {
      if (failure) throw failure;
      if (chrome.exitCode !== null) throw new Error(log);
      return /DevTools listening on (ws:\/\/[^\s]+)/.test(log);
    }, 'Chrome debugger');
    socket = new WebSocket(
      log.match(/DevTools listening on (ws:\/\/[^\s]+)/)[1],
    );
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    let nextId = 0;
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const item = pending.get(message.id);
        if (!item) return;
        clearTimeout(item.timer);
        pending.delete(message.id);
        if (message.error)
          item.reject(new Error(JSON.stringify(message.error)));
        else item.resolve(message.result);
      }
      if (message.method === 'Network.requestWillBeSent') {
        const { url, method } = message.params.request;
        if (!url.startsWith(`${origin}/`) && !/^(data|blob|about):/.test(url))
          report.externalRequests.push(url);
        if (url === `${origin}/api/plants` && method === 'POST')
          report.plantWrites++;
      }
      if (message.method === 'Runtime.exceptionThrown')
        report.pageErrors.push(message.params.exceptionDetails.text);
    });
    const send = (method, params = {}, sessionId) =>
      new Promise((resolve, reject) => {
        const id = ++nextId;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }, 10000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params, sessionId }));
      });
    const { targetId } = await send('Target.createTarget', {
      url: 'about:blank',
    });
    const { sessionId } = await send('Target.attachToTarget', {
      targetId,
      flatten: true,
    });
    const command = (method, params) => send(method, params, sessionId);
    await command('Page.enable');
    await command('Runtime.enable');
    await command('Network.enable');
    const evaluate = async (expression) => {
      const { result, exceptionDetails } = await command('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails));
      return result.value;
    };
    const fill = (id, value) =>
      evaluate(`(() => {
      const element = document.getElementById(${JSON.stringify(id)});
      const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)});
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    const click = async (text, scope = 'body') => {
      await until(
        () =>
          evaluate(
            `Array.from(document.querySelector(${JSON.stringify(scope)})?.querySelectorAll('button') || []).some(item => item.textContent.trim() === ${JSON.stringify(text)} && !item.disabled)`,
          ),
        `enabled button: ${text}`,
      );
      return evaluate(`(() => {
      const button = Array.from(document.querySelector(${JSON.stringify(scope)}).querySelectorAll('button')).find(item => item.textContent.trim() === ${JSON.stringify(text)});
      if (!button || button.disabled) throw new Error('Missing or disabled button: ' + ${JSON.stringify(text)});
      button.click();
    })()`);
    };
    return { command, evaluate, fill, click, close };
  } catch (error) {
    close();
    throw error;
  }
}
