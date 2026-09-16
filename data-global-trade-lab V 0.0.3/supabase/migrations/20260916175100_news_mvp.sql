-- GlobalTradeLab News phases 1 and 2: initial domain generation.
-- Provider ingestion is server-side; clients use authenticated API routes only.

create table public.news_event_clusters (
  id text primary key,
  canonical_title text not null,
  summary text not null default '',
  category text not null default 'markets',
  region text not null default 'global',
  importance_score numeric(6, 3) not null default 0 check (importance_score >= 0),
  source_count integer not null default 1 check (source_count > 0),
  first_published_at timestamptz not null,
  last_published_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table public.news_articles (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  provider text not null,
  source_name text not null,
  title text not null,
  summary text not null default '',
  body_excerpt text not null default '',
  source_url text,
  image_url text,
  author text,
  language text not null default 'es' check (language in ('es', 'en')),
  category text not null default 'markets',
  region text not null default 'global',
  country text,
  published_at timestamptz not null,
  updated_at timestamptz not null default now(),
  fetched_at timestamptz not null default now(),
  event_cluster_id text references public.news_event_clusters(id) on delete set null,
  importance_score numeric(6, 3) not null default 0 check (importance_score >= 0),
  is_breaking boolean not null default false,
  is_demo boolean not null default false,
  sentiment_label text not null default 'neutral'
    check (sentiment_label in ('positive', 'neutral', 'negative', 'mixed')),
  sentiment_score numeric(5, 4) check (sentiment_score between -1 and 1),
  sentiment_provider text,
  sentiment_updated_at timestamptz,
  search_vector tsvector generated always as (
    to_tsvector(
      'spanish',
      coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' ||
      coalesce(source_name, '') || ' ' || coalesce(category, '') || ' ' ||
      coalesce(country, '')
    )
  ) stored,
  unique (provider, external_id)
);

create table public.news_assets (
  news_id uuid not null references public.news_articles(id) on delete cascade,
  asset_id text,
  symbol text not null,
  asset_name text,
  asset_type text not null default 'stock'
    check (asset_type in ('stock', 'etf', 'index', 'forex', 'crypto', 'commodities', 'bonds')),
  relation_type text not null default 'related'
    check (relation_type in ('direct', 'related', 'mentioned')),
  relevance_score numeric(5, 4) not null default 0 check (relevance_score between 0 and 1),
  primary key (news_id, symbol)
);

create table public.news_topics (
  news_id uuid not null references public.news_articles(id) on delete cascade,
  topic text not null,
  primary key (news_id, topic)
);

create table public.user_saved_news (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  news_id uuid not null references public.news_articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, news_id)
);

create table public.user_news_read (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  news_id uuid not null references public.news_articles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, news_id)
);

create table public.economic_events (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  provider text not null,
  title text not null,
  description text not null default '',
  country text not null,
  region text not null default 'global',
  currency text,
  category text not null default 'other',
  impact text not null default 'medium' check (impact in ('low', 'medium', 'high')),
  scheduled_at timestamptz not null,
  previous_value text,
  forecast_value text,
  actual_value text,
  status text not null default 'scheduled' check (status in ('scheduled', 'released', 'revised', 'cancelled')),
  source_url text,
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);

create table public.user_news_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  name text not null,
  symbols text[] not null default '{}',
  topics text[] not null default '{}',
  categories text[] not null default '{}',
  regions text[] not null default '{}',
  min_importance numeric(6, 3) not null default 0 check (min_importance between 0 and 100),
  enabled boolean not null default true,
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.news_alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.user_news_alerts(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  news_id uuid not null references public.news_articles(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  seen_at timestamptz,
  unique (alert_id, news_id)
);

create table public.news_class_shares (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  news_id uuid references public.news_articles(id) on delete set null,
  external_news_id text,
  shared_by uuid not null references public.profiles(user_id) on delete cascade,
  note text not null default '',
  news_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  check (news_id is not null or external_news_id is not null)
);

alter table public.activities
  add column if not exists source_news_id uuid references public.news_articles(id) on delete set null,
  add column if not exists source_news_external_id text,
  add column if not exists source_news_snapshot jsonb;

create index news_articles_published_cursor_idx
  on public.news_articles (published_at desc, id desc);
create index news_articles_category_published_idx
  on public.news_articles (category, published_at desc);
create index news_articles_region_published_idx
  on public.news_articles (region, published_at desc);
create index news_articles_trending_idx
  on public.news_articles (importance_score desc, published_at desc);
create index news_articles_event_cluster_idx
  on public.news_articles (event_cluster_id)
  where event_cluster_id is not null;
create index news_articles_search_idx
  on public.news_articles using gin (search_vector);
create index news_assets_symbol_news_idx
  on public.news_assets (symbol, news_id);
create index news_assets_type_news_idx
  on public.news_assets (asset_type, news_id);
create index news_topics_topic_news_idx
  on public.news_topics (topic, news_id);
create index user_saved_news_user_created_idx
  on public.user_saved_news (user_id, created_at desc);
create index user_saved_news_news_idx
  on public.user_saved_news (news_id);
create index user_news_read_user_read_idx
  on public.user_news_read (user_id, read_at desc);
create index user_news_read_news_idx
  on public.user_news_read (news_id);
create index news_event_clusters_last_published_idx
  on public.news_event_clusters (last_published_at desc, importance_score desc);
create index economic_events_schedule_idx
  on public.economic_events (scheduled_at, impact);
create index economic_events_region_schedule_idx
  on public.economic_events (region, scheduled_at);
create index user_news_alerts_user_enabled_idx
  on public.user_news_alerts (user_id, enabled, created_at desc);
create index news_alert_deliveries_user_seen_idx
  on public.news_alert_deliveries (user_id, seen_at, delivered_at desc);
create index news_alert_deliveries_news_idx
  on public.news_alert_deliveries (news_id);
create index news_class_shares_room_created_idx
  on public.news_class_shares (room_id, created_at desc);
create index news_class_shares_shared_by_idx
  on public.news_class_shares (shared_by);
create index activities_source_news_idx
  on public.activities (source_news_id)
  where source_news_id is not null;

alter table public.news_articles enable row level security;
alter table public.news_assets enable row level security;
alter table public.news_topics enable row level security;
alter table public.user_saved_news enable row level security;
alter table public.user_news_read enable row level security;
alter table public.news_event_clusters enable row level security;
alter table public.economic_events enable row level security;
alter table public.user_news_alerts enable row level security;
alter table public.news_alert_deliveries enable row level security;
alter table public.news_class_shares enable row level security;

revoke all on public.news_articles, public.news_assets, public.news_topics,
  public.user_saved_news, public.user_news_read from anon, authenticated;
revoke all on public.news_event_clusters, public.economic_events, public.user_news_alerts,
  public.news_alert_deliveries, public.news_class_shares from anon, authenticated;
grant select, insert, update, delete on public.news_articles, public.news_assets,
  public.news_topics, public.user_saved_news, public.user_news_read to service_role;
grant select, insert, update, delete on public.news_event_clusters, public.economic_events,
  public.user_news_alerts, public.news_alert_deliveries, public.news_class_shares to service_role;

comment on table public.news_articles is 'Normalized financial news ingested by server-side providers.';
comment on table public.user_saved_news is 'Global per-user saved news; intentionally not scoped to a class.';
