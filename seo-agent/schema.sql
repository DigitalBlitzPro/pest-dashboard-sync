-- SEO agent schema. NOT applied anywhere yet: review, then run it against the
-- Supabase project you want to use. All tables are prefixed seo_ so they cannot
-- collide with the existing pest dashboard tables.

create table if not exists seo_clients (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  config      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- One row per client per month.
create table if not exists seo_cycles (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references seo_clients(id) on delete cascade,
  month          date not null,                        -- first day of the month
  status         text not null default 'open'
                 check (status in ('open', 'report_sent')),
  report_sent_at timestamptz,
  unique (client_id, month)
);

-- Ranking Bot output. 'start' feeds the Strategy Bot, 'end' feeds the report.
create table if not exists seo_ranking_snapshots (
  id        uuid primary key default gen_random_uuid(),
  cycle_id  uuid not null references seo_cycles(id) on delete cascade,
  kind      text not null check (kind in ('start', 'end')),
  taken_at  timestamptz not null default now(),
  rows      jsonb not null,   -- [{channel, label, position|null} | {channel:'ai', engine, label, mentioned}]
  unique (cycle_id, kind)
);

-- Strategy Bot output; Implementation Bot works from the same rows.
create table if not exists seo_proposals (
  id              uuid primary key default gen_random_uuid(),
  cycle_id        uuid not null references seo_cycles(id) on delete cascade,
  seq             int  not null,                       -- the number shown in Slack
  track           text not null check (track in ('local', 'ai', 'google_bing')),
  category        text not null check (category in (
                    'new_page', 'blog_post', 'gbp_post', 'backlink', 'internal_link',
                    'alt_text', 'schema', 'meta', 'citation', 'other')),
  title           text not null,
  rationale       text not null,                       -- INTERNAL: never shown to the client
  details         jsonb not null default '{}'::jsonb,  -- INTERNAL: briefs, target URLs, copy
  status          text not null default 'proposed'
                  check (status in ('proposed', 'approved', 'rejected', 'deferred',
                                    'in_progress', 'done', 'scheduled', 'failed')),
  slack_channel   text,
  slack_ts        text,
  posted_at       timestamptz,
  reminded_at     timestamptz,
  decided_at      timestamptz,
  rolled_from     uuid references seo_proposals(id),   -- set when carried over from a deferred item
  failure_note    text,                                -- INTERNAL
  client_summary  text,                                -- written by the Implementation Bot, plain language
  result_url      text,
  scheduled_for   date,
  completed_at    timestamptz,
  unique (cycle_id, seq)
);

-- The only view the Client Report Bot is allowed to read for completed work.
-- It exposes client-safe columns only, for finished items only.
create or replace view seo_client_report_items as
  select cycle_id, category, client_summary, result_url, scheduled_for, completed_at, status
  from seo_proposals
  where status in ('done', 'scheduled')
    and client_summary is not null
    and length(trim(client_summary)) > 0;

-- Lock everything down. Bots connect with the service role, which bypasses RLS;
-- the Client Report Bot should use its own role granted SELECT on
-- seo_client_report_items and seo_ranking_snapshots only.
alter table seo_clients            enable row level security;
alter table seo_cycles             enable row level security;
alter table seo_ranking_snapshots  enable row level security;
alter table seo_proposals          enable row level security;

-- Example, once you create the role:
--   create role seo_report_bot login password '...';
--   grant select on seo_client_report_items, seo_ranking_snapshots, seo_cycles, seo_clients to seo_report_bot;
