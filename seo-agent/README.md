# SEO Agent (Digital Blitz)

Four bots that run a client's SEO every month. First client: Tander.

## Monthly rhythm

| When | Bot | What happens |
|---|---|---|
| Day 1 | **Ranking Bot** | Snapshots Google, Bing, Map Pack and AI-answer rankings (`kind = start`) |
| Day 2 | **Strategy Bot** | One bot, three modules (Local, AI/GEO, Google/Bing). Posts a numbered proposal list to Slack |
| Day 3 | **You** | React ✅ approve / ❌ reject on each item |
| Day 3 onward | **Implementation Bot** | Polls Slack hourly, implements newly approved items, repeats until every item is decided |
| Last days of month | **Ranking Bot** | Second snapshot (`kind = end`) |
| Last days of month | **Client Report Bot** | Builds the Digital Blitz PDF and posts it to you in Slack to forward |

## Rules

- **Approval is per item.** Only ✅ items are implemented. No reaction means nothing runs.
- **Reminder at 24h, rollover at 48h.** An item with no reaction after 48h is deferred to next month's list. Both ✅ and ❌ on one item is treated as no decision and flagged.
- **"Done" means our part is done**: published, sent, or scheduled. Outcomes show up in later rankings.
- **The report waits** until nothing is `proposed`, `approved` or `in_progress`.
- **Failed items** are retried, then you are alerted privately. They are left out of the client report.
- **The report is client-safe by construction.** The report renderer only receives what `src/reportData.js` returns: ranking comparisons, plus finished items' plain-language `client_summary`. Rationale, rejected, failed and deferred items never reach it. The database view `seo_client_report_items` enforces the same boundary for the report bot's DB role.

## What's here

- `src/lifecycle.js`: approval, reminder, rollover and report-readiness rules (pure functions)
- `src/reportData.js`: ranking comparison and the client-safe report boundary
- `report/render.js`: Digital Blitz PDF renderer (Playwright). Placeholder colours; swap in real brand assets in `BRAND`
- `report/make-sample.js` / `report/sample.json`: sample report on placeholder data
- `schema.sql`: Supabase tables (`seo_*`). **Not applied yet.**
- `clients/tander.example.json`: per-client config template to fill in
- `test/`: 16 tests covering the rules above

```
npm test
NODE_PATH="$(npm root -g)" npm run report:sample   # needs playwright; writes report/out/sample-report.pdf
```

## Not built yet

- Ranking Bot collectors (Search Console, Bing Webmaster, GA4, Semrush, Map Pack, AI prompt panel)
- Strategy Bot prompt and skills (Local, AI/GEO, Google/Bing)
- Slack poster and hourly poller
- Implementation Bot (needs the site's CMS or repo access, and GBP API access)
- Scheduler (monthly start/end runs and the hourly poll)
