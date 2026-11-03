import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('all manager profiles constrain table overflow and retain sticky column headers', () => {
  const css = readFileSync(new URL('../src/styles/manager-scroll.css', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../src/app/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /className="manager-dashboard" onPointerDown=\{preventTableAutoScroll\}/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css, /\.manager-detail-panel > \.scroll \{[^}]*overflow: auto/);
  assert.match(css, /\.manager-detail-panel > \.scroll th \{[^}]*position: sticky/);
  assert.match(css, /overscroll-behavior: contain/);
});
