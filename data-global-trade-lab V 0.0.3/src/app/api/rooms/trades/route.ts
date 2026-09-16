import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/app/utils/supabase/admin';
import { authJson, authOptionsResponse, getAuthenticatedUser, validateAllowedOrigin, withAuthErrors } from '@/modules/auth';
import { AuthHttpError } from '@/modules/auth/errors';

export const runtime = 'nodejs';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requireId = (value: unknown) => {
  if (typeof value !== 'string' || !uuid.test(value)) throw new AuthHttpError(400, 'Identificador de operación o sala no válido.');
  return value;
};
const requirePositive = (value: unknown, maximum: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value >= maximum) {
    throw new AuthHttpError(400, 'El monto o la cotización no es válido.');
  }
  return value;
};
async function actor(request: NextRequest) {
  validateAllowedOrigin(request);
  // A backend session is required. Never accept a user id or role from the body.
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new AuthHttpError(401, 'Inicia sesión para operar.');
  return getAuthenticatedUser(token);
}
function checkDatabaseError(error: { code: string; message: string } | null) {
  if (!error) return;
  if (error.code === '42501') throw new AuthHttpError(403, error.message);
  if (error.code === '22023') throw new AuthHttpError(409, error.message);
  if (['22P02', '22003'].includes(error.code)) throw new AuthHttpError(400, 'El monto o la cotización no es válido.');
  console.error('room trade database error', { code: error.code, message: error.message });
  if (['PGRST202', '42703', '42P01'].includes(error.code)) {
    throw new AuthHttpError(503, 'El servidor de operaciones requiere la migración atomic_room_trading. No se guardó la operación.');
  }
  throw new AuthHttpError(500, 'No se pudo guardar la operación. Reintenta el mismo envío para comprobar su estado.');
}
async function readSnapshotFallback(roomId: string, userId: string, viewerId: string) {
  const { data: viewerMember, error: viewerError } = await supabaseAdmin
    .from('room_members')
    .select('id, role_in_room')
    .eq('room_id', roomId)
    .eq('user_id', viewerId)
    .eq('state', 'active')
    .maybeSingle();
  if (viewerError) checkDatabaseError(viewerError);
  if (!viewerMember || (viewerId !== userId && !['teacher', 'monitor'].includes(viewerMember.role_in_room))) {
    throw new AuthHttpError(403, 'No tienes acceso al portafolio de esta sala.');
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from('room_members')
    .select('id, individual_available_balance, individual_blocked_balance, individual_total_balance, individual_currency')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .eq('state', 'active')
    .maybeSingle();
  if (memberError) checkDatabaseError(memberError);
  if (!member) throw new AuthHttpError(403, 'No hay una cuenta activa en esta sala.');

  const { data: groupMembership, error: groupError } = await supabaseAdmin
    .from('room_group_members')
    .select('id, group_id, group_available_balance, group_blocked_balance, group_total_balance, group_currency, group:room_groups(id, state)')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .eq('state', 'active')
    .maybeSingle();
  if (groupError) console.warn('room trade fallback group warning', { code: groupError.code, message: groupError.message });
  const group = Array.isArray(groupMembership?.group) ? groupMembership.group[0] : groupMembership?.group;
  const useGroup = Boolean(groupMembership?.group_id && (!group?.state || group.state === 'active'));
  const activeGroupMembership = useGroup ? groupMembership : null;
  const account = useGroup
    ? {
        id: `rgm:${activeGroupMembership!.id}`, roomId, userId,
        availableBalance: Number(activeGroupMembership!.group_available_balance ?? 0),
        blockedBalance: Number(activeGroupMembership!.group_blocked_balance ?? 0),
        totalBalance: Number(activeGroupMembership!.group_total_balance ?? 0),
        currency: activeGroupMembership!.group_currency || 'USD',
        state: 'active', ownerType: 'group', ownerGroupId: activeGroupMembership!.group_id, isShared: true,
      }
    : {
        id: `rm:${member.id}`, roomId, userId,
        availableBalance: Number(member.individual_available_balance ?? 0),
        blockedBalance: Number(member.individual_blocked_balance ?? 0),
        totalBalance: Number(member.individual_total_balance ?? 0),
        currency: member.individual_currency || 'USD',
        state: 'active', ownerType: 'user', ownerGroupId: null, isShared: false,
      };

  const [positionsResult, transactionsResult] = await Promise.all([
    supabaseAdmin.from('positions').select('*').eq('room_id', roomId).eq('user_id', userId).order('open_date', { ascending: false }),
    supabaseAdmin.from('transactions').select('*').eq('room_id', roomId).eq('user_id', userId).order('date', { ascending: false }),
  ]);
  if (positionsResult.error) checkDatabaseError(positionsResult.error);
  if (transactionsResult.error) checkDatabaseError(transactionsResult.error);

  return {
    account,
    positions: positionsResult.data || [],
    transactions: transactionsResult.data || [],
    result: { profitOrLoss: 0 },
  };
}
export const OPTIONS = authOptionsResponse;
export async function GET(request: NextRequest) {
  return withAuthErrors(request, async () => {
    const user = await actor(request);
    const roomId = requireId(request.nextUrl.searchParams.get('roomId'));
    const userId = requireId(request.nextUrl.searchParams.get('userId') || user.id);
    const { data, error } = await supabaseAdmin.rpc('room_trading_snapshot', {
      p_room_id: roomId, p_user_id: userId, p_viewer_id: user.id,
    });
    if (error && ['PGRST202', '42703', '42P01'].includes(error.code)) {
      console.warn('room trade snapshot fallback', { code: error.code, message: error.message });
      const fallback = await readSnapshotFallback(roomId, userId, user.id);
      const response = authJson(request, { ok: true, ...fallback });
      response.headers.set('Cache-Control', 'no-store');
      return response;
    }
    checkDatabaseError(error);
    const response = authJson(request, { ok: true, ...data });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  });
}
export async function POST(request: NextRequest) {
  return withAuthErrors(request, async () => {
    const user = await actor(request);
    let body;
    try { body = await request.json(); } catch { throw new AuthHttpError(400, 'La solicitud no contiene JSON válido.'); }
    if (!body || typeof body !== 'object') throw new AuthHttpError(400, 'Solicitud no válida.');
    const roomId = requireId(body.roomId);
    const requestId = requireId(body.requestId);
    const price = requirePositive(body.price, 10000000000);
    let order;
    if (body.action === 'open') {
      if (!['BUY', 'SELL'].includes(body.type) || typeof body.symbol !== 'string' || !/^[A-Z0-9][A-Z0-9._/-]{0,39}$/.test(body.symbol)
        || typeof body.justification !== 'string' || !body.justification.trim() || body.justification.length > 5000
        || (body.attachmentName != null && (typeof body.attachmentName !== 'string' || body.attachmentName.length > 255))) {
        throw new AuthHttpError(400, 'Revisa el activo, tipo y justificación de la operación.');
      }
      order = { action: 'open', type: body.type, symbol: body.symbol, amount: requirePositive(body.amount, 1000000000000),
        price, justification: body.justification.trim(), attachmentName: body.attachmentName || null };
    } else if (body.action === 'close' && typeof body.positionId === 'string' && body.positionId.length > 0 && body.positionId.length <= 150) {
      order = { action: 'close', positionId: body.positionId, price };
    } else {
      throw new AuthHttpError(400, 'La operación no es válida.');
    }
    const { data, error } = await supabaseAdmin.rpc('execute_room_trade', {
      p_user_id: user.id, p_room_id: roomId, p_request_id: requestId, p_order: order,
    });
    checkDatabaseError(error);
    const response = authJson(request, { ok: true, ...data });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  });
}
