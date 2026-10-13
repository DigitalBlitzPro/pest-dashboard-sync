// Builds the data object the Client Report Bot is allowed to see.
//
// The client report must never contain internal material (rationale, rejected or
// failed items, notes). That is enforced here by whitelisting fields, not by asking
// a prompt to leave things out: the renderer only ever receives what this returns.

const { REPORTABLE } = require('./lifecycle');

const CATEGORY_LABELS = {
  new_page: 'New pages',
  blog_post: 'Blog posts',
  gbp_post: 'Google Business Profile posts',
  backlink: 'Backlinks & outreach',
  internal_link: 'Internal linking',
  alt_text: 'Image alt text',
  schema: 'Structured data',
  meta: 'Titles & meta descriptions',
  citation: 'Local citations',
  other: 'Other improvements',
};

const CHANNEL_LABELS = {
  google: 'Google Search',
  bing: 'Bing Search',
  map_pack: 'Google Map Pack',
  ai: 'AI Answers',
};

// Snapshot rows: { channel, label, position|null }  for google / bing / map_pack
//                { channel: 'ai', label, engine, mentioned: bool } for AI answers
function compareRankings(start, end) {
  const startRows = new Map((start?.rows || []).map((r) => [`${r.channel}|${r.engine || ''}|${r.label}`, r]));
  const channels = {};

  for (const row of end?.rows || []) {
    const key = `${row.channel}|${row.engine || ''}|${row.label}`;
    const before = startRows.get(key);
    const out = { label: row.label };

    if (row.channel === 'ai') {
      out.engine = row.engine;
      out.before = before ? !!before.mentioned : null;
      out.after = !!row.mentioned;
    } else {
      out.before = before ? before.position ?? null : null;
      out.after = row.position ?? null;
      // Positive change = moved up the page (position 8 -> 3 is +5).
      out.change = out.before != null && out.after != null ? out.before - out.after : null;
    }
    (channels[row.channel] ||= []).push(out);
  }

  return Object.entries(channels).map(([channel, rows]) => ({
    channel,
    title: CHANNEL_LABELS[channel] || channel,
    rows,
  }));
}

function summarize(channelBlocks) {
  let improved = 0;
  let declined = 0;
  let top3 = 0;
  let aiMentions = 0;
  let aiTotal = 0;

  for (const block of channelBlocks) {
    for (const r of block.rows) {
      if (block.channel === 'ai') {
        aiTotal += 1;
        if (r.after) aiMentions += 1;
        continue;
      }
      if (r.change > 0) improved += 1;
      if (r.change < 0) declined += 1;
      if (r.after != null && r.after <= 3) top3 += 1;
    }
  }
  return { improved, declined, top3, aiMentions, aiTotal };
}

/**
 * @param input { client:{name}, period:{label}, start, end, items }
 * @returns { report, operatorNotes }
 *   report        -> the only thing the renderer sees (client-safe)
 *   operatorNotes -> for you, never rendered (e.g. a finished item missing its client summary)
 */
function buildReportData({ client, period, start, end, items }) {
  const operatorNotes = [];
  const grouped = {};

  for (const item of items) {
    if (!REPORTABLE.has(item.status)) continue;
    if (!item.clientSummary || !item.clientSummary.trim()) {
      operatorNotes.push(`Item ${item.id} is ${item.status} but has no client summary, so it was left out of the report.`);
      continue;
    }
    const category = CATEGORY_LABELS[item.category] ? item.category : 'other';
    (grouped[category] ||= []).push({
      summary: item.clientSummary.trim(),
      url: item.resultUrl || null,
      date: item.status === 'scheduled' ? item.scheduledFor || null : item.completedAt || null,
      scheduled: item.status === 'scheduled',
    });
  }

  const work = Object.entries(grouped).map(([category, entries]) => ({
    category,
    title: CATEGORY_LABELS[category],
    entries,
  }));

  const rankings = compareRankings(start, end);

  return {
    report: {
      clientName: client.name,
      periodLabel: period.label,
      summary: { ...summarize(rankings), workItems: work.reduce((n, g) => n + g.entries.length, 0) },
      rankings,
      work,
    },
    operatorNotes,
  };
}

module.exports = { buildReportData, compareRankings, CATEGORY_LABELS, CHANNEL_LABELS };
