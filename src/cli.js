#!/usr/bin/env node
// Тонкая обёртка над логикой: разбор аргумента, вывод, коды выхода.
import { runRequests, summarize, formatReport, DEFAULT_REQUESTS } from './measure.js';

const url = process.argv[2];

if (!url) {
  console.error('Использование: node src/cli.js <url>');
  process.exit(2);
}

try {
  new URL(url); // бросит исключение, если адрес некорректный
} catch {
  console.error(`Некорректный адрес: ${url}`);
  process.exit(2);
}

try {
  console.log(`Скачиваю ${url} ${DEFAULT_REQUESTS} раз подряд...`);
  const results = await runRequests(url);
  console.log(formatReport(summarize(results)));
} catch (error) {
  console.error(`Ошибка: ${error.message}`);
  process.exit(1);
}
