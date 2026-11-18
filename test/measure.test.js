import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { requestOnce, runRequests } from '../src/measure.js';

// Локальный сервер: интернет не нужен, размер ответа известен точно.
function startServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

test('requestOnce: считает тело целиком', async () => {
  const payload = Buffer.alloc(200_000, 1);
  const { server, url } = await startServer((_req, res) => res.end(payload));
  try {
    const { bytes, ms } = await requestOnce(url);
    assert.equal(bytes, 200_000);
    assert.ok(ms >= 0);
  } finally {
    server.close();
  }
});

test('requestOnce: статус ошибки HTTP даёт отказ', async () => {
  const { server, url } = await startServer((_req, res) => {
    res.statusCode = 404;
    res.end('nope');
  });
  try {
    await assert.rejects(requestOnce(url), /HTTP 404/);
  } finally {
    server.close();
  }
});

test('requestOnce: время включает ожидание всего тела, а не только заголовков', async () => {
  // Заголовки уходят сразу (res.write), остальное тело и конец ответа через 100 мс.
  // Content-Length нет (chunked), значит размер можно узнать только прочитав тело.
  const { server, url } = await startServer((_req, res) => {
    res.write('a'.repeat(1000));
    setTimeout(() => res.end('b'.repeat(1000)), 100);
  });
  try {
    const { bytes, ms } = await requestOnce(url);
    assert.equal(bytes, 2000);
    assert.ok(ms >= 90, `время ${ms} мс меньше задержки тела`);
  } finally {
    server.close();
  }
});

test('runRequests: ровно 10 запросов, строго по очереди', async () => {
  let active = 0; // сколько запросов сейчас в работе на сервере
  let maxActive = 0; // максимум одновременно в работе за весь прогон
  let total = 0; // сколько запросов пришло всего
  const { server, url } = await startServer((_req, res) => {
    total++;
    active++; // запрос пришёл
    maxActive = Math.max(maxActive, active);
    setTimeout(() => {
      active--; // запрос закончен
      res.end('x'.repeat(1000));
    }, 5); // задержка нужна, чтобы параллельные запросы успели наложиться
  });
  try {
    const results = await runRequests(url);
    assert.equal(total, 10); // ловит неверное число запросов
    assert.equal(results.length, 10);
    assert.equal(maxActive, 1); // ловит параллельность
  } finally {
    server.close();
  }
});
