import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { requestOnce } from '../src/measure.js';

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
