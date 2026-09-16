import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPortfolio, fetchRoomMembers, fetchRoomSimAccounts } from '@/lib/trading-db';

// Selecting a room starts one read-only load. Each result can render immediately;
// the current user's portfolio never waits for the class roster or other students.
export function useRoomWorkspaceData({
  roomId, userId, userRole, onMembers, onAccounts, onPortfolios, onCurrentPortfolio,
}) {
  const scope = `${roomId || ''}::${userId || ''}::${userRole || ''}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const pendingRef = useRef(null);
  const [portfolioState, setPortfolioState] = useState({ scope, status: 'loading' });

  const refresh = useCallback(() => {
    if (!roomId || !userId) return Promise.resolve();
    if (pendingRef.current?.scope === scope && !pendingRef.current.cancelled) {
      return pendingRef.current.promise;
    }
    const request = { scope, cancelled: false, promise: null };
    setPortfolioState((previous) => previous.scope === scope && previous.status === 'ready'
      ? previous : { scope, status: 'loading' });
    const isCurrent = () => !request.cancelled && scopeRef.current === scope;
    const reportError = (part, error) => {
      if (isCurrent()) {
        console.warn(`loadRoomWorkspace ${part}: ${error?.code || 'error'} ${error?.message || String(error)}`);
      }
    };
    const portfolioRequests = new Map();
    const loadPortfolio = (memberId) => {
      if (!portfolioRequests.has(memberId)) {
        portfolioRequests.set(memberId, Promise.resolve().then(() => fetchPortfolio(memberId, roomId)));
      }
      return portfolioRequests.get(memberId);
    };

    const ownPortfolio = loadPortfolio(userId).then((portfolio) => {
      if (isCurrent()) {
        onCurrentPortfolio(portfolio);
        setPortfolioState({ scope, status: 'ready' });
      }
    }).catch((error) => {
      if (isCurrent()) setPortfolioState({ scope, status: 'error' });
      reportError('current portfolio', error);
    });
    const accounts = Promise.resolve().then(() => fetchRoomSimAccounts(roomId)).then((rows) => {
      if (isCurrent()) onAccounts(rows);
    }).catch((error) => reportError('accounts', error));
    const members = Promise.resolve().then(() => fetchRoomMembers(roomId)).then(async (rows) => {
      if (!isCurrent()) return;
      onMembers(rows);
      if (userRole !== 'teacher') return;
      const studentIds = [...new Set(rows.filter((row) => row.roleInRoom === 'student').map((row) => row.userId))];
      await Promise.allSettled(studentIds.map(async (memberId) => {
        try {
          const portfolio = await loadPortfolio(memberId);
          if (isCurrent()) onPortfolios((previous) => ({ ...previous, [memberId]: portfolio }));
        } catch (error) {
          reportError('student portfolio', error);
        }
      }));
    }).catch((error) => reportError('members', error));

    request.promise = Promise.allSettled([ownPortfolio, accounts, members]).finally(() => {
      if (pendingRef.current === request) pendingRef.current = null;
    });
    pendingRef.current = request;
    return request.promise;
  }, [roomId, userId, userRole, scope, onMembers, onAccounts, onPortfolios, onCurrentPortfolio]);

  useEffect(() => {
    void refresh();
    return () => {
      if (pendingRef.current?.scope === scope) {
        pendingRef.current.cancelled = true;
        pendingRef.current = null;
      }
    };
  }, [refresh, scope]);

  return {
    refresh,
    portfolioStatus: !roomId ? 'ready' : portfolioState.scope === scope ? portfolioState.status : 'loading',
  };
}
