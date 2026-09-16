-- News phase 3: historical impact, AI explanation cache, daily digests,
-- and traceable Financial Lab events created from news.

alter table public.lab_events
  add column if not exists source_news_id uuid references public.news_articles(id) on delete set null,
  add column if not exists source_news_external_id text,
  add column if not exists source_news_snapshot jsonb;

create index if not exists lab_events_source_news_idx
  on public.lab_events (source_news_id)
  where source_news_id is not null;

create table public.news_impact_snapshots (
  id uuid primary key default gen_random_uuid(),
  news_id uuid references public.news_articles(id) on delete cascade,
  external_news_id text,
  symbol text not null,
  published_at timestamptz not null,
  timeframe text not null default '1d',
  before_price numeric(18, 8),
  after_1h_price numeric(18, 8),
  after_24h_price numeric(18, 8),
  after_7d_price numeric(18, 8),
  return_1h numeric(12, 6),
  return_24h numeric(12, 6),
  return_7d numeric(12, 6),
  sample_size integer not null default 0 check (sample_size >= 0),
  methodology_version text not null default 'v1',
  calculated_at timestamptz not null default now(),
  check (news_id is not null or external_news_id is not null),
  unique nulls not distinct (news_id, external_news_id, symbol, timeframe)
);

create index news_impact_snapshots_symbol_time_idx
  on public.news_impact_snapshots (symbol, published_at desc);

create table public.news_ai_explanations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  news_id uuid references public.news_articles(id) on delete cascade,
  external_news_id text,
  language text not null default 'es' check (language in ('es', 'en')),
  provider text not null,
  model text,
  explanation jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  check (news_id is not null or external_news_id is not null)
);

create index news_ai_explanations_lookup_idx
  on public.news_ai_explanations (user_id, news_id, external_news_id, language, created_at desc);

create table public.user_news_daily_digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  room_id uuid references public.rooms(id) on delete cascade,
  digest_date date not null,
  symbols text[] not null default '{}',
  content jsonb not null,
  generated_at timestamptz not null default now(),
  unique nulls not distinct (user_id, room_id, digest_date)
);

create index user_news_daily_digests_user_date_idx
  on public.user_news_daily_digests (user_id, digest_date desc);
create index user_news_daily_digests_room_date_idx
  on public.user_news_daily_digests (room_id, digest_date desc)
  where room_id is not null;

alter table public.news_impact_snapshots enable row level security;
alter table public.news_ai_explanations enable row level security;
alter table public.user_news_daily_digests enable row level security;

revoke all on public.news_impact_snapshots, public.news_ai_explanations,
  public.user_news_daily_digests from public, anon, authenticated;
grant select, insert, update, delete on public.news_impact_snapshots,
  public.news_ai_explanations, public.user_news_daily_digests to service_role;

comment on table public.news_impact_snapshots is
  'Descriptive before/after market observations; never a causal attribution or forecast.';
comment on table public.news_ai_explanations is
  'Cached educational explanations generated server-side, with deterministic fallback support.';

notify pgrst, 'reload schema';
