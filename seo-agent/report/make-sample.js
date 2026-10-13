// Generates report/sample.json by running placeholder data through the same
// buildReportData() the real pipeline uses, so the sample exercises the real boundary.
const fs = require('node:fs');
const path = require('node:path');
const { buildReportData } = require('../src/reportData');

const start = {
  rows: [
    { channel: 'google', label: 'pest control near me', position: 11 },
    { channel: 'google', label: 'termite inspection', position: 7 },
    { channel: 'google', label: 'ant exterminator', position: 4 },
    { channel: 'bing', label: 'pest control near me', position: 9 },
    { channel: 'map_pack', label: 'pest control', position: null },
    { channel: 'map_pack', label: 'termite treatment', position: 5 },
    { channel: 'ai', engine: 'ChatGPT', label: 'Who is the best pest control company near me?', mentioned: false },
    { channel: 'ai', engine: 'Perplexity', label: 'Who is the best pest control company near me?', mentioned: false },
  ],
};
const end = {
  rows: [
    { channel: 'google', label: 'pest control near me', position: 8 },
    { channel: 'google', label: 'termite inspection', position: 3 },
    { channel: 'google', label: 'ant exterminator', position: 4 },
    { channel: 'bing', label: 'pest control near me', position: 6 },
    { channel: 'map_pack', label: 'pest control', position: 3 },
    { channel: 'map_pack', label: 'termite treatment', position: 4 },
    { channel: 'ai', engine: 'ChatGPT', label: 'Who is the best pest control company near me?', mentioned: true },
    { channel: 'ai', engine: 'Perplexity', label: 'Who is the best pest control company near me?', mentioned: false },
  ],
};

const items = [
  { id: '1', status: 'done', category: 'new_page', clientSummary: 'Built a dedicated termite inspection page targeting your service area.', resultUrl: 'https://example.com/termite-inspection', completedAt: 'Nov 6' },
  { id: '2', status: 'done', category: 'blog_post', clientSummary: 'Published "How to Spot Termite Damage Before It Spreads".', resultUrl: 'https://example.com/blog/spot-termite-damage', completedAt: 'Nov 7' },
  { id: '3', status: 'done', category: 'blog_post', clientSummary: 'Published "What Does Pest Control Cost? A Local Homeowner Guide".', resultUrl: 'https://example.com/blog/pest-control-cost', completedAt: 'Nov 9' },
  { id: '4', status: 'scheduled', category: 'gbp_post', clientSummary: 'Scheduled a seasonal Google Business Profile post on winter pest prevention.', scheduledFor: 'Nov 24' },
  { id: '5', status: 'done', category: 'alt_text', clientSummary: 'Added descriptive alt text to 42 images across the service pages.', completedAt: 'Nov 6' },
  { id: '6', status: 'done', category: 'internal_link', clientSummary: 'Added internal links connecting new blog posts to the matching service pages.', completedAt: 'Nov 9' },
  { id: '7', status: 'done', category: 'schema', clientSummary: 'Added local business and FAQ structured data so search engines and AI assistants can read your services.', completedAt: 'Nov 7' },
  // These must NOT appear in the report; they prove the boundary holds in the sample too.
  { id: '8', status: 'rejected', category: 'other', clientSummary: 'SHOULD NOT APPEAR (rejected)' },
  { id: '9', status: 'failed', category: 'other', clientSummary: 'SHOULD NOT APPEAR (failed)' },
];

const { report, operatorNotes } = buildReportData({
  client: { name: 'Tander' },
  period: { label: 'November 2026' },
  start,
  end,
  items,
});

report.sample = true;
const out = path.join(__dirname, 'sample.json');
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`wrote ${out}`, operatorNotes.length ? operatorNotes : '');
