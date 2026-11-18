// Основная логика. Без зависимостей: только встроенные fetch и performance.now().

export const DEFAULT_REQUESTS = 10;

/**
 * Один запрос: ждёт, пока тело ответа будет скачано ПОЛНОСТЬЮ,
 * и возвращает число байт и затраченное время в миллисекундах.
 */
export async function requestOnce(url, fetchImpl = fetch) {
  const start = performance.now();
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  // arrayBuffer() завершается только когда тело получено целиком.
  const body = await response.arrayBuffer();
  const ms = performance.now() - start;
  return { bytes: body.byteLength, ms };
}

/** N запросов строго друг за другом (без Promise.all). */
export async function runRequests(url, count = DEFAULT_REQUESTS, fetchImpl = fetch) {
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(await requestOnce(url, fetchImpl));
  }
  return results;
}

/**
 * Агрегация. Скорость = всего байт / всё время (а не среднее скоростей
 * отдельных запросов: оно завышает вес быстрых маленьких ответов).
 * Единицы: 1 МБ = 1 000 000 байт, 1 Мбит = 1 000 000 бит (десятичные,
 * как у интернет-провайдеров).
 */
export function summarize(results) {
  if (results.length === 0) throw new Error('Нет результатов для подсчёта');
  const totalBytes = results.reduce((sum, r) => sum + r.bytes, 0);
  const totalMs = results.reduce((sum, r) => sum + r.ms, 0);
  const totalSeconds = totalMs / 1000;
  return {
    requests: results.length,
    averageMs: totalMs / results.length,
    totalBytes,
    totalMs,
    megabytesPerSecond: totalBytes / 1_000_000 / totalSeconds,
    megabitsPerSecond: (totalBytes * 8) / 1_000_000 / totalSeconds,
  };
}
