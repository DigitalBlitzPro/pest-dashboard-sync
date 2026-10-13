// Renders the client-safe report object (see src/reportData.js) to a PDF.
//   node report/render.js <report.json> <out.pdf>

const fs = require('node:fs');
const path = require('node:path');

// Placeholder palette: swap in the real Digital Blitz colours and logo.
const BRAND = {
  name: 'Digital Blitz',
  ink: '#0f172a',
  accent: '#1d4ed8',
  soft: '#eef2ff',
  muted: '#64748b',
  good: '#15803d',
  bad: '#b91c1c',
  line: '#e2e8f0',
};

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const pos = (n) => (n == null ? 'Not ranked' : `#${n}`);

function changeCell(row) {
  if (row.change == null) return row.before == null && row.after != null ? '<span class="up">▲ New</span>' : '<span class="flat">—</span>';
  if (row.change > 0) return `<span class="up">▲ ${row.change}</span>`;
  if (row.change < 0) return `<span class="down">▼ ${Math.abs(row.change)}</span>`;
  return '<span class="flat">— No change</span>';
}

function rankingBlock(block) {
  if (block.channel === 'ai') {
    const rows = block.rows
      .map(
        (r) => `<tr><td>${esc(r.label)}</td><td>${esc(r.engine)}</td>
          <td>${r.before == null ? '—' : r.before ? 'Mentioned' : 'Not mentioned'}</td>
          <td><strong>${r.after ? 'Mentioned' : 'Not mentioned'}</strong></td></tr>`,
      )
      .join('');
    return `<section class="block"><h3>${esc(block.title)}</h3>
      <table><thead><tr><th>Question asked</th><th>Assistant</th><th>Start of month</th><th>End of month</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  }
  const rows = block.rows
    .map(
      (r) => `<tr><td>${esc(r.label)}</td><td>${pos(r.before)}</td><td><strong>${pos(r.after)}</strong></td><td>${changeCell(r)}</td></tr>`,
    )
    .join('');
  return `<section class="block"><h3>${esc(block.title)}</h3>
    <table><thead><tr><th>Search term</th><th>Start of month</th><th>End of month</th><th>Change</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function workBlock(group) {
  const items = group.entries
    .map((e) => {
      const when = e.scheduled ? `Scheduled${e.date ? ` for ${esc(e.date)}` : ''}` : e.date ? esc(e.date) : '';
      const link = e.url ? ` <a href="${esc(e.url)}">${esc(e.url)}</a>` : '';
      return `<li>${esc(e.summary)}${link}${when ? ` <span class="when">${when}</span>` : ''}</li>`;
    })
    .join('');
  return `<section class="block"><h3>${esc(group.title)} <span class="count">${group.entries.length}</span></h3><ul>${items}</ul></section>`;
}

function html(report) {
  const s = report.summary;
  const tile = (value, label) => `<div class="tile"><div class="v">${esc(value)}</div><div class="l">${esc(label)}</div></div>`;
  const hasAi = s.aiTotal > 0;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: ${BRAND.ink}; font-size: 11.5px; line-height: 1.5; }
  .hero { background: ${BRAND.ink}; color: #fff; padding: 36px 44px 30px; }
  .brand { font-weight: 800; letter-spacing: .04em; text-transform: uppercase; font-size: 12px; color: #93c5fd; }
  .hero h1 { margin: 14px 0 4px; font-size: 28px; line-height: 1.15; }
  .hero .sub { color: #cbd5e1; font-size: 13px; }
  .body { padding: 26px 44px 20px; }
  .tiles { display: flex; gap: 12px; margin-bottom: 8px; }
  .tile { flex: 1; background: ${BRAND.soft}; border-radius: 10px; padding: 14px 14px 12px; }
  .tile .v { font-size: 26px; font-weight: 800; color: ${BRAND.accent}; line-height: 1.1; }
  .tile .l { color: ${BRAND.muted}; margin-top: 4px; font-size: 11px; }
  h2 { font-size: 17px; margin: 26px 0 10px; padding-bottom: 6px; border-bottom: 2px solid ${BRAND.accent}; }
  h3 { font-size: 13px; margin: 16px 0 6px; }
  .count { background: ${BRAND.soft}; color: ${BRAND.accent}; border-radius: 99px; padding: 1px 8px; font-size: 10.5px; margin-left: 4px; }
  .block { break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th:first-child, td:first-child { width: 44%; }
  th { text-align: left; color: ${BRAND.muted}; font-weight: 600; font-size: 10.5px; padding: 6px 8px; border-bottom: 1px solid ${BRAND.line}; }
  td { padding: 7px 8px; border-bottom: 1px solid ${BRAND.line}; }
  .up { color: ${BRAND.good}; font-weight: 700; }
  .down { color: ${BRAND.bad}; font-weight: 700; }
  .flat { color: ${BRAND.muted}; }
  ul { margin: 4px 0 0; padding-left: 18px; }
  li { margin: 0 0 5px; }
  li a { color: ${BRAND.accent}; word-break: break-all; }
  .when { color: ${BRAND.muted}; font-size: 10.5px; margin-left: 4px; }
  .note { color: ${BRAND.muted}; font-size: 10.5px; margin-top: 18px; }
  .sample { background: #fef3c7; color: #92400e; text-align: center; font-weight: 700; padding: 6px; font-size: 11px; }
  </style></head><body>
  ${report.sample ? '<div class="sample">SAMPLE REPORT: illustrative placeholder data, not real results</div>' : ''}
  <div class="hero">
    <div class="brand">${esc(BRAND.name)}</div>
    <h1>Monthly SEO Report</h1>
    <div class="sub">${esc(report.clientName)} · ${esc(report.periodLabel)}</div>
  </div>
  <div class="body">
    <div class="tiles">
      ${tile(s.workItems, 'Improvements completed')}
      ${tile(s.improved, 'Search terms moved up')}
      ${tile(s.top3, 'Rankings in the top 3')}
      ${hasAi ? tile(`${s.aiMentions}/${s.aiTotal}`, 'AI answers mentioning you') : ''}
    </div>

    <h2>What we accomplished</h2>
    ${report.work.length ? report.work.map(workBlock).join('') : '<p>No completed work this month.</p>'}

    <h2>Where you rank</h2>
    ${report.rankings.map(rankingBlock).join('')}

    <p class="note">Rankings are measured at the start and end of the month. SEO work typically takes several weeks to show up in results, so improvements made this month may continue to show in the months ahead.</p>
  </div>
  </body></html>`;
}

async function render(report, outPath) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html(report), { waitUntil: 'load' });
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    await page.pdf({
      path: outPath,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;font-size:8px;color:#64748b;padding:0 44px;display:flex;justify-content:space-between;font-family:Helvetica,Arial,sans-serif">
        <span>${esc(BRAND.name)} · ${esc(report.clientName)} · ${esc(report.periodLabel)}</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
      margin: { top: '0', bottom: '36px', left: '0', right: '0' },
    });
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  const [, , input, output] = process.argv;
  if (!input || !output) {
    console.error('usage: node report/render.js <report.json> <out.pdf>');
    process.exit(1);
  }
  render(JSON.parse(fs.readFileSync(input, 'utf8')), output).then(
    () => console.log(`wrote ${output}`),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}

module.exports = { render, html };
