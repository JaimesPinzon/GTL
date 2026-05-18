create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.profiles (
    user_id uuid primary key references auth.users (id) on delete cascade,
    email text unique,
    name text default '',
    alias text default '',
    last_name text default '',
    dob date,
    country text default '',
    address text default '',
    avatar text default '',
    language text default 'es',
    timezone text default '(UTC-05:00)',
    plan text default 'Gratis',
    role text not null default 'student' check (role in ('student', 'teacher')),
    verified boolean not null default false,
    balance numeric(14, 2) not null default 10000,
    initial_balance numeric(14, 2) not null default 10000,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

drop policy if exists "profiles_select_accessible" on public.profiles;
drop policy if exists "positions_select_accessible" on public.positions;
drop policy if exists "transactions_select_accessible" on public.transactions;

drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "positions_modify_own" on public.positions;
drop policy if exists "transactions_modify_own" on public.transactions;

drop policy if exists "rooms_select_accessible" on public.rooms;
drop policy if exists "rooms_insert_own" on public.rooms;
drop policy if exists "rooms_update_teacher" on public.rooms;
drop policy if exists "room_members_select_accessible" on public.room_members;
drop policy if exists "room_members_insert_self_or_teacher" on public.room_members;
drop policy if exists "room_members_update_teacher" on public.room_members;
drop policy if exists "balance_adjustments_select_accessible" on public.balance_adjustments;
drop policy if exists "balance_adjustments_insert_teacher" on public.balance_adjustments;
drop policy if exists "activities_select_room_members" on public.activities;
drop policy if exists "activities_insert_teacher" on public.activities;
drop policy if exists "activities_update_teacher" on public.activities;
drop policy if exists "activity_posts_select_room_members" on public.activity_posts;
drop policy if exists "activity_posts_insert_room_members" on public.activity_posts;
drop policy if exists "activity_submissions_select_accessible" on public.activity_submissions;
drop policy if exists "activity_submissions_insert_self" on public.activity_submissions;
drop policy if exists "activity_submissions_update_accessible" on public.activity_submissions;
drop policy if exists "activity_grades_select_accessible" on public.activity_grades;
drop policy if exists "activity_grades_insert_teacher" on public.activity_grades;

alter table public.profiles
    drop column if exists class_name;

alter table public.profiles
    drop column if exists class_description;

alter table public.profiles
    drop column if exists class_code;

alter table public.profiles
    drop column if exists joined_class_code;

alter table public.positions
    add column if not exists room_id uuid references public.rooms (id) on delete cascade;

alter table public.transactions
    add column if not exists room_id uuid references public.rooms (id) on delete cascade;

create table if not exists public.positions (
    id text primary key,
    room_id uuid references public.rooms (id) on delete cascade,
    user_id uuid not null references public.profiles (user_id) on delete cascade,
    symbol text not null,
    type text not null check (type in ('BUY', 'SELL')),
    amount numeric(14, 2) not null,
    entry_price numeric(18, 8) not null,
    open_date timestamptz not null,
    justification text not null default '',
    attachment_name text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.transactions (
    id text primary key,
    room_id uuid references public.rooms (id) on delete cascade,
    user_id uuid not null references public.profiles (user_id) on delete cascade,
    type text not null,
    symbol text not null,
    amount numeric(14, 2) not null,
    price numeric(18, 8),
    entry_price numeric(18, 8),
    close_price numeric(18, 8),
    profit_or_loss numeric(14, 2),
    date timestamptz not null,
    justification text default '',
    attachment_name text,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.quote_history (
    id bigint generated always as identity primary key,
    requested_symbol text not null,
    provider_symbol text not null,
    asset_name text,
    exchange text,
    currency text,
    close_price numeric(18, 8),
    is_market_open boolean,
    percent_change numeric(14, 4),
    provider_timestamp text,
    raw_payload jsonb not null,
    fetched_at timestamptz not null default timezone('utc', now())
);

create index if not exists quote_history_requested_symbol_idx
    on public.quote_history (requested_symbol, fetched_at desc);

create table if not exists public.market_candles (
    id bigint generated always as identity primary key,
    requested_symbol text not null,
    provider_symbol text not null,
    interval text not null,
    candle_time timestamptz not null,
    exchange text,
    currency text,
    open_price numeric(18, 8) not null,
    high_price numeric(18, 8) not null,
    low_price numeric(18, 8) not null,
    close_price numeric(18, 8) not null,
    volume numeric(24, 8),
    fetched_at timestamptz not null default timezone('utc', now()),
    unique (requested_symbol, interval, candle_time)
);

create index if not exists market_candles_symbol_interval_time_idx
    on public.market_candles (requested_symbol, interval, candle_time desc);

create table if not exists public.candles (
    exchange_id text not null,
    instrument_id text not null,
    timeframe text not null,
    open_time timestamptz not null,
    requested_symbol text,
    provider_symbol text,
    exchange text,
    currency text,
    open_price numeric(18, 8) not null,
    high_price numeric(18, 8) not null,
    low_price numeric(18, 8) not null,
    close_price numeric(18, 8) not null,
    volume numeric(24, 8),
    variation_abs numeric(18, 8) generated always as (close_price - open_price) stored,
    variation_pct numeric(18, 8) generated always as (
        case
            when open_price = 0 then null
            else ((close_price - open_price) / open_price) * 100
        end
    ) stored,
    provider text not null default 'yahoo_finance',
    source_range text not null default 'max',
    is_final boolean not null default true,
    fetched_at timestamptz not null default timezone('utc', now()),
    primary key (exchange_id, instrument_id, timeframe, open_time)
) partition by range (open_time);

-- Seed explicit monthly partitions requested for initial rollout.
create table if not exists public.candles_2026_05
partition of public.candles
for values from ('2026-05-01 00:00:00+00') to ('2026-06-01 00:00:00+00');

create table if not exists public.candles_2026_06
partition of public.candles
for values from ('2026-06-01 00:00:00+00') to ('2026-07-01 00:00:00+00');

create table if not exists public.candles_2026_07
partition of public.candles
for values from ('2026-07-01 00:00:00+00') to ('2026-08-01 00:00:00+00');

create or replace function public.create_monthly_candle_partitions(months_ahead integer default 6)
returns void
language plpgsql
as $$
declare
    month_offset integer;
    partition_start timestamptz;
    partition_end timestamptz;
    partition_name text;
begin
    for month_offset in 0..greatest(months_ahead - 1, 0) loop
        partition_start := date_trunc('month', timezone('utc', now())) + (month_offset || ' months')::interval;
        partition_end := partition_start + interval '1 month';
        partition_name := format('candles_%s', to_char(partition_start, 'YYYY_MM'));

        execute format(
            'create table if not exists public.%I partition of public.candles for values from (%L) to (%L)',
            partition_name,
            partition_start,
            partition_end
        );
    end loop;
end;
$$;

create or replace function public.create_monthly_candle_partitions_between(
    window_start timestamptz,
    window_end timestamptz
)
returns void
language plpgsql
as $$
declare
    partition_start timestamptz;
    partition_end timestamptz;
    partition_name text;
begin
    if window_start is null or window_end is null then
        return;
    end if;

    partition_start := date_trunc('month', window_start);
    window_end := date_trunc('month', window_end);

    if window_end < partition_start then
        return;
    end if;

    while partition_start <= window_end loop
        partition_end := partition_start + interval '1 month';
        partition_name := format('candles_%s', to_char(partition_start, 'YYYY_MM'));

        execute format(
            'create table if not exists public.%I partition of public.candles for values from (%L) to (%L)',
            partition_name,
            partition_start,
            partition_end
        );

        partition_start := partition_end;
    end loop;
end;
$$;

-- Ensure future partitions exist before any migration writes.
select public.create_monthly_candle_partitions(6);

-- Pre-create long historical window so the table is ready after schema bootstrap.
-- Covers from 2000-01 through 2026-12 inclusive.
select public.create_monthly_candle_partitions_between(
    '2000-01-01 00:00:00+00'::timestamptz,
    '2026-12-01 00:00:00+00'::timestamptz
);

-- Ensure historical partitions exist before migrating legacy candles_*.
do $$
declare
    legacy_table text;
    legacy_tables text[] := array[
        'candles_1m','candles_5m','candles_15m','candles_1h',
        'candles_1d','candles_1wk','candles_1mo','candles_1y'
    ];
    local_min timestamptz;
    local_max timestamptz;
    global_min timestamptz;
    global_max timestamptz;
begin
    foreach legacy_table in array legacy_tables loop
        if to_regclass('public.' || legacy_table) is not null then
            execute format(
                'select min(candle_time), max(candle_time) from public.%I',
                legacy_table
            )
            into local_min, local_max;

            if local_min is not null then
                if global_min is null or local_min < global_min then
                    global_min := local_min;
                end if;
                if global_max is null or local_max > global_max then
                    global_max := local_max;
                end if;
            end if;
        end if;
    end loop;

    if global_min is not null and global_max is not null then
        perform public.create_monthly_candle_partitions_between(global_min, global_max);
    end if;
end;
$$;

-- Create DEFAULT partition only after required range partitions are ensured.
create table if not exists public.candles_default
partition of public.candles default;

-- Migrate legacy candles_* -> public.candles.
do $$
declare
    legacy_table text;
    legacy_tables text[] := array[
        'candles_1m','candles_5m','candles_15m','candles_1h',
        'candles_1d','candles_1wk','candles_1mo','candles_1y'
    ];
begin
    foreach legacy_table in array legacy_tables loop
        if to_regclass('public.' || legacy_table) is not null then
            execute format(
                $sql$
                insert into public.candles (
                    exchange_id,
                    instrument_id,
                    timeframe,
                    open_time,
                    requested_symbol,
                    provider_symbol,
                    exchange,
                    currency,
                    open_price,
                    high_price,
                    low_price,
                    close_price,
                    volume,
                    provider,
                    source_range,
                    is_final,
                    fetched_at
                )
                select
                    coalesce(nullif(exchange, ''), 'UNKNOWN') as exchange_id,
                    requested_symbol as instrument_id,
                    interval as timeframe,
                    candle_time as open_time,
                    requested_symbol,
                    provider_symbol,
                    exchange,
                    currency,
                    open_price,
                    high_price,
                    low_price,
                    close_price,
                    volume,
                    provider,
                    source_range,
                    is_final,
                    fetched_at
                from public.%I
                on conflict (exchange_id, instrument_id, timeframe, open_time)
                do update set
                    provider_symbol = excluded.provider_symbol,
                    exchange = excluded.exchange,
                    currency = excluded.currency,
                    open_price = excluded.open_price,
                    high_price = excluded.high_price,
                    low_price = excluded.low_price,
                    close_price = excluded.close_price,
                    volume = excluded.volume,
                    provider = excluded.provider,
                    source_range = excluded.source_range,
                    is_final = excluded.is_final,
                    fetched_at = excluded.fetched_at
                $sql$,
                legacy_table
            );
        end if;
    end loop;
end;
$$;

-- Recovery path for reruns: if DEFAULT already has rows, create missing monthly partitions
-- for that range and re-route rows back through parent table.
do $$
declare
    default_min timestamptz;
    default_max timestamptz;
begin
    if to_regclass('public.candles_default') is null then
        return;
    end if;

    select min(open_time), max(open_time)
    into default_min, default_max
    from public.candles_default;

    if default_min is null then
        return;
    end if;

    perform public.create_monthly_candle_partitions_between(default_min, default_max);

    with moved_rows as (
        delete from public.candles_default
        returning
            exchange_id,
            instrument_id,
            timeframe,
            open_time,
            requested_symbol,
            provider_symbol,
            exchange,
            currency,
            open_price,
            high_price,
            low_price,
            close_price,
            volume,
            provider,
            source_range,
            is_final,
            fetched_at
    )
    insert into public.candles (
        exchange_id,
        instrument_id,
        timeframe,
        open_time,
        requested_symbol,
        provider_symbol,
        exchange,
        currency,
        open_price,
        high_price,
        low_price,
        close_price,
        volume,
        provider,
        source_range,
        is_final,
        fetched_at
    )
    select
        exchange_id,
        instrument_id,
        timeframe,
        open_time,
        requested_symbol,
        provider_symbol,
        exchange,
        currency,
        open_price,
        high_price,
        low_price,
        close_price,
        volume,
        provider,
        source_range,
        is_final,
        fetched_at
    from moved_rows
    on conflict (exchange_id, instrument_id, timeframe, open_time)
    do update set
        provider_symbol = excluded.provider_symbol,
        exchange = excluded.exchange,
        currency = excluded.currency,
        open_price = excluded.open_price,
        high_price = excluded.high_price,
        low_price = excluded.low_price,
        close_price = excluded.close_price,
        volume = excluded.volume,
        provider = excluded.provider,
        source_range = excluded.source_range,
        is_final = excluded.is_final,
        fetched_at = excluded.fetched_at;
end;
$$;

drop table if exists public.candles_1m cascade;
drop table if exists public.candles_5m cascade;
drop table if exists public.candles_15m cascade;
drop table if exists public.candles_1h cascade;
drop table if exists public.candles_1d cascade;
drop table if exists public.candles_1wk cascade;
drop table if exists public.candles_1mo cascade;
drop table if exists public.candles_1y cascade;

select cron.unschedule(jobid)
from cron.job
where jobname = 'create-future-candle-partitions';

select cron.schedule(
  'create-future-candle-partitions',
  '5 0 * * *',
  $$ select public.create_monthly_candle_partitions(6); $$
);

-- Configure these per environment before enabling the backfill scheduler:
-- alter database postgres set "app.settings.market_backend_url" = 'https://your-backend.example.com';
-- alter database postgres set "app.settings.market_cron_secret" = 'your-cron-secret';

create or replace function public.trigger_market_base_candles_backfill()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    backend_url text := nullif(current_setting('app.settings.market_backend_url', true), '');
    cron_secret text := nullif(current_setting('app.settings.market_cron_secret', true), '');
    request_headers jsonb := jsonb_build_object('Content-Type', 'application/json');
begin
    if backend_url is null then
        raise notice 'market backfill cron skipped: app.settings.market_backend_url is not configured';
        return;
    end if;

    if cron_secret is not null then
        request_headers := request_headers || jsonb_build_object('Authorization', 'Bearer ' || cron_secret);
    end if;

    perform net.http_post(
        url := rtrim(backend_url, '/') || '/api/market/backfill/base-candles',
        headers := request_headers,
        body := '{}'::jsonb
    );
end;
$$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'market-base-candles-backfill-5min';

select cron.schedule(
    'market-base-candles-backfill-5min',
    '*/5 * * * *',
    $$ select public.trigger_market_base_candles_backfill(); $$
);

-- Post-migration verification.
select timeframe, count(*) as total_rows
from public.candles
group by timeframe
order by timeframe;

select tablename
from pg_tables
where schemaname = 'public'
  and tablename like 'candles_20__%'
order by tablename;

select jobid, jobname, schedule, command
from cron.job
where jobname = 'create-future-candle-partitions';

select count(*) as rows_in_default_partition
from public.candles_default;

select
    min(open_time) as min_open_time,
    max(open_time) as max_open_time,
    count(*) as total_rows
from public.candles_default;

select
    date_trunc('month', open_time) as month,
    timeframe,
    count(*) as total_rows
from public.candles_default
group by 1, 2
order by 1, 2;

create table if not exists public.auth_refresh_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles (user_id) on delete cascade,
    family_id uuid not null,
    token_hash text not null unique,
    csrf_token_hash text not null,
    user_agent text not null default '',
    ip_address text not null default '',
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    last_used_at timestamptz not null default timezone('utc', now()),
    expires_at timestamptz not null,
    revoked_at timestamptz,
    revoked_reason text,
    replaced_by_session_id uuid references public.auth_refresh_sessions (id) on delete set null
);

create index if not exists auth_refresh_sessions_user_idx
    on public.auth_refresh_sessions (user_id, created_at desc);

create index if not exists auth_refresh_sessions_family_idx
    on public.auth_refresh_sessions (family_id, created_at desc);

create index if not exists auth_refresh_sessions_active_idx
    on public.auth_refresh_sessions (user_id, revoked_at, expires_at);

create index if not exists positions_room_user_idx
    on public.positions (room_id, user_id, open_date desc);

create index if not exists transactions_room_user_idx
    on public.transactions (room_id, user_id, date desc);


create table if not exists public.rooms (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    access_code text not null unique,
    description text default '',
    state text not null default 'active' check (state in ('active', 'closed', 'archived')),
    start_date date,
    end_date date,
    default_currency text not null default 'USD',
    default_balance numeric(14, 2) not null default 100000,
    created_by uuid not null references public.profiles (user_id) on delete cascade,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists rooms_created_by_idx
    on public.rooms (created_by, created_at desc);

create table if not exists public.room_members (
    id uuid primary key default gen_random_uuid(),
    room_id uuid not null references public.rooms (id) on delete cascade,
    user_id uuid not null references public.profiles (user_id) on delete cascade,
    role_in_room text not null check (role_in_room in ('teacher', 'student', 'monitor')),
    state text not null default 'active' check (state in ('active', 'pending', 'removed')),
    joined_at timestamptz not null default timezone('utc', now()),
    unique (room_id, user_id)
);

create index if not exists room_members_user_idx
    on public.room_members (user_id, joined_at desc);

drop table if exists public.student_sim_accounts cascade;

create table if not exists public.balance_adjustments (
    id uuid primary key default gen_random_uuid(),
    room_id uuid not null references public.rooms (id) on delete cascade,
    user_id uuid not null references public.profiles (user_id) on delete cascade,
    teacher_id uuid not null references public.profiles (user_id) on delete cascade,
    adjustment_type text not null check (adjustment_type in ('top_up', 'reset', 'discount', 'correction')),
    previous_balance numeric(14, 2) not null,
    adjustment_amount numeric(14, 2) not null,
    new_balance numeric(14, 2) not null,
    reason text not null default '',
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists balance_adjustments_room_user_idx
    on public.balance_adjustments (room_id, user_id, created_at desc);

create table if not exists public.activities (
    id uuid primary key default gen_random_uuid(),
    room_id uuid not null references public.rooms (id) on delete cascade,
    created_by uuid not null references public.profiles (user_id) on delete cascade,
    title text not null,
    description text default '',
    activity_type text not null check (activity_type in ('forum', 'report', 'asset_analysis', 'open_task', 'graded_discussion', 'free_post')),
    state text not null default 'draft' check (state in ('draft', 'published', 'closed', 'archived')),
    is_gradable boolean not null default false,
    max_score numeric(10, 2),
    open_at timestamptz,
    close_at timestamptz,
    allow_files boolean not null default true,
    allow_comments boolean not null default true,
    allow_replies boolean not null default true,
    referenced_asset_symbol text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists activities_room_idx
    on public.activities (room_id, created_at desc);

create table if not exists public.activity_posts (
    id uuid primary key default gen_random_uuid(),
    activity_id uuid not null references public.activities (id) on delete cascade,
    user_id uuid not null references public.profiles (user_id) on delete cascade,
    parent_post_id uuid references public.activity_posts (id) on delete cascade,
    content text not null,
    file_url text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.activity_submissions (
    id uuid primary key default gen_random_uuid(),
    activity_id uuid not null references public.activities (id) on delete cascade,
    user_id uuid not null references public.profiles (user_id) on delete cascade,
    content_text text default '',
    file_url text,
    state text not null default 'draft' check (state in ('draft', 'submitted', 'reviewed', 'graded')),
    submitted_at timestamptz,
    updated_at timestamptz not null default timezone('utc', now()),
    unique (activity_id, user_id)
);

create table if not exists public.activity_grades (
    id uuid primary key default gen_random_uuid(),
    activity_id uuid not null references public.activities (id) on delete cascade,
    user_id uuid not null references public.profiles (user_id) on delete cascade,
    graded_by uuid not null references public.profiles (user_id) on delete cascade,
    score numeric(10, 2) not null,
    feedback text default '',
    graded_at timestamptz not null default timezone('utc', now()),
    unique (activity_id, user_id)
);

create table if not exists public.chart_drawings (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles (user_id) on delete cascade,
    symbol text not null,
    timeframe text not null,
    objects jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    unique (user_id, symbol, timeframe)
);

create index if not exists chart_drawings_user_symbol_timeframe_idx
    on public.chart_drawings (user_id, symbol, timeframe);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

create or replace function public.set_auth_refresh_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.handle_updated_at();

drop trigger if exists positions_set_updated_at on public.positions;
create trigger positions_set_updated_at
before update on public.positions
for each row
execute function public.handle_updated_at();

drop trigger if exists rooms_set_updated_at on public.rooms;
create trigger rooms_set_updated_at
before update on public.rooms
for each row
execute function public.handle_updated_at();

drop trigger if exists activities_set_updated_at on public.activities;
create trigger activities_set_updated_at
before update on public.activities
for each row
execute function public.handle_updated_at();

drop trigger if exists activity_posts_set_updated_at on public.activity_posts;
create trigger activity_posts_set_updated_at
before update on public.activity_posts
for each row
execute function public.handle_updated_at();

drop trigger if exists activity_submissions_set_updated_at on public.activity_submissions;
create trigger activity_submissions_set_updated_at
before update on public.activity_submissions
for each row
execute function public.handle_updated_at();

drop trigger if exists chart_drawings_set_updated_at on public.chart_drawings;
create trigger chart_drawings_set_updated_at
before update on public.chart_drawings
for each row
execute function public.handle_updated_at();

drop trigger if exists auth_refresh_sessions_set_updated_at on public.auth_refresh_sessions;
create trigger auth_refresh_sessions_set_updated_at
before update on public.auth_refresh_sessions
for each row
execute function public.set_auth_refresh_sessions_updated_at();

create or replace function public.generate_room_code()
returns text
language plpgsql
as $$
declare
    generated text;
begin
    loop
        generated := upper(substring(encode(gen_random_bytes(4), 'hex') from 1 for 6));
        exit when not exists (
            select 1
            from public.rooms
            where access_code = generated
        );
    end loop;

    return generated;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (
        user_id,
        email,
        name,
        role,
        balance,
        initial_balance
    )
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data ->> 'name', ''),
        coalesce(new.raw_user_meta_data ->> 'role', 'student'),
        coalesce((new.raw_user_meta_data ->> 'balance')::numeric, 10000),
        coalesce((new.raw_user_meta_data ->> 'initialBalance')::numeric, 10000)
    )
    on conflict (user_id) do update
    set
        email = excluded.email,
        name = coalesce(excluded.name, public.profiles.name),
        role = excluded.role,
        balance = excluded.balance,
        initial_balance = excluded.initial_balance,
        updated_at = timezone('utc', now());

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.positions enable row level security;
alter table public.transactions enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.balance_adjustments enable row level security;
alter table public.activities enable row level security;
alter table public.activity_posts enable row level security;
alter table public.activity_submissions enable row level security;
alter table public.activity_grades enable row level security;
alter table public.chart_drawings enable row level security;
alter table public.auth_refresh_sessions disable row level security;

drop policy if exists "profiles_select_accessible" on public.profiles;
create policy "profiles_select_accessible"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "positions_select_accessible" on public.positions;
create policy "positions_select_accessible"
on public.positions
for select
to authenticated
using (
    auth.uid() = user_id
    or exists (
        select 1
        from public.room_members
        where room_members.room_id = public.positions.room_id
          and room_members.user_id = auth.uid()
          and room_members.role_in_room in ('teacher', 'monitor')
          and room_members.state = 'active'
    )
);

drop policy if exists "positions_modify_own" on public.positions;
create policy "positions_modify_own"
on public.positions
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "transactions_select_accessible" on public.transactions;
create policy "transactions_select_accessible"
on public.transactions
for select
to authenticated
using (
    auth.uid() = user_id
    or exists (
        select 1
        from public.room_members
        where room_members.room_id = public.transactions.room_id
          and room_members.user_id = auth.uid()
          and room_members.role_in_room in ('teacher', 'monitor')
          and room_members.state = 'active'
    )
);

drop policy if exists "transactions_modify_own" on public.transactions;
create policy "transactions_modify_own"
on public.transactions
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.is_active_room_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = p_user_id
      and rm.state = 'active'
  );
$$;

create or replace function public.is_active_room_staff(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    exists (
      select 1
      from public.rooms r
      where r.id = p_room_id
        and r.created_by = p_user_id
    )
    or exists (
      select 1
      from public.room_members rm
      where rm.room_id = p_room_id
        and rm.user_id = p_user_id
        and rm.role_in_room in ('teacher', 'monitor')
        and rm.state = 'active'
    );
$$;

drop policy if exists "rooms_select_accessible" on public.rooms;
create policy "rooms_select_accessible"
on public.rooms
for select
to authenticated
using (
    auth.uid() = created_by
    or public.is_active_room_member(public.rooms.id, auth.uid())
);

drop policy if exists "rooms_insert_own" on public.rooms;
create policy "rooms_insert_own"
on public.rooms
for insert
to authenticated
with check (auth.uid() = created_by);

drop policy if exists "rooms_update_teacher" on public.rooms;
create policy "rooms_update_teacher"
on public.rooms
for update
to authenticated
using (
    auth.uid() = created_by
    or public.is_active_room_staff(public.rooms.id, auth.uid())
)
with check (
    auth.uid() = created_by
    or public.is_active_room_staff(public.rooms.id, auth.uid())
);

drop policy if exists "room_members_select_accessible" on public.room_members;
create policy "room_members_select_accessible"
on public.room_members
for select
to authenticated
using (
    auth.uid() = user_id
    or public.is_active_room_staff(public.room_members.room_id, auth.uid())
);

drop policy if exists "room_members_insert_self_or_teacher" on public.room_members;
create policy "room_members_insert_self_or_teacher"
on public.room_members
for insert
to authenticated
with check (
    auth.uid() = user_id
    or exists (
        select 1
        from public.rooms
        where rooms.id = room_id
          and rooms.created_by = auth.uid()
    )
);

drop policy if exists "room_members_update_teacher" on public.room_members;
create policy "room_members_update_teacher"
on public.room_members
for update
to authenticated
using (
    public.is_active_room_staff(public.room_members.room_id, auth.uid())
)
with check (
    public.is_active_room_staff(public.room_members.room_id, auth.uid())
);

drop policy if exists "room_members_update_self_active" on public.room_members;
create policy "room_members_update_self_active"
on public.room_members
for update
to authenticated
using (
    auth.uid() = public.room_members.user_id
    and public.room_members.role_in_room = 'student'
    and public.is_active_room_member(public.room_members.room_id, auth.uid())
)
with check (
    auth.uid() = public.room_members.user_id
    and public.room_members.role_in_room = 'student'
    and public.room_members.state = 'active'
    and public.is_active_room_member(public.room_members.room_id, auth.uid())
);

drop policy if exists "balance_adjustments_select_accessible" on public.balance_adjustments;
create policy "balance_adjustments_select_accessible"
on public.balance_adjustments
for select
to authenticated
using (
    auth.uid() = user_id
    or auth.uid() = teacher_id
    or exists (
        select 1
        from public.room_members
        where room_members.room_id = public.balance_adjustments.room_id
          and room_members.user_id = auth.uid()
          and room_members.role_in_room in ('teacher', 'monitor')
          and room_members.state = 'active'
    )
);

drop policy if exists "balance_adjustments_insert_teacher" on public.balance_adjustments;
create policy "balance_adjustments_insert_teacher"
on public.balance_adjustments
for insert
to authenticated
with check (
    auth.uid() = teacher_id
    and exists (
        select 1
        from public.room_members
        where room_members.room_id = public.balance_adjustments.room_id
          and room_members.user_id = auth.uid()
          and room_members.role_in_room in ('teacher', 'monitor')
          and room_members.state = 'active'
    )
);

drop policy if exists "activities_select_room_members" on public.activities;
create policy "activities_select_room_members"
on public.activities
for select
to authenticated
using (
    exists (
        select 1
        from public.room_members
        where room_members.room_id = public.activities.room_id
          and room_members.user_id = auth.uid()
          and room_members.state = 'active'
    )
);

drop policy if exists "activities_insert_teacher" on public.activities;
create policy "activities_insert_teacher"
on public.activities
for insert
to authenticated
with check (
    auth.uid() = created_by
    and exists (
        select 1
        from public.room_members
        where room_members.room_id = public.activities.room_id
          and room_members.user_id = auth.uid()
          and room_members.role_in_room in ('teacher', 'monitor')
          and room_members.state = 'active'
    )
);

drop policy if exists "activities_update_teacher" on public.activities;
create policy "activities_update_teacher"
on public.activities
for update
to authenticated
using (
    exists (
        select 1
        from public.room_members
        where room_members.room_id = public.activities.room_id
          and room_members.user_id = auth.uid()
          and room_members.role_in_room in ('teacher', 'monitor')
          and room_members.state = 'active'
    )
)
with check (
    exists (
        select 1
        from public.room_members
        where room_members.room_id = public.activities.room_id
          and room_members.user_id = auth.uid()
          and room_members.role_in_room in ('teacher', 'monitor')
          and room_members.state = 'active'
    )
);

drop policy if exists "activity_posts_select_room_members" on public.activity_posts;
create policy "activity_posts_select_room_members"
on public.activity_posts
for select
to authenticated
using (
    exists (
        select 1
        from public.activities
        join public.room_members on room_members.room_id = activities.room_id
        where activities.id = public.activity_posts.activity_id
          and room_members.user_id = auth.uid()
          and room_members.state = 'active'
    )
);

drop policy if exists "activity_posts_insert_room_members" on public.activity_posts;
create policy "activity_posts_insert_room_members"
on public.activity_posts
for insert
to authenticated
with check (
    auth.uid() = user_id
    and exists (
        select 1
        from public.activities
        join public.room_members on room_members.room_id = activities.room_id
        where activities.id = public.activity_posts.activity_id
          and room_members.user_id = auth.uid()
          and room_members.state = 'active'
    )
);

drop policy if exists "activity_submissions_select_accessible" on public.activity_submissions;
create policy "activity_submissions_select_accessible"
on public.activity_submissions
for select
to authenticated
using (
    auth.uid() = user_id
    or exists (
        select 1
        from public.activities
        join public.room_members on room_members.room_id = activities.room_id
        where activities.id = public.activity_submissions.activity_id
          and room_members.user_id = auth.uid()
          and room_members.role_in_room in ('teacher', 'monitor')
          and room_members.state = 'active'
    )
);

drop policy if exists "activity_submissions_insert_self" on public.activity_submissions;
create policy "activity_submissions_insert_self"
on public.activity_submissions
for insert
to authenticated
with check (
    auth.uid() = user_id
    and exists (
        select 1
        from public.activities
        join public.room_members on room_members.room_id = activities.room_id
        where activities.id = public.activity_submissions.activity_id
          and room_members.user_id = auth.uid()
          and room_members.state = 'active'
    )
);

drop policy if exists "activity_submissions_update_accessible" on public.activity_submissions;
create policy "activity_submissions_update_accessible"
on public.activity_submissions
for update
to authenticated
using (
    auth.uid() = user_id
    or exists (
        select 1
        from public.activities
        join public.room_members on room_members.room_id = activities.room_id
        where activities.id = public.activity_submissions.activity_id
          and room_members.user_id = auth.uid()
          and room_members.role_in_room in ('teacher', 'monitor')
          and room_members.state = 'active'
    )
)
with check (
    auth.uid() = user_id
    or exists (
        select 1
        from public.activities
        join public.room_members on room_members.room_id = activities.room_id
        where activities.id = public.activity_submissions.activity_id
          and room_members.user_id = auth.uid()
          and room_members.role_in_room in ('teacher', 'monitor')
          and room_members.state = 'active'
    )
);

drop policy if exists "activity_grades_select_accessible" on public.activity_grades;
create policy "activity_grades_select_accessible"
on public.activity_grades
for select
to authenticated
using (
    auth.uid() = user_id
    or auth.uid() = graded_by
    or exists (
        select 1
        from public.activities
        join public.room_members on room_members.room_id = activities.room_id
        where activities.id = public.activity_grades.activity_id
          and room_members.user_id = auth.uid()
          and room_members.role_in_room in ('teacher', 'monitor')
          and room_members.state = 'active'
    )
);

drop policy if exists "activity_grades_insert_teacher" on public.activity_grades;
create policy "activity_grades_insert_teacher"
on public.activity_grades
for insert
to authenticated
with check (
    auth.uid() = graded_by
    and exists (
        select 1
        from public.activities
        join public.room_members on room_members.room_id = activities.room_id
        where activities.id = public.activity_grades.activity_id
          and room_members.user_id = auth.uid()
          and room_members.role_in_room in ('teacher', 'monitor')
          and room_members.state = 'active'
    )
);


drop policy if exists "chart_drawings_select_own" on public.chart_drawings;
drop policy if exists "chart_drawings_insert_own" on public.chart_drawings;
drop policy if exists "chart_drawings_update_own" on public.chart_drawings;
drop policy if exists "chart_drawings_delete_own" on public.chart_drawings;

create policy "chart_drawings_select_own"
on public.chart_drawings
for select
to authenticated
using (auth.uid() = user_id);

create policy "chart_drawings_insert_own"
on public.chart_drawings
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "chart_drawings_update_own"
on public.chart_drawings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "chart_drawings_delete_own"
on public.chart_drawings
for delete
to authenticated
using (auth.uid() = user_id);
















-- ---------------------------------------------------------------------------

-- Room groups extension
-- ---------------------------------------------------------------------------
-- Room groups architecture for GTL
-- Run this script in Supabase SQL editor after base schema.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER)
-- ---------------------------------------------------------------------------

create or replace function public.is_active_room_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = p_user_id
      and rm.state = 'active'
  );
$$;

create or replace function public.is_active_room_staff(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    exists (
      select 1
      from public.rooms r
      where r.id = p_room_id
        and r.created_by = p_user_id
    )
    or exists (
      select 1
      from public.room_members rm
      where rm.room_id = p_room_id
        and rm.user_id = p_user_id
        and rm.role_in_room in ('teacher', 'monitor')
        and rm.state = 'active'
    );
$$;

-- ---------------------------------------------------------------------------
-- Groups
-- ---------------------------------------------------------------------------

create table if not exists public.room_groups (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  name text not null,
  description text default '',
  max_members integer check (max_members is null or max_members > 0),
  state text not null default 'active' check (state in ('active', 'archived', 'deleted')),
  created_by uuid not null references public.profiles (user_id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists room_groups_room_idx
  on public.room_groups (room_id, created_at desc);

create index if not exists room_groups_state_idx
  on public.room_groups (room_id, state, updated_at desc);

create table if not exists public.room_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.room_groups (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'member')),
  joined_at timestamptz not null default timezone('utc', now()),
  state text not null default 'active' check (state in ('active', 'removed')),
  unique (group_id, user_id)
);

create unique index if not exists room_group_members_unique_active_user_per_room
  on public.room_group_members (room_id, user_id)
  where state = 'active';

create unique index if not exists room_group_members_unique_active_user_per_group
  on public.room_group_members (group_id, user_id)
  where state = 'active';

create index if not exists room_group_members_group_idx
  on public.room_group_members (group_id, state, joined_at desc);

create or replace function public.is_active_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  membership_exists boolean := false;
begin
  if to_regclass('public.room_group_members') is null then
    return false;
  end if;

  execute
    'select exists (
      select 1
      from public.room_group_members rgm
      where rgm.group_id = $1
        and rgm.user_id = $2
        and rgm.state = ''active''
    )'
  into membership_exists
  using p_group_id, p_user_id;

  return coalesce(membership_exists, false);
end;
$$;

create or replace function public.can_access_room_groups(p_room_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  active_room_member boolean := false;
  active_group_member boolean := false;
begin
  active_room_member := coalesce(public.is_active_room_member(p_room_id, p_user_id), false);

  if active_room_member then
    return true;
  end if;

  if to_regclass('public.room_group_members') is null then
    return false;
  end if;

  execute
    'select exists (
      select 1
      from public.room_group_members rgm
      where rgm.room_id = $1
        and rgm.user_id = $2
        and rgm.state = ''active''
    )'
  into active_group_member
  using p_room_id, p_user_id;

  return coalesce(active_group_member, false);
end;
$$;

create or replace function public.can_manage_room_groups(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.is_active_room_staff(p_room_id, p_user_id), false);
$$;

-- ---------------------------------------------------------------------------
-- Activity model extensions
-- ---------------------------------------------------------------------------

alter table public.activities
  add column if not exists submission_mode text not null default 'individual'
    check (submission_mode in ('individual', 'group')),
  add column if not exists group_mode text not null default 'none'
    check (group_mode in ('none', 'separate_groups', 'visible_groups')),
  add column if not exists max_group_members integer
    check (max_group_members is null or max_group_members > 0),
  add column if not exists allow_self_enrollment boolean not null default false,
  add column if not exists portfolio_mode text not null default 'individual'
    check (portfolio_mode in ('individual', 'group'));

alter table public.activity_submissions
  add column if not exists room_id uuid references public.rooms (id) on delete cascade,
  add column if not exists group_id uuid references public.room_groups (id) on delete set null,
  add column if not exists submitted_by uuid references public.profiles (user_id) on delete set null;

update public.activity_submissions s
set room_id = a.room_id
from public.activities a
where a.id = s.activity_id
  and s.room_id is null;

alter table public.activity_submissions
  alter column room_id set not null;

update public.activity_submissions
set submitted_by = user_id
where submitted_by is null;

alter table public.activity_submissions
  alter column submitted_by set not null;

alter table public.activity_submissions
  alter column user_id drop not null;

alter table public.activity_submissions
  drop constraint if exists activity_submissions_activity_id_user_id_key;

create unique index if not exists activity_submissions_unique_user_target
  on public.activity_submissions (activity_id, user_id)
  where user_id is not null;

create unique index if not exists activity_submissions_unique_group_target
  on public.activity_submissions (activity_id, group_id)
  where group_id is not null;

alter table public.activity_submissions
  drop constraint if exists activity_submissions_target_check;

alter table public.activity_submissions
  add constraint activity_submissions_target_check
  check (
    (user_id is not null and group_id is null)
    or (user_id is null and group_id is not null)
  );

-- Group grades support (without breaking existing user grades)
alter table public.activity_grades
  add column if not exists group_id uuid references public.room_groups (id) on delete set null;

alter table public.activity_grades
  alter column user_id drop not null;

alter table public.activity_grades
  drop constraint if exists activity_grades_activity_id_user_id_key;

create unique index if not exists activity_grades_unique_user_target
  on public.activity_grades (activity_id, user_id)
  where user_id is not null;

create unique index if not exists activity_grades_unique_group_target
  on public.activity_grades (activity_id, group_id)
  where group_id is not null;

alter table public.activity_grades
  drop constraint if exists activity_grades_target_check;

alter table public.activity_grades
  add constraint activity_grades_target_check
  check (
    (user_id is not null and group_id is null)
    or (user_id is null and group_id is not null)
  );

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists room_groups_set_updated_at on public.room_groups;
create trigger room_groups_set_updated_at
before update on public.room_groups
for each row
execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- RLS for room_groups
-- ---------------------------------------------------------------------------

alter table public.room_groups enable row level security;
alter table public.room_group_members enable row level security;

drop policy if exists "room_groups_select_accessible" on public.room_groups;
create policy "room_groups_select_accessible"
on public.room_groups
for select
to authenticated
using (public.can_access_room_groups(public.room_groups.room_id, auth.uid()));

drop policy if exists "room_groups_insert_teacher" on public.room_groups;
create policy "room_groups_insert_teacher"
on public.room_groups
for insert
to authenticated
with check (
  auth.uid() = created_by
  and public.can_manage_room_groups(public.room_groups.room_id, auth.uid())
);

drop policy if exists "room_groups_update_teacher" on public.room_groups;
create policy "room_groups_update_teacher"
on public.room_groups
for update
to authenticated
using (public.can_manage_room_groups(public.room_groups.room_id, auth.uid()))
with check (public.can_manage_room_groups(public.room_groups.room_id, auth.uid()));

drop policy if exists "room_groups_delete_teacher" on public.room_groups;
create policy "room_groups_delete_teacher"
on public.room_groups
for delete
to authenticated
using (public.can_manage_room_groups(public.room_groups.room_id, auth.uid()));

drop policy if exists "room_group_members_select_accessible" on public.room_group_members;
create policy "room_group_members_select_accessible"
on public.room_group_members
for select
to authenticated
using (
  auth.uid() = public.room_group_members.user_id
  or public.can_access_room_groups(public.room_group_members.room_id, auth.uid())
);

drop policy if exists "room_group_members_insert_teacher" on public.room_group_members;
create policy "room_group_members_insert_teacher"
on public.room_group_members
for insert
to authenticated
with check (
  public.can_manage_room_groups(public.room_group_members.room_id, auth.uid())
);

drop policy if exists "room_group_members_update_teacher" on public.room_group_members;
create policy "room_group_members_update_teacher"
on public.room_group_members
for update
to authenticated
using (public.can_manage_room_groups(public.room_group_members.room_id, auth.uid()))
with check (public.can_manage_room_groups(public.room_group_members.room_id, auth.uid()));

drop policy if exists "room_group_members_delete_teacher" on public.room_group_members;
create policy "room_group_members_delete_teacher"
on public.room_group_members
for delete
to authenticated
using (public.can_manage_room_groups(public.room_group_members.room_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- Update activity / grade / submission policies to support groups
-- ---------------------------------------------------------------------------

drop policy if exists "activities_select_room_members" on public.activities;
create policy "activities_select_room_members"
on public.activities
for select
to authenticated
using (public.is_active_room_member(public.activities.room_id, auth.uid()));

drop policy if exists "activities_insert_teacher" on public.activities;
create policy "activities_insert_teacher"
on public.activities
for insert
to authenticated
with check (
  auth.uid() = created_by
  and public.is_active_room_staff(public.activities.room_id, auth.uid())
);

drop policy if exists "activities_update_teacher" on public.activities;
create policy "activities_update_teacher"
on public.activities
for update
to authenticated
using (public.is_active_room_staff(public.activities.room_id, auth.uid()))
with check (public.is_active_room_staff(public.activities.room_id, auth.uid()));

drop policy if exists "activity_submissions_select_accessible" on public.activity_submissions;
create policy "activity_submissions_select_accessible"
on public.activity_submissions
for select
to authenticated
using (
  auth.uid() = submitted_by
  or auth.uid() = user_id
  or (group_id is not null and public.is_active_group_member(group_id, auth.uid()))
  or public.is_active_room_staff(public.activity_submissions.room_id, auth.uid())
);

drop policy if exists "activity_submissions_insert_self" on public.activity_submissions;
create policy "activity_submissions_insert_self"
on public.activity_submissions
for insert
to authenticated
with check (
  auth.uid() = submitted_by
  and public.is_active_room_member(public.activity_submissions.room_id, auth.uid())
  and (
    (user_id is not null and user_id = auth.uid() and group_id is null)
    or (
      user_id is null
      and group_id is not null
      and (
        public.is_active_group_member(group_id, auth.uid())
        or public.is_active_room_staff(public.activity_submissions.room_id, auth.uid())
      )
    )
  )
);

drop policy if exists "activity_submissions_update_accessible" on public.activity_submissions;
create policy "activity_submissions_update_accessible"
on public.activity_submissions
for update
to authenticated
using (
  auth.uid() = submitted_by
  or auth.uid() = user_id
  or public.is_active_room_staff(public.activity_submissions.room_id, auth.uid())
)
with check (
  auth.uid() = submitted_by
  or auth.uid() = user_id
  or public.is_active_room_staff(public.activity_submissions.room_id, auth.uid())
);

drop policy if exists "activity_grades_select_accessible" on public.activity_grades;
create policy "activity_grades_select_accessible"
on public.activity_grades
for select
to authenticated
using (
  auth.uid() = user_id
  or auth.uid() = graded_by
  or (group_id is not null and public.is_active_group_member(group_id, auth.uid()))
  or exists (
    select 1
    from public.activities a
    where a.id = public.activity_grades.activity_id
      and public.is_active_room_staff(a.room_id, auth.uid())
  )
);

drop policy if exists "activity_grades_insert_teacher" on public.activity_grades;
create policy "activity_grades_insert_teacher"
on public.activity_grades
for insert
to authenticated
with check (
  auth.uid() = graded_by
  and exists (
    select 1
    from public.activities a
    where a.id = public.activity_grades.activity_id
      and public.is_active_room_staff(a.room_id, auth.uid())
  )
);

set check_function_bodies = on;




-- ---------------------------------------------------------------------------
-- Room balances managed directly in room members/groups
-- Source: docs/sql/room-balances-room-members-and-groups.sql
-- ---------------------------------------------------------------------------

-- Migration: enforce trading balances on room_members (individual)
-- and room_group_members (shared group).
--
-- Run this before removing legacy read/write paths and after ensuring
-- room_groups/room_group_members tables already exist.

begin;

-- ---------------------------------------------------------------------------
-- 1) Individual portfolio fields per room member
-- ---------------------------------------------------------------------------
alter table public.room_members
  add column if not exists individual_available_balance numeric(14, 2) default 0,
  add column if not exists individual_blocked_balance numeric(14, 2) default 0,
  add column if not exists individual_total_balance numeric(14, 2) default 0,
  add column if not exists individual_currency text default 'USD',
  add column if not exists individual_realized_pnl numeric(14, 2) default 0,
  add column if not exists individual_unrealized_pnl numeric(14, 2) default 0,
  add column if not exists individual_equity numeric(14, 2) default 0;

create index if not exists room_members_room_student_state_idx
  on public.room_members (room_id, role_in_room, state);

-- Backfill from room defaults when member balances are empty.
update public.room_members rm
set
  individual_available_balance = coalesce(
    rm.individual_available_balance,
    r.default_balance,
    0
  ),
  individual_blocked_balance = coalesce(
    rm.individual_blocked_balance,
    0
  ),
  individual_total_balance = coalesce(
    rm.individual_total_balance,
    coalesce(rm.individual_available_balance, r.default_balance, 0) + coalesce(rm.individual_blocked_balance, 0)
  ),
  individual_currency = coalesce(
    nullif(rm.individual_currency, ''),
    r.default_currency,
    'USD'
  ),
  individual_realized_pnl = coalesce(rm.individual_realized_pnl, 0),
  individual_unrealized_pnl = coalesce(rm.individual_unrealized_pnl, 0),
  individual_equity = coalesce(
    rm.individual_equity,
    coalesce(
      rm.individual_total_balance,
      coalesce(rm.individual_available_balance, r.default_balance, 0) + coalesce(rm.individual_blocked_balance, 0)
    )
  )
from public.rooms r
where rm.room_id = r.id
  and rm.role_in_room = 'student';

-- ---------------------------------------------------------------------------
-- 2) Shared portfolio fields per active group membership
-- ---------------------------------------------------------------------------
alter table public.room_group_members
  add column if not exists group_available_balance numeric(14, 2) default 0,
  add column if not exists group_blocked_balance numeric(14, 2) default 0,
  add column if not exists group_total_balance numeric(14, 2) default 0,
  add column if not exists group_currency text default 'USD',
  add column if not exists group_realized_pnl numeric(14, 2) default 0,
  add column if not exists group_unrealized_pnl numeric(14, 2) default 0,
  add column if not exists group_equity numeric(14, 2) default 0;

create index if not exists room_group_members_room_group_state_idx
  on public.room_group_members (room_id, group_id, state);

-- For active groups, initialize shared balances as aggregation of active members'
-- individual balances.
with group_aggregates as (
  select
    rgm.room_id,
    rgm.group_id,
    sum(coalesce(rm.individual_available_balance, 0)) as available_balance,
    sum(coalesce(rm.individual_blocked_balance, 0)) as blocked_balance,
    sum(coalesce(rm.individual_total_balance, 0)) as total_balance,
    sum(coalesce(rm.individual_realized_pnl, 0)) as realized_pnl,
    sum(coalesce(rm.individual_unrealized_pnl, 0)) as unrealized_pnl,
    sum(coalesce(rm.individual_equity, coalesce(rm.individual_total_balance, 0))) as equity,
    min(coalesce(nullif(rm.individual_currency, ''), r.default_currency, 'USD')) as currency
  from public.room_group_members rgm
  join public.room_groups rg
    on rg.id = rgm.group_id
  left join public.room_members rm
    on rm.room_id = rgm.room_id
   and rm.user_id = rgm.user_id
   and rm.state = 'active'
  left join public.rooms r
    on r.id = rgm.room_id
  where rgm.state = 'active'
    and rg.state = 'active'
  group by rgm.room_id, rgm.group_id
)
update public.room_group_members rgm
set
  group_available_balance = coalesce(rgm.group_available_balance, ga.available_balance, 0),
  group_blocked_balance = coalesce(rgm.group_blocked_balance, ga.blocked_balance, 0),
  group_total_balance = coalesce(rgm.group_total_balance, ga.total_balance, 0),
  group_currency = coalesce(nullif(rgm.group_currency, ''), ga.currency, 'USD'),
  group_realized_pnl = coalesce(rgm.group_realized_pnl, ga.realized_pnl, 0),
  group_unrealized_pnl = coalesce(rgm.group_unrealized_pnl, ga.unrealized_pnl, 0),
  group_equity = coalesce(rgm.group_equity, ga.equity, coalesce(rgm.group_total_balance, ga.total_balance, 0))
from group_aggregates ga
where rgm.room_id = ga.room_id
  and rgm.group_id = ga.group_id
  and rgm.state = 'active';

-- ---------------------------------------------------------------------------
-- 3) Auto-seed balances for future room members joining a room
-- ---------------------------------------------------------------------------
create or replace function public.seed_room_member_balance_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  room_default_balance numeric(14, 2) := 0;
  room_default_currency text := 'USD';
begin
  select
    coalesce(r.default_balance, 0),
    coalesce(nullif(r.default_currency, ''), 'USD')
  into room_default_balance, room_default_currency
  from public.rooms r
  where r.id = new.room_id;

  -- When inserts rely on table defaults (0), treat that as "unset" and apply room defaults.
  new.individual_available_balance := coalesce(
    nullif(new.individual_available_balance, 0),
    room_default_balance,
    0
  );
  new.individual_blocked_balance := coalesce(new.individual_blocked_balance, 0);
  new.individual_total_balance := case
    when new.individual_total_balance is null then
      coalesce(new.individual_available_balance, 0) + coalesce(new.individual_blocked_balance, 0)
    when new.individual_total_balance = 0
      and coalesce(new.individual_available_balance, 0) > 0
      and coalesce(new.individual_blocked_balance, 0) = 0 then
      coalesce(new.individual_available_balance, 0)
    else
      new.individual_total_balance
  end;
  new.individual_currency := coalesce(nullif(new.individual_currency, ''), room_default_currency, 'USD');
  new.individual_realized_pnl := coalesce(new.individual_realized_pnl, 0);
  new.individual_unrealized_pnl := coalesce(new.individual_unrealized_pnl, 0);
  new.individual_equity := coalesce(new.individual_equity, new.individual_total_balance);

  return new;
end;
$$;

drop trigger if exists room_members_seed_balance_defaults on public.room_members;
create trigger room_members_seed_balance_defaults
before insert on public.room_members
for each row
execute function public.seed_room_member_balance_defaults();

commit;

-- ---------------------------------------------------------------------------
-- Realtime publication for room balances
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'room_members'
    ) then
      execute 'alter publication supabase_realtime add table public.room_members';
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'room_group_members'
    ) then
      execute 'alter publication supabase_realtime add table public.room_group_members';
    end if;
  end if;
end;
$$;
