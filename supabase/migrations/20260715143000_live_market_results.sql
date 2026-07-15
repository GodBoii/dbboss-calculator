-- Lakshmi Boss live market results and Web Push persistence.
-- The monitoring cron is intentionally created in a later migration, after the
-- production monitoring endpoint and its secret have been deployed.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create table public.markets (
  id text primary key,
  display_name text not null unique,
  homepage_name text not null unique,
  session text not null check (session in ('day', 'night')),
  open_time time not null,
  close_time time not null,
  timezone text not null default 'Asia/Kolkata',
  history_url text not null unique,
  source_url text not null default 'https://dpbossss.boston/',
  sort_order smallint not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.market_results (
  id uuid primary key default gen_random_uuid(),
  market_id text not null references public.markets(id) on update cascade,
  result_date date not null,
  status text not null check (status in ('open', 'closed', 'corrected')),
  open_panel text not null check (open_panel ~ '^[0-9]{3}$'),
  open_digit smallint not null check (open_digit between 0 and 9),
  jodi text check (jodi is null or jodi ~ '^[0-9]{2}$'),
  close_panel text check (close_panel is null or close_panel ~ '^[0-9]{3}$'),
  close_digit smallint check (close_digit is null or close_digit between 0 and 9),
  raw_source_value text not null,
  source_url text not null default 'https://dpbossss.boston/',
  source_hash text not null,
  first_detected_at timestamptz not null,
  confirmed_at timestamptz not null,
  corrected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (market_id, result_date),
  check (
    (status = 'open' and jodi is null and close_panel is null and close_digit is null)
    or
    (status in ('closed', 'corrected') and jodi is not null and close_panel is not null and close_digit is not null)
  )
);

create index market_results_date_idx
  on public.market_results (result_date desc, market_id);

create table public.result_events (
  id bigint generated always as identity primary key,
  result_id uuid not null references public.market_results(id) on delete cascade,
  phase text not null check (phase in ('open', 'close', 'correction')),
  source_hash text not null,
  payload jsonb not null,
  detected_at timestamptz not null,
  confirmed_at timestamptz not null,
  push_started_at timestamptz,
  push_completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (result_id, phase, source_hash)
);

create index result_events_unpushed_idx
  on public.result_events (confirmed_at)
  where push_completed_at is null;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time bigint,
  enabled boolean not null default true,
  show_result_in_notification boolean not null default true,
  user_agent text,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_preferences (
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  market_id text not null references public.markets(id) on update cascade,
  notify_open boolean not null default true,
  notify_close boolean not null default true,
  primary key (subscription_id, market_id)
);

create index notification_preferences_market_idx
  on public.notification_preferences (market_id)
  where notify_open or notify_close;

create table public.monitor_candidates (
  market_id text not null references public.markets(id) on update cascade,
  result_date date not null,
  phase text not null check (phase in ('open', 'close')),
  raw_source_value text not null,
  source_hash text not null,
  consecutive_observations smallint not null default 1
    check (consecutive_observations between 1 and 10),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  primary key (market_id, result_date, phase)
);

create table public.monitor_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null check (status in ('running', 'success', 'source_error', 'parse_error', 'internal_error')),
  active_markets text[] not null default '{}',
  source_http_status smallint,
  source_cache_status text,
  source_age_seconds integer,
  parsed_market_count smallint,
  confirmed_event_count smallint not null default 0,
  error_message text
);

create index monitor_runs_started_at_idx
  on public.monitor_runs (started_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger markets_set_updated_at
before update on public.markets
for each row execute function public.set_updated_at();

create trigger market_results_set_updated_at
before update on public.market_results
for each row execute function public.set_updated_at();

create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

insert into public.markets
  (id, display_name, homepage_name, session, open_time, close_time, history_url, sort_order)
values
  ('sridevi', 'Sridevi', 'SRIDEVI', 'day', '11:30', '12:30', 'https://dpbossss.boston/panel-chart-record/sridevi.php', 1),
  ('time-bazar', 'Time Bazar', 'TIME BAZAR', 'day', '13:00', '14:00', 'https://dpbossss.boston/panel-chart-record/time-bazar.php', 2),
  ('madhur-day', 'Madhur Day', 'MADHUR DAY', 'day', '13:25', '14:25', 'https://dpbossss.boston/panel-chart-record/madhur-day.php', 3),
  ('milan-day', 'Milan Day', 'MILAN DAY', 'day', '15:00', '17:00', 'https://dpbossss.boston/panel-chart-record/milan-day.php', 4),
  ('rajdhani-day', 'Rajdhani Day', 'RAJDHANI DAY', 'day', '15:00', '17:00', 'https://dpbossss.boston/panel-chart-record/rajdhani-day.php', 5),
  ('kalyan', 'Kalyan', 'KALYAN', 'day', '15:55', '17:55', 'https://dpbossss.boston/panel-chart-record/kalyan.php', 6),
  ('sridevi-night', 'Sridevi Night', 'SRIDEVI NIGHT', 'night', '19:10', '20:10', 'https://dpbossss.boston/panel-chart-record/sridevi-night.php', 7),
  ('madhur-night', 'Madhur Night', 'MADHUR NIGHT', 'night', '20:28', '22:28', 'https://dpbossss.boston/panel-chart-record/madhur-night.php', 8),
  ('milan-night', 'Milan Night', 'MILAN NIGHT', 'night', '20:55', '22:55', 'https://dpbossss.boston/panel-chart-record/milan-night.php', 9),
  ('kalyan-night', 'Kalyan Night', 'KALYAN NIGHT', 'night', '21:25', '23:25', 'https://dpbossss.boston/panel-chart-record/kalyan-night.php', 10),
  ('rajdhani-night', 'Rajdhani Night', 'RAJDHANI NIGHT', 'night', '21:25', '23:25', 'https://dpbossss.boston/panel-chart-record/rajdhani-night.php', 11),
  ('main-bazar', 'Main Bazar', 'MAIN BAZAR', 'night', '21:48', '23:55', 'https://dpbossss.boston/panel-chart-record/main-bazar.php', 12);

alter table public.markets enable row level security;
alter table public.market_results enable row level security;
alter table public.result_events enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.monitor_candidates enable row level security;
alter table public.monitor_runs enable row level security;

revoke all on table public.markets from anon, authenticated;
revoke all on table public.market_results from anon, authenticated;
revoke all on table public.result_events from anon, authenticated;
revoke all on table public.push_subscriptions from anon, authenticated;
revoke all on table public.notification_preferences from anon, authenticated;
revoke all on table public.monitor_candidates from anon, authenticated;
revoke all on table public.monitor_runs from anon, authenticated;

grant select on table public.markets to anon, authenticated;
grant select on table public.market_results to anon, authenticated;

create policy "Public can read active markets"
on public.markets
for select
to anon, authenticated
using (is_active);

create policy "Public can read confirmed market results"
on public.market_results
for select
to anon, authenticated
using (confirmed_at <= now());

comment on table public.markets is 'Allowlisted markets and their Asia/Kolkata monitoring schedule.';
comment on table public.market_results is 'Latest confirmed open or close result for a market and result date.';
comment on table public.result_events is 'Idempotent open, close, and correction events used for Web Push delivery.';
comment on table public.push_subscriptions is 'Server-only Web Push endpoints and encryption keys.';
comment on table public.notification_preferences is 'Per-device market and phase notification preferences.';
comment on table public.monitor_candidates is 'Two-observation confirmation state for newly scraped values.';
comment on table public.monitor_runs is 'Operational audit trail for scheduled source checks.';
