create table if not exists public.user_presence (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  active_room_id uuid references public.rooms(id) on delete set null,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_presence_active_room_id_idx
  on public.user_presence (active_room_id);

create index if not exists user_presence_last_seen_at_idx
  on public.user_presence (last_seen_at desc);

alter table public.user_presence enable row level security;

revoke all on table public.user_presence from anon, authenticated;
grant select, insert, update, delete on table public.user_presence to service_role;

comment on table public.user_presence is
  'Server-managed heartbeat used to show online state, active class and last connection.';
