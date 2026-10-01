import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeVersionHistory, validateVersionHistory } from '../../js/version-history.js';

const history = [
  { version: '1.30Sep2026-120000', date: '2026-09-30', message: 'Earlier update' },
  { version: '1.01Oct2026-080000', date: '2026-10-01', message: 'Morning update' },
  { version: '1.01Oct2026-090000', date: '2026-10-01', message: 'Later update' }
];

test('version history validates the compact deployment contract', () => {
  assert.equal(validateVersionHistory(history), history);
  assert.throws(() => validateVersionHistory([...history, history[0]]), /duplicate version/);
  assert.throws(() => validateVersionHistory([{ version: 'bad', date: '2026-10-01', message: 'x' }]), /invalid version/);
  assert.throws(() => validateVersionHistory([{ version: '1.01Oct2026-090000', date: 'bad', message: 'x' }]), /invalid date/);
});

test('display history merges device dates and sorts newest first', () => {
  const merged = mergeVersionHistory(history, [{ version: '1.01Oct2026-080000', dateSeen: '2026-10-01T08:05:00Z', dateInstalled: '2026-10-01T08:06:00Z' }]);
  assert.deepEqual(merged.map((record) => record.version), ['1.01Oct2026-090000', '1.01Oct2026-080000', '1.30Sep2026-120000']);
  assert.equal(merged[1].dateSeen, '2026-10-01T08:05:00Z');
  assert.equal(merged[1].dateInstalled, '2026-10-01T08:06:00Z');
});
