import { fetchWithAuth } from '@/lib/auth-api';

const mapSnapshot = (payload) => {
  if (!payload?.ok || !payload.account || !Array.isArray(payload.positions) || !Array.isArray(payload.transactions)) {
    throw new Error('El servidor no devolvió el estado completo de la operación.');
  }
  return {
    account: payload.account,
    positions: payload.positions.map((row) => ({
      id: row.id, symbol: row.symbol, type: row.type, amount: Number(row.amount), entryPrice: Number(row.entry_price),
      openDate: row.open_date, justification: row.justification, attachmentName: row.attachment_name,
      groupId: row.group_id || null,
    })),
    transactions: payload.transactions.map((row) => ({
      id: row.id, type: row.type, symbol: row.symbol, amount: Number(row.amount), price: row.price == null ? null : Number(row.price),
      entryPrice: row.entry_price == null ? null : Number(row.entry_price), closePrice: row.close_price == null ? null : Number(row.close_price),
      profitOrLoss: row.profit_or_loss == null ? null : Number(row.profit_or_loss), date: row.date,
      justification: row.justification, attachmentName: row.attachment_name, groupId: row.group_id || null,
    })),
    profitOrLoss: Number(payload.result?.profitOrLoss || 0),
  };
};

export async function fetchRoomPortfolio(userId, roomId) {
  const params = new URLSearchParams({ roomId, userId });
  return mapSnapshot(await fetchWithAuth(`/api/rooms/trades?${params}`, { method: 'GET', credentials: 'omit' }));
}

export async function submitRoomTrade(order) {
  // One authenticated request; no profiles upsert, client balance write or full-portfolio replacement.
  return mapSnapshot(await fetchWithAuth('/api/rooms/trades', {
    method: 'POST', credentials: 'omit', body: JSON.stringify(order),
  }));
}
