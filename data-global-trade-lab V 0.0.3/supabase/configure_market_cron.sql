-- Run this once in Supabase SQL Editor after setting CRON_SECRET in Render.
create schema if not exists private;

create table if not exists private.market_cron_config (
    config_id boolean primary key default true check (config_id),
    backend_url text not null,
    cron_secret text,
    updated_at timestamptz not null default timezone('utc', now())
);

revoke all on private.market_cron_config from public, anon, authenticated;
grant select on private.market_cron_config to postgres, service_role;

create or replace function public.trigger_market_base_candles_backfill()
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
    backend_url text;
    cron_secret text;
    request_headers jsonb := jsonb_build_object('Content-Type', 'application/json');
begin
    select c.backend_url, c.cron_secret
    into backend_url, cron_secret
    from private.market_cron_config c
    where c.config_id = true;

    if backend_url is null then
        raise notice 'market backfill cron skipped: private.market_cron_config is not configured';
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

create or replace function public.trigger_market_quotes_refresh()
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
    backend_url text;
    cron_secret text;
    request_headers jsonb := jsonb_build_object('Content-Type', 'application/json');
begin
    select c.backend_url, c.cron_secret
    into backend_url, cron_secret
    from private.market_cron_config c
    where c.config_id = true;

    if backend_url is null then
        raise notice 'market quotes cron skipped: private.market_cron_config is not configured';
        return;
    end if;

    if cron_secret is not null then
        request_headers := request_headers || jsonb_build_object('Authorization', 'Bearer ' || cron_secret);
    end if;

    perform net.http_post(
        url := rtrim(backend_url, '/') || '/api/market/quotes/refresh',
        headers := request_headers,
        body := '{}'::jsonb
    );
end;
$$;

insert into private.market_cron_config (backend_url, cron_secret)
values (
    'https://gtl-e6j4.onrender.com',
    'EL_MISMO_SECRETO_DE_RENDER'
)
on conflict (config_id) do update
set backend_url = excluded.backend_url,
    cron_secret = excluded.cron_secret,
    updated_at = timezone('utc', now());

select config_id, backend_url, updated_at
from private.market_cron_config;