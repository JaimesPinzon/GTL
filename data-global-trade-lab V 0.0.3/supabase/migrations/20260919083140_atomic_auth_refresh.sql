-- Serialize refresh-token rotation and make immediate reuse idempotent.
-- The encrypted values are only readable by the backend service role and are
-- retained so concurrent requests can receive the exact same replacement.

alter table public.auth_refresh_sessions
  add column if not exists refresh_token_ciphertext text,
  add column if not exists csrf_token_ciphertext text;

create or replace function public.rotate_auth_refresh_session(
  p_current_token_hash text,
  p_current_csrf_token_hash text,
  p_new_session_id uuid,
  p_new_token_hash text,
  p_new_csrf_token_hash text,
  p_new_refresh_token_ciphertext text,
  p_new_csrf_token_ciphertext text,
  p_expires_at timestamptz,
  p_user_agent text,
  p_ip_address text,
  p_reuse_interval_seconds integer default 10
)
returns table (
  outcome text,
  result_session_id uuid,
  result_user_id uuid,
  result_family_id uuid,
  result_refresh_token_ciphertext text,
  result_csrf_token_ciphertext text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_session public.auth_refresh_sessions%rowtype;
  replacement_session public.auth_refresh_sessions%rowtype;
  operation_time timestamptz := timezone('utc', clock_timestamp());
  reuse_seconds integer := greatest(1, least(coalesce(p_reuse_interval_seconds, 10), 60));
begin
  select session_row.*
  into current_session
  from public.auth_refresh_sessions as session_row
  where session_row.token_hash = p_current_token_hash
  for update;

  if not found then
    return query select 'missing'::text, null::uuid, null::uuid, null::uuid, null::text, null::text;
    return;
  end if;

  if current_session.csrf_token_hash <> p_current_csrf_token_hash then
    return query select 'csrf_mismatch'::text, current_session.id, current_session.user_id,
      current_session.family_id, null::text, null::text;
    return;
  end if;

  if current_session.expires_at <= operation_time then
    return query select 'expired'::text, current_session.id, current_session.user_id,
      current_session.family_id, null::text, null::text;
    return;
  end if;

  if current_session.revoked_at is null and current_session.replaced_by_session_id is null then
    insert into public.auth_refresh_sessions (
      id,
      user_id,
      family_id,
      token_hash,
      csrf_token_hash,
      refresh_token_ciphertext,
      csrf_token_ciphertext,
      created_at,
      updated_at,
      last_used_at,
      expires_at,
      user_agent,
      ip_address,
      revoked_at,
      revoked_reason,
      replaced_by_session_id
    ) values (
      p_new_session_id,
      current_session.user_id,
      current_session.family_id,
      p_new_token_hash,
      p_new_csrf_token_hash,
      p_new_refresh_token_ciphertext,
      p_new_csrf_token_ciphertext,
      operation_time,
      operation_time,
      operation_time,
      p_expires_at,
      coalesce(p_user_agent, ''),
      coalesce(p_ip_address, ''),
      null,
      null,
      null
    );

    update public.auth_refresh_sessions as session_row
    set revoked_at = operation_time,
        revoked_reason = 'rotated',
        replaced_by_session_id = p_new_session_id,
        last_used_at = operation_time,
        updated_at = operation_time
    where session_row.id = current_session.id;

    return query select 'rotated'::text, p_new_session_id, current_session.user_id,
      current_session.family_id, p_new_refresh_token_ciphertext, p_new_csrf_token_ciphertext;
    return;
  end if;

  if current_session.revoked_reason = 'rotated'
     and current_session.replaced_by_session_id is not null
     and current_session.revoked_at >= operation_time - make_interval(secs => reuse_seconds) then
    select session_row.*
    into replacement_session
    from public.auth_refresh_sessions as session_row
    where session_row.id = current_session.replaced_by_session_id;

    if found
       and replacement_session.revoked_at is null
       and replacement_session.refresh_token_ciphertext is not null
       and replacement_session.csrf_token_ciphertext is not null then
      return query select 'replayed'::text, replacement_session.id, replacement_session.user_id,
        replacement_session.family_id, replacement_session.refresh_token_ciphertext,
        replacement_session.csrf_token_ciphertext;
      return;
    end if;

    return query select 'retry'::text, current_session.replaced_by_session_id,
      current_session.user_id, current_session.family_id, null::text, null::text;
    return;
  end if;

  update public.auth_refresh_sessions as session_row
  set revoked_at = coalesce(session_row.revoked_at, operation_time),
      revoked_reason = 'reuse_detected',
      updated_at = operation_time
  where session_row.family_id = current_session.family_id
    and session_row.revoked_at is null;

  return query select 'reused'::text, current_session.id, current_session.user_id,
    current_session.family_id, null::text, null::text;
end;
$$;

revoke execute on function public.rotate_auth_refresh_session(
  text, text, uuid, text, text, text, text, timestamptz, text, text, integer
) from public, anon, authenticated;

grant execute on function public.rotate_auth_refresh_session(
  text, text, uuid, text, text, text, text, timestamptz, text, text, integer
) to service_role;

comment on function public.rotate_auth_refresh_session(
  text, text, uuid, text, text, text, text, timestamptz, text, text, integer
) is 'Atomically rotates backend refresh sessions and safely replays the replacement during a short concurrency window.';
