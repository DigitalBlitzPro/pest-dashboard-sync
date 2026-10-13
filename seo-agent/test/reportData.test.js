const test = require('node:test');
const assert = require('node:assert/strict');
const { buildReportData, compareRankings } = require('../src/reportData');

const client = { name: 'Tander' };
const period = { label: 'November 2026' };

const start = {
  rows: [
    { channel: 'google', label: 'pest control tander', position: 9 },
    { channel: 'google', label: 'termite treatment tander', position: 4 },
    { channel: 'map_pack', label: 'pest control near me', position: null },
    { channel: 'ai', engine: 'chatgpt', label: 'best pest control in tander', mentioned: false },
  ],
};
const end = {
  rows: [
    { channel: 'google', label: 'pest control tander', position: 5 },
    { channel: 'google', label: 'termite treatment tander', position: 6 },
    { channel: 'map_pack', label: 'pest control near me', position: 3 },
    { channel: 'ai', engine: 'chatgpt', label: 'best pest control in tander', mentioned: true },
  ],
};

const base = { id: 'x', category: 'blog_post', rationale: 'INTERNAL-RATIONALE', failureNote: 'INTERNAL-FAILURE' };

test('positive change means the page moved up', () => {
  const google = compareRankings(start, end).find((c) => c.channel === 'google');
  assert.equal(google.rows[0].change, 4); // 9 -> 5
  assert.equal(google.rows[1].change, -2); // 4 -> 6
});

test('a keyword that was unranked has no change figure, not a fake one', () => {
  const map = compareRankings(start, end).find((c) => c.channel === 'map_pack');
  assert.equal(map.rows[0].before, null);
  assert.equal(map.rows[0].after, 3);
  assert.equal(map.rows[0].change, null);
});

test('only done and scheduled items with a client summary reach the report', () => {
  const items = [
    { ...base, id: '1', status: 'done', clientSummary: 'Published a guide to termite season.', resultUrl: 'https://example.com/a' },
    { ...base, id: '2', status: 'scheduled', category: 'gbp_post', clientSummary: 'Scheduled a Google post.', scheduledFor: '2026-11-20' },
    { ...base, id: '3', status: 'rejected', clientSummary: 'REJECTED-ITEM' },
    { ...base, id: '4', status: 'failed', clientSummary: 'FAILED-ITEM' },
    { ...base, id: '5', status: 'deferred', clientSummary: 'DEFERRED-ITEM' },
    { ...base, id: '6', status: 'proposed', clientSummary: 'PROPOSED-ITEM' },
  ];
  const { report } = buildReportData({ client, period, start, end, items });
  const text = JSON.stringify(report);

  assert.equal(report.summary.workItems, 2);
  for (const leak of ['REJECTED-ITEM', 'FAILED-ITEM', 'DEFERRED-ITEM', 'PROPOSED-ITEM', 'INTERNAL-RATIONALE', 'INTERNAL-FAILURE']) {
    assert.ok(!text.includes(leak), `${leak} leaked into the report`);
  }
});

test('a finished item with no client summary is withheld and flagged to the operator only', () => {
  const items = [{ ...base, id: '9', status: 'done', clientSummary: '   ' }];
  const { report, operatorNotes } = buildReportData({ client, period, start, end, items });
  assert.equal(report.summary.workItems, 0);
  assert.equal(operatorNotes.length, 1);
  assert.ok(!JSON.stringify(report).includes('Item 9'));
});

test('summary counts improvements, declines, top-3 positions and AI mentions', () => {
  const { report } = buildReportData({ client, period, start, end, items: [] });
  assert.deepEqual(report.summary, { improved: 1, declined: 1, top3: 1, aiMentions: 1, aiTotal: 1, workItems: 0 });
});
