import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('timeline printing preserves cards instead of converting text into table rows', () => {
  const source = readFileSync(new URL('../src/utils/reports/request-timeline-print.mjs', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/app/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /content\.cloneNode\(true\)/);
  assert.match(source, /grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(source, /break-inside: avoid/);
  assert.match(source, /afterprint/);
  assert.match(main, /printRequestTimeline\(content,/);
  assert.doesNotMatch(main, /content\.innerText\.split/);
});
