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

create or replace function public.set_auth_refresh_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists auth_refresh_sessions_set_updated_at on public.auth_refresh_sessions;
create trigger auth_refresh_sessions_set_updated_at
before update on public.auth_refresh_sessions
for each row
execute function public.set_auth_refresh_sessions_updated_at();

alter table public.auth_refresh_sessions disable row level security;

comment on table public.auth_refresh_sessions is
'Refresh sessions persistidas del auth propio del backend. La definicion base tambien vive en supabase/schema.sql.';
