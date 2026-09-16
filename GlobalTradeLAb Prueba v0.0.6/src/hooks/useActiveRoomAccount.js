import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { fetchResolvedUserRoomAccount, subscribeToRoomAccount } from '@/lib/room-balance';
import { createRoomAccountResource } from '@/lib/room-account-resource';

export function useActiveRoomAccount({ roomId, userIds, knownAccount }) {
  const identityKey = userIds.join('|');
  const resource = useMemo(() => createRoomAccountResource({
    roomId,
    fetchAccount: () => fetchResolvedUserRoomAccount({ roomId, userIds: identityKey.split('|') }),
    subscribeAccount: (account, onChange) => subscribeToRoomAccount({
      account, onChange, refreshOnSubscribe: false, pollIntervalMs: 0,
    }),
  }), [roomId, identityKey]);
  const snapshot = useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getSnapshot);

  useEffect(() => { resource.seed(knownAccount); }, [resource, knownAccount]);
  useEffect(() => {
    if (!roomId || !identityKey) return undefined;
    resource.start();
    const refresh = () => { void resource.refresh(); };
    const interval = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      resource.dispose();
    };
  }, [resource, roomId, identityKey]);

  return { ...snapshot, resource };
}
