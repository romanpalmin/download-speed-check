import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';

const CLI = new URL('../src/cli.js', import.meta.url).pathname;

// Запускает CLI как отдельный процесс (асинхронно: сервер в этом же процессе
// должен успевать отвечать) и возвращает код выхода и вывод.
function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args]);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function startServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}/` });
    });
  });
}

test('cli: без аргумента — код 2 и подсказка', async () => {
  const { code, stderr } = await runCli([]);
  assert.equal(code, 2);
  assert.match(stderr, /Использование/);
});

test('cli: некорректный адрес — код 2', async () => {
  const { code, stderr } = await runCli(['не адрес']);
  assert.equal(code, 2);
  assert.match(stderr, /Некорректный адрес/);
});

test('cli: ответ 404 — код 1 и текст ошибки', async () => {
  const { server, url } = await startServer((_req, res) => {
    res.statusCode = 404;
    res.end();
  });
  try {
    const { code, stderr } = await runCli([url]);
    assert.equal(code, 1);
    assert.match(stderr, /HTTP 404/);
  } finally {
    server.close();
  }
});

test('cli: успех — код 0 и отчёт на 10 запросов', async () => {
  const { server, url } = await startServer((_req, res) => res.end('x'.repeat(5000)));
  try {
    const { code, stdout } = await runCli([url]);
    assert.equal(code, 0);
    assert.match(stdout, /Запросов:\s+10/);
    assert.match(stdout, /0\.05 МБ \(50000 байт\)/);
  } finally {
    server.close();
  }
});
