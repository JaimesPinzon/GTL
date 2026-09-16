// One account snapshot per authenticated workspace. Requests and trade responses
// share a revision so an old read cannot undo a newly confirmed operation.
export function createRoomAccountResource({ roomId, fetchAccount, subscribeAccount }) {
  let state = { account: null, status: roomId ? 'loading' : 'idle', error: null };
  let revision = 0;
  let closed = false;
  let pending = null;
  let unsubscribeAccount = () => {};
  let watchedId = null;
  const listeners = new Set();
  const publish = (next) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  const watch = (account) => {
    const id = account?.id ?? null;
    if (id === watchedId) return;
    unsubscribeAccount();
    watchedId = id;
    unsubscribeAccount = account ? subscribeAccount(account, (next) => {
      if (!closed) resource.commit(next);
    }) : () => {};
  };
  const resource = {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    seed(account) {
      if (state.status === 'loading' && !state.account && account?.roomId === roomId) {
        publish({ account, status: 'ready', error: null });
      }
    },
    commit(account) {
      if (closed || (account && account.roomId !== roomId)) return;
      revision += 1;
      publish({ account, status: account ? 'ready' : 'unavailable', error: null });
      watch(account);
    },
    refresh() {
      if (closed || !roomId) return Promise.resolve(null);
      if (pending) return pending;
      const requestRevision = revision;
      if (!state.account && state.status !== 'loading') publish({ ...state, status: 'loading', error: null });
      const request = Promise.resolve().then(fetchAccount).then((account) => {
        if (!closed && revision === requestRevision) resource.commit(account);
        return account;
      }).catch((error) => {
        if (!closed && revision === requestRevision) {
          publish({ ...state, status: state.account ? 'ready' : 'error', error });
        }
        return null;
      }).finally(() => { if (pending === request) pending = null; });
      pending = request;
      return request;
    },
    start() {
      closed = false;
      watch(state.account);
      void resource.refresh();
    },
    dispose() {
      closed = true;
      revision += 1;
      pending = null;
      unsubscribeAccount();
      watchedId = null;
    },
  };
  return resource;
}
