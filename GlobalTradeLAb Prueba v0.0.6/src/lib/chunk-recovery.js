const CHUNK_RECOVERY_SESSION_KEY = "gtl.chunk-recovery-attempted";
const MAX_CHUNK_RECOVERY_ATTEMPTS = 2;

export const isDynamicImportFailure = (value) => {
  const message = String(value?.message || value || "");
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("Failed to load module script") ||
    message.includes("Expected a JavaScript-or-Wasm module script") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("Load failed") ||
    message.includes("Route module timed out")
  );
};

const getRecoveryKey = (scope) =>
  `${CHUNK_RECOVERY_SESSION_KEY}:${scope || window.location.pathname || "app"}`;

export const markChunkLoadingHealthy = (scope) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(getRecoveryKey(scope));
};

export const recoverFromChunkLoadFailure = (scope) => {
  if (typeof window === "undefined") return false;

  const recoveryKey = getRecoveryKey(scope);
  const attempts = Number(window.sessionStorage.getItem(recoveryKey) || "0");
  if (attempts >= MAX_CHUNK_RECOVERY_ATTEMPTS) return false;

  window.sessionStorage.setItem(recoveryKey, String(attempts + 1));
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("__gtl_reload", Date.now().toString());
  window.location.replace(nextUrl.toString());
  return true;
};
