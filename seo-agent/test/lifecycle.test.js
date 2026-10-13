const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sweep,
  readyForReport,
  rolloverCandidates,
  decisionFromReactions,
  REMINDER_AFTER_MS,
  ROLLOVER_AFTER_MS,
} = require('../src/lifecycle');

const T0 = Date.UTC(2026, 10, 3, 9, 0, 0);
const item = (id, extra = {}) => ({ id, status: 'proposed', postedAt: T0, remindedAt: null, ...extra });

test('checkmark approves, x rejects', () => {
  const { changes } = sweep([item('a'), item('b')], { a: ['white_check_mark'], b: ['x'] }, T0 + 1000);
  assert.deepEqual(
    changes.map((c) => [c.id, c.to]),
    [['a', 'approved'], ['b', 'rejected']],
  );
});

test('both checkmark and x on one item is a conflict, not a decision', () => {
  const r = sweep([item('a')], { a: ['white_check_mark', 'x'] }, T0 + 1000);
  assert.deepEqual(r.changes, []);
  assert.deepEqual(r.conflicts, ['a']);
  assert.equal(decisionFromReactions(['eyes']), null);
});

test('unrelated reactions do not count as a decision', () => {
  const r = sweep([item('a')], { a: ['eyes', 'thumbsup'] }, T0 + 1000);
  assert.deepEqual(r.changes, []);
});

test('reminder at 24h, once, and nothing before that', () => {
  assert.deepEqual(sweep([item('a')], {}, T0 + REMINDER_AFTER_MS - 1).reminders, []);
  assert.deepEqual(sweep([item('a')], {}, T0 + REMINDER_AFTER_MS).reminders, ['a']);
  assert.deepEqual(sweep([item('a', { remindedAt: T0 + REMINDER_AFTER_MS })], {}, T0 + REMINDER_AFTER_MS + 1).reminders, []);
});

test('no response for 48h defers the item to next month', () => {
  const r = sweep([item('a')], {}, T0 + ROLLOVER_AFTER_MS);
  assert.deepEqual(r.changes, [{ id: 'a', from: 'proposed', to: 'deferred', reason: 'no_response_48h' }]);
});

test('a reaction at hour 47 still wins over the rollover', () => {
  const r = sweep([item('a')], { a: ['white_check_mark'] }, T0 + ROLLOVER_AFTER_MS - 1);
  assert.equal(r.changes[0].to, 'approved');
});

test('items already decided are never touched again', () => {
  const r = sweep([item('a', { status: 'rejected' })], { a: ['white_check_mark'] }, T0 + 10 * ROLLOVER_AFTER_MS);
  assert.deepEqual(r.changes, []);
});

test('report is blocked while anything is proposed, approved or in progress', () => {
  for (const status of ['proposed', 'approved', 'in_progress']) {
    assert.equal(readyForReport([item('a', { status: 'done' }), item('b', { status })]), false, status);
  }
});

test('report is ready when everything is done, scheduled, rejected, deferred or failed', () => {
  const items = ['done', 'scheduled', 'rejected', 'deferred', 'failed'].map((s, i) => item(String(i), { status: s }));
  assert.equal(readyForReport(items), true);
});

test('an empty month is not "ready"', () => {
  assert.equal(readyForReport([]), false);
});

test('deferred items roll over', () => {
  const items = [item('a', { status: 'deferred' }), item('b', { status: 'done' })];
  assert.deepEqual(rolloverCandidates(items).map((i) => i.id), ['a']);
});
