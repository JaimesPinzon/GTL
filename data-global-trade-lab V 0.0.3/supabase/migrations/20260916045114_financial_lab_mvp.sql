-- Financial Lab MVP. This domain is intentionally isolated from live market tables,
-- room portfolios and real-data providers. All access goes through authenticated API routes.
create extension if not exists pgcrypto;

begin;

create table public.lab_synthetic_markets (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(user_id) on delete cascade,
  name text not null check (length(trim(name)) between 3 and 120),
  description text not null default '',
  market_type text not null check (market_type in ('stocks','forex','commodities','bonds','crypto','mixed')),
  base_currency text not null default 'USD' check (base_currency ~ '^[A-Z]{3}$'),
  start_at timestamptz not null,
  duration_periods integer not null check (duration_periods between 10 and 1000),
  timeframe_minutes integer not null check (timeframe_minutes in (1,5,15,60,1440)),
  configuration_mode text not null default 'basic' check (configuration_mode in ('basic','advanced')),
  trend text not null default 'sideways' check (trend in ('bullish','bearish','sideways','custom')),
  expected_return numeric(10,6) not null default 0,
  volatility numeric(10,6) not null default 0.012 check (volatility > 0 and volatility <= 1),
  liquidity numeric(18,2) not null default 1000000 check (liquidity > 0),
  average_volume numeric(18,2) not null default 100000 check (average_volume > 0),
  spread_bps numeric(10,4) not null default 10 check (spread_bps >= 0 and spread_bps <= 10000),
  jump_probability numeric(10,6) not null default 0 check (jump_probability between 0 and 1),
  jump_magnitude numeric(10,6) not null default 0 check (jump_magnitude between 0 and 1),
  mean_reversion numeric(10,6) not null default 0 check (mean_reversion between 0 and 1),
  max_period_change numeric(10,6) not null default 0.20 check (max_period_change > 0 and max_period_change <= 1),
  starting_balance numeric(18,2) not null default 100000 check (starting_balance > 0),
  seed bigint not null default 2026,
  status text not null default 'draft' check (status in ('draft','validated','available','in_use','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lab_synthetic_markets_owner_idx on public.lab_synthetic_markets(created_by, created_at desc);

create table public.lab_synthetic_assets (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.lab_synthetic_markets(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 120),
  symbol text not null check (symbol ~ '^[A-Z0-9][A-Z0-9._-]{0,14}$'),
  sector text not null default 'General',
  initial_price numeric(18,6) not null check (initial_price > 0),
  available_quantity numeric(24,6) not null default 500000 check (available_quantity > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  short_selling boolean not null default false,
  max_leverage numeric(8,2) not null default 1 check (max_leverage >= 1 and max_leverage <= 20),
  commission_bps numeric(10,4) not null default 0 check (commission_bps >= 0 and commission_bps <= 10000),
  created_at timestamptz not null default now(),
  unique(market_id, symbol)
);

create index lab_synthetic_assets_market_idx on public.lab_synthetic_assets(market_id);

create table public.lab_events (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(user_id) on delete cascade,
  source_event_id uuid references public.lab_events(id) on delete set null,
  event_kind text not null default 'custom' check (event_kind in ('base','custom','historical','historical_inspired')),
  name text not null check (length(trim(name)) between 3 and 140),
  description text not null default '',
  category text not null default 'macroeconomics',
  difficulty text not null default 'intermediate' check (difficulty in ('basic','intermediate','advanced')),
  academic_objective text not null default '',
  activation_type text not null default 'temporal' check (activation_type in ('temporal','conditional','probabilistic','manual','chained')),
  default_period integer check (default_period is null or default_period >= 0),
  direction text not null default 'negative' check (direction in ('positive','negative','mixed')),
  impact_percent numeric(10,6) not null default 0 check (impact_percent between -1 and 1),
  volatility_multiplier numeric(10,4) not null default 1 check (volatility_multiplier > 0 and volatility_multiplier <= 20),
  duration_periods integer not null default 1 check (duration_periods between 1 and 1000),
  headline text not null default '',
  message text not null default '',
  simulated_source text not null default 'Agencia GTL',
  status text not null default 'draft' check (status in ('draft','tested','published','archived')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lab_events_owner_idx on public.lab_events(created_by, created_at desc);
create index lab_events_source_idx on public.lab_events(source_event_id) where source_event_id is not null;

insert into public.lab_events (
  event_kind, name, description, category, difficulty, academic_objective,
  activation_type, direction, impact_percent, volatility_multiplier, duration_periods,
  headline, message, simulated_source, status
) values
  ('base', 'Incremento de tasas de interés', 'Endurecimiento inesperado de la política monetaria.', 'macroeconomics', 'intermediate', 'Analizar el efecto de las tasas sobre la valoración de activos.', 'temporal', 'negative', -0.035, 1.45, 3, 'El banco central eleva su tasa de referencia', 'La autoridad monetaria anunció un aumento de tasas superior al esperado por el mercado.', 'Banco Central Simulado', 'published'),
  ('base', 'Resultados financieros positivos', 'La empresa supera las expectativas del mercado.', 'corporate', 'basic', 'Relacionar información fundamental y formación de precios.', 'temporal', 'positive', 0.055, 1.25, 2, 'Resultados superan las expectativas', 'La compañía informó crecimiento de ingresos y márgenes por encima del consenso.', 'Noticias Corporativas GTL', 'published'),
  ('base', 'Pánico de mercado', 'Un episodio de aversión al riesgo reduce la liquidez.', 'market', 'advanced', 'Gestionar exposición y riesgo durante episodios de tensión.', 'temporal', 'negative', -0.075, 2.4, 4, 'Ventas generalizadas presionan al mercado', 'Aumenta la demanda de liquidez mientras los participantes reducen posiciones de riesgo.', 'Agencia GTL', 'published'),
  ('base', 'Recuperación económica', 'Los indicadores anticipados mejoran de forma sostenida.', 'macroeconomics', 'intermediate', 'Evaluar una rotación hacia activos sensibles al ciclo.', 'temporal', 'positive', 0.028, 1.15, 5, 'Indicadores anticipan una recuperación', 'Producción, empleo y confianza muestran una mejora coordinada.', 'Instituto Económico Simulado', 'published');

create table public.lab_scenarios (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.lab_synthetic_markets(id) on delete restrict,
  room_id uuid references public.rooms(id) on delete set null,
  created_by uuid not null references public.profiles(user_id) on delete cascade,
  parent_scenario_id uuid references public.lab_scenarios(id) on delete set null,
  name text not null check (length(trim(name)) between 3 and 140),
  description text not null default '',
  academic_objective text not null default '',
  duration_periods integer not null check (duration_periods between 10 and 1000),
  seed bigint not null,
  status text not null default 'draft' check (status in ('draft','testing','ready','assigned','active','finished')),
  version integer not null default 1 check (version > 0),
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lab_scenarios_owner_idx on public.lab_scenarios(created_by, created_at desc);
create index lab_scenarios_room_idx on public.lab_scenarios(room_id, status);
create index lab_scenarios_market_idx on public.lab_scenarios(market_id);

create table public.lab_scenario_events (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.lab_scenarios(id) on delete cascade,
  event_id uuid not null references public.lab_events(id) on delete restrict,
  activation_period integer not null check (activation_period >= 0),
  impact_override numeric(10,6) check (impact_override is null or impact_override between -1 and 1),
  created_at timestamptz not null default now(),
  unique(scenario_id, event_id, activation_period)
);

create index lab_scenario_events_scenario_period_idx on public.lab_scenario_events(scenario_id, activation_period);
create index lab_scenario_events_event_idx on public.lab_scenario_events(event_id);

create table public.lab_simulation_sessions (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.lab_scenarios(id) on delete restrict,
  room_id uuid not null references public.rooms(id) on delete cascade,
  created_by uuid not null references public.profiles(user_id) on delete cascade,
  name text not null check (length(trim(name)) between 3 and 140),
  state text not null default 'scheduled' check (state in ('scheduled','active','paused','finished','cancelled')),
  current_period integer not null default 0 check (current_period >= 0),
  speed numeric(8,2) not null default 1 check (speed > 0 and speed <= 60),
  seed bigint not null,
  initial_balance numeric(18,2) not null check (initial_balance > 0),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lab_sessions_room_state_idx on public.lab_simulation_sessions(room_id, state, created_at desc);
create index lab_sessions_scenario_idx on public.lab_simulation_sessions(scenario_id);

create table public.lab_simulation_ticks (
  session_id uuid not null references public.lab_simulation_sessions(id) on delete cascade,
  asset_id uuid not null references public.lab_synthetic_assets(id) on delete cascade,
  period integer not null check (period >= 0),
  tick_at timestamptz not null,
  open_price numeric(18,6) not null check (open_price > 0),
  high_price numeric(18,6) not null check (high_price > 0),
  low_price numeric(18,6) not null check (low_price > 0),
  close_price numeric(18,6) not null check (close_price > 0),
  volume numeric(24,6) not null check (volume >= 0),
  primary key(session_id, asset_id, period),
  check (high_price >= greatest(open_price, close_price)),
  check (low_price <= least(open_price, close_price))
);

create index lab_ticks_session_period_idx on public.lab_simulation_ticks(session_id, period);

create table public.lab_session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lab_simulation_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  cash_balance numeric(18,2) not null,
  equity numeric(18,2) not null,
  realized_pnl numeric(18,2) not null default 0,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id, user_id)
);

create index lab_participants_user_idx on public.lab_session_participants(user_id, session_id);

create table public.lab_positions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lab_simulation_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  asset_id uuid not null references public.lab_synthetic_assets(id) on delete restrict,
  quantity numeric(24,6) not null default 0,
  average_price numeric(18,6) not null check (average_price > 0),
  updated_at timestamptz not null default now(),
  unique(session_id, user_id, asset_id)
);

create index lab_positions_user_session_idx on public.lab_positions(user_id, session_id);
create index lab_positions_asset_idx on public.lab_positions(asset_id);

create table public.lab_simulation_actions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lab_simulation_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  asset_id uuid not null references public.lab_synthetic_assets(id) on delete restrict,
  period integer not null check (period >= 0),
  action_type text not null check (action_type in ('buy','sell')),
  quantity numeric(24,6) not null check (quantity > 0),
  execution_price numeric(18,6) not null check (execution_price > 0),
  commission numeric(18,6) not null default 0 check (commission >= 0),
  justification text not null check (length(trim(justification)) > 0),
  created_at timestamptz not null default now()
);

create index lab_actions_session_user_idx on public.lab_simulation_actions(session_id, user_id, created_at desc);

create table public.lab_teacher_interventions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lab_simulation_sessions(id) on delete cascade,
  teacher_id uuid not null references public.profiles(user_id) on delete cascade,
  action_type text not null check (action_type in ('start','pause','resume','advance','reset','finish','speed_change','manual_event','message')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index lab_interventions_session_idx on public.lab_teacher_interventions(session_id, created_at desc);

-- The browser never receives direct table privileges. API routes authenticate users,
-- enforce room roles and use the server-only service role.
alter table public.lab_synthetic_markets enable row level security;
alter table public.lab_synthetic_assets enable row level security;
alter table public.lab_events enable row level security;
alter table public.lab_scenarios enable row level security;
alter table public.lab_scenario_events enable row level security;
alter table public.lab_simulation_sessions enable row level security;
alter table public.lab_simulation_ticks enable row level security;
alter table public.lab_session_participants enable row level security;
alter table public.lab_positions enable row level security;
alter table public.lab_simulation_actions enable row level security;
alter table public.lab_teacher_interventions enable row level security;

revoke all on public.lab_synthetic_markets, public.lab_synthetic_assets, public.lab_events,
  public.lab_scenarios, public.lab_scenario_events, public.lab_simulation_sessions,
  public.lab_simulation_ticks, public.lab_session_participants, public.lab_positions,
  public.lab_simulation_actions, public.lab_teacher_interventions from public, anon, authenticated;

grant select, insert, update, delete on public.lab_synthetic_markets, public.lab_synthetic_assets,
  public.lab_events, public.lab_scenarios, public.lab_scenario_events, public.lab_simulation_sessions,
  public.lab_simulation_ticks, public.lab_session_participants, public.lab_positions,
  public.lab_simulation_actions, public.lab_teacher_interventions to service_role;

commit;

notify pgrst, 'reload schema';
