-- Additive migration: no profile policy changes, balance resets or history deletion.
begin;

alter table public.positions
  add column if not exists group_id uuid references public.room_groups(id),
  add column if not exists reserved_amount numeric(14,2) not null default 0;
alter table public.transactions
  add column if not exists group_id uuid references public.room_groups(id),
  add column if not exists position_id text;

create index if not exists positions_room_user_open_idx on public.positions(room_id, user_id, open_date desc);
create index if not exists positions_room_group_open_idx on public.positions(room_id, group_id, open_date desc) where group_id is not null;
create index if not exists transactions_room_user_date_idx on public.transactions(room_id, user_id, date desc);
create index if not exists transactions_room_group_date_idx on public.transactions(room_id, group_id, date desc) where group_id is not null;

create schema if not exists private;
create table if not exists private.room_trade_requests (
  user_id uuid not null references public.profiles(user_id),
  request_id uuid not null,
  room_id uuid not null references public.rooms(id) on delete cascade,
  request jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
alter table private.room_trade_requests enable row level security;
revoke all on private.room_trade_requests from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert on private.room_trade_requests to service_role;

-- Called ONLY by the authenticated backend with its server-only service role.
-- All functions are invoker functions, not publicly executable security definers.
create or replace function public.room_trading_snapshot(p_room_id uuid, p_user_id uuid, p_viewer_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  member public.room_members%rowtype;
  gm public.room_group_members%rowtype;
  account jsonb;
  portfolio_positions jsonb;
  portfolio_transactions jsonb;
begin
  if p_viewer_id is null or not exists (
    select 1 from public.room_members rm where rm.room_id = p_room_id
      and rm.user_id = p_viewer_id and rm.state = 'active'
      and (p_viewer_id = p_user_id or rm.role_in_room in ('teacher', 'monitor'))
  ) then raise exception using errcode = '42501', message = 'No tienes acceso al portafolio de esta sala.'; end if;

  select * into member from public.room_members rm
    where rm.room_id = p_room_id and rm.user_id = p_user_id and rm.state = 'active';
  if not found then raise exception using errcode = '42501', message = 'No hay una cuenta activa en esta sala.'; end if;
  select rgm.* into gm from public.room_group_members rgm
    join public.room_groups g on g.id = rgm.group_id and g.room_id = rgm.room_id and g.state = 'active'
    where rgm.room_id = p_room_id and rgm.user_id = p_user_id and rgm.state = 'active';

  if gm.id is not null then
    account := jsonb_build_object('id', 'rgm:' || gm.id, 'roomId', p_room_id, 'userId', p_user_id,
      'availableBalance', coalesce(gm.group_available_balance, 0), 'blockedBalance', coalesce(gm.group_blocked_balance, 0),
      'totalBalance', coalesce(gm.group_total_balance, 0), 'currency', coalesce(gm.group_currency, 'USD'),
      'state', 'active', 'ownerType', 'group', 'ownerGroupId', gm.group_id, 'isShared', true);
  else
    account := jsonb_build_object('id', 'rm:' || member.id, 'roomId', p_room_id, 'userId', p_user_id,
      'availableBalance', coalesce(member.individual_available_balance, 0), 'blockedBalance', coalesce(member.individual_blocked_balance, 0),
      'totalBalance', coalesce(member.individual_total_balance, 0), 'currency', coalesce(member.individual_currency, 'USD'),
      'state', 'active', 'ownerType', 'user', 'ownerGroupId', null, 'isShared', false);
  end if;
  -- Personal history is retained when joining a group, but never charged to it.
  select coalesce(jsonb_agg(to_jsonb(p) order by p.open_date desc, p.id), '[]') into portfolio_positions
    from public.positions p where p.room_id = p_room_id
      and ((p.group_id is null and p.user_id = p_user_id) or p.group_id = gm.group_id);
  select coalesce(jsonb_agg(to_jsonb(t) order by t.date desc, t.id), '[]') into portfolio_transactions
    from public.transactions t where t.room_id = p_room_id
      and ((t.group_id is null and t.user_id = p_user_id) or t.group_id = gm.group_id);
  return jsonb_build_object('account', account, 'positions', portfolio_positions, 'transactions', portfolio_transactions);
end;
$$;

create or replace function public.execute_room_trade(p_user_id uuid, p_room_id uuid, p_request_id uuid, p_order jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  room public.rooms%rowtype;
  member public.room_members%rowtype;
  gm public.room_group_members%rowtype;
  position public.positions%rowtype;
  prior private.room_trade_requests%rowtype;
  target_group uuid;
  trade_action text := p_order->>'action';
  side text := p_order->>'type';
  symbol text := upper(trim(p_order->>'symbol'));
  reason text := trim(p_order->>'justification');
  price numeric;
  amount numeric(14,2);
  available numeric(14,2);
  blocked numeric(14,2);
  pnl numeric(14,2) := 0;
  trade_time timestamptz := clock_timestamp();
  result jsonb;
begin
  if p_user_id is null or p_room_id is null or p_request_id is null or trade_action is null or trade_action not in ('open', 'close') then
    raise exception using errcode = '22023', message = 'La solicitud de operación no es válida.';
  end if;
  -- Same request can be retried after a lost HTTP response without charging twice.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text || p_request_id::text, 0));
  select * into prior from private.room_trade_requests r where r.user_id = p_user_id and r.request_id = p_request_id;
  if found then
    if prior.room_id <> p_room_id or prior.request <> p_order then
      raise exception using errcode = '22023', message = 'El identificador de envío ya se utilizó para otra operación.';
    end if;
    return public.room_trading_snapshot(p_room_id, p_user_id, p_user_id) || jsonb_build_object('result', prior.result);
  end if;

  select * into room from public.rooms r where r.id = p_room_id for share;
  if not found then raise exception using errcode = '42501', message = 'La sala no existe.'; end if;
  select * into member from public.room_members rm
    where rm.room_id = p_room_id and rm.user_id = p_user_id and rm.state = 'active';
  if not found then raise exception using errcode = '42501', message = 'No hay una cuenta activa en esta sala.'; end if;
  if member.role_in_room not in ('teacher', 'monitor') and
    (room.state <> 'active' or (room.end_date is not null and (now() at time zone 'America/Bogota')::date > room.end_date)) then
    raise exception using errcode = '42501', message = 'La sala está cerrada para operar.';
  end if;
  price := (p_order->>'price')::numeric;
  if price is null or price <= 0 or price >= 10000000000 or price::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception using errcode = '22023', message = 'La cotización no es válida.';
  end if;
  if trade_action = 'close' then
    select * into position from public.positions p where p.id = p_order->>'positionId' and p.room_id = p_room_id;
    if not found then raise exception using errcode = '22023', message = 'La posición ya se cerró o no existe.'; end if;
    target_group := position.group_id;
    if target_group is null and position.user_id <> p_user_id then
      raise exception using errcode = '42501', message = 'No puedes cerrar esta posición.';
    end if;
  else
    select rgm.group_id into target_group from public.room_group_members rgm
      join public.room_groups g on g.id = rgm.group_id and g.room_id = rgm.room_id and g.state = 'active'
      where rgm.room_id = p_room_id and rgm.user_id = p_user_id and rgm.state = 'active';
  end if;

  if target_group is not null then
    -- Serialize shared-wallet trades on the group, then lock members in a stable order.
    perform 1 from public.room_groups g where g.id = target_group and g.room_id = p_room_id and g.state = 'active' for update;
    if not found then raise exception using errcode = '42501', message = 'El grupo ya no está activo.'; end if;
    perform 1 from public.room_group_members rgm where rgm.room_id = p_room_id and rgm.group_id = target_group and rgm.state = 'active'
      order by rgm.id for update;
    select * into gm from public.room_group_members rgm where rgm.room_id = p_room_id and rgm.group_id = target_group
      and rgm.user_id = p_user_id and rgm.state = 'active';
    if not found then raise exception using errcode = '42501', message = 'No perteneces al grupo de esta posición.'; end if;
    -- Never silently overwrite diverging member wallets with one member's value.
    if exists (select 1 from public.room_group_members rgm where rgm.room_id = p_room_id and rgm.group_id = target_group and rgm.state = 'active'
      and (rgm.group_available_balance is distinct from gm.group_available_balance or rgm.group_blocked_balance is distinct from gm.group_blocked_balance
        or rgm.group_currency is distinct from gm.group_currency)) then
      raise exception using errcode = '22023', message = 'Los saldos del grupo no coinciden. Solicita su conciliación antes de operar.';
    end if;
    available := coalesce(gm.group_available_balance, 0);
    blocked := coalesce(gm.group_blocked_balance, 0);
  end if;
  -- Lock/recheck the room membership even for group trades (concurrent removal).
  select * into member from public.room_members rm
    where rm.id = member.id and rm.state = 'active' for update;
  if not found then raise exception using errcode = '42501', message = 'No hay una cuenta activa en esta sala.'; end if;
  if target_group is null then
    available := coalesce(member.individual_available_balance, 0);
    blocked := coalesce(member.individual_blocked_balance, 0);
  end if;

  if trade_action = 'open' then
    amount := round((p_order->>'amount')::numeric, 2);
    if amount is null or amount <= 0 or amount::text = 'NaN' or side is null or side not in ('BUY', 'SELL')
      or symbol is null or symbol !~ '^[A-Z0-9][A-Z0-9._/-]{0,39}$' or coalesce(reason, '') = '' or length(reason) > 5000
      or length(coalesce(p_order->>'attachmentName', '')) > 255 then
      raise exception using errcode = '22023', message = 'Revisa el monto, activo y justificación de la operación.';
    end if;
    if available < amount then raise exception using errcode = '22023', message = 'Saldo disponible insuficiente.'; end if;
    available := available - amount;
    blocked := blocked + amount;
    insert into public.positions(id, room_id, user_id, group_id, symbol, type, amount, entry_price, open_date, justification, attachment_name, reserved_amount)
      values ('pos_' || p_request_id, p_room_id, p_user_id, target_group, symbol, side, amount, price, trade_time, reason, nullif(p_order->>'attachmentName', ''), amount)
      returning * into position;
    insert into public.transactions(id, room_id, user_id, group_id, position_id, type, symbol, amount, price, date, justification, attachment_name)
      values ('txn_' || p_request_id, p_room_id, p_user_id, target_group, position.id, 'OPEN_' || side, symbol, amount, price, trade_time, reason, position.attachment_name);
  else
    -- Re-read under lock after waiting on the account; prevents a double close.
    select * into position from public.positions p where p.id = p_order->>'positionId' and p.room_id = p_room_id for update;
    if not found then raise exception using errcode = '22023', message = 'La posición ya se cerró o no existe.'; end if;
    if position.entry_price <= 0 or blocked < position.reserved_amount then
      raise exception using errcode = '22023', message = 'La posición requiere conciliación antes de cerrarse.';
    end if;
    pnl := round((price - position.entry_price) * position.amount / position.entry_price * case when position.type = 'BUY' then 1 else -1 end, 2);
    available := available + position.amount + pnl;
    blocked := blocked - position.reserved_amount;
    insert into public.transactions(id, room_id, user_id, group_id, position_id, type, symbol, amount, entry_price, close_price, profit_or_loss, date, justification, attachment_name)
      values ('txn_' || p_request_id, p_room_id, p_user_id, target_group, position.id, 'CLOSE_' || position.type, position.symbol, position.amount,
        position.entry_price, price, pnl, trade_time, position.justification, position.attachment_name);
    delete from public.positions p where p.id = position.id;
  end if;

  if target_group is not null then
    update public.room_group_members rgm set group_available_balance = available, group_blocked_balance = blocked,
      group_total_balance = available + blocked, group_realized_pnl = coalesce(rgm.group_realized_pnl, 0) + pnl,
      group_equity = available + blocked + coalesce(rgm.group_unrealized_pnl, 0)
      where rgm.room_id = p_room_id and rgm.group_id = target_group and rgm.state = 'active';
  else
    update public.room_members rm set individual_available_balance = available, individual_blocked_balance = blocked,
      individual_total_balance = available + blocked, individual_realized_pnl = coalesce(rm.individual_realized_pnl, 0) + pnl,
      individual_equity = available + blocked + coalesce(rm.individual_unrealized_pnl, 0)
      where rm.id = member.id;
  end if;
  result := jsonb_build_object('positionId', position.id, 'profitOrLoss', pnl);
  insert into private.room_trade_requests(user_id, request_id, room_id, request, result)
    values (p_user_id, p_request_id, p_room_id, p_order, result);
  return public.room_trading_snapshot(p_room_id, p_user_id, p_user_id) || jsonb_build_object('result', result);
end;
$$;

revoke all on function public.room_trading_snapshot(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.execute_room_trade(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.room_trading_snapshot(uuid, uuid, uuid) to service_role;
grant execute on function public.execute_room_trade(uuid, uuid, uuid, jsonb) to service_role;
grant select, insert, update, delete on public.positions, public.transactions to service_role;
notify pgrst, 'reload schema';
commit;
