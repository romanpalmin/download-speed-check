// Основная логика. Без зависимостей: только встроенные fetch и performance.now().

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
