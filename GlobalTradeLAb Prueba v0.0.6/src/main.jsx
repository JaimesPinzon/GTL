import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import "@/Languages/i18n";

const CHUNK_RECOVERY_SESSION_KEY = "gtl.chunk-recovery-attempted";
const MAX_CHUNK_RECOVERY_ATTEMPTS = 2;

const isDynamicImportFailure = (value) => {
  const message = String(value?.message || value || "");
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("Failed to load module script") ||
    message.includes("Expected a JavaScript-or-Wasm module script")
  );
};

const recoverFromChunkLoadFailure = () => {
  if (typeof window === "undefined") {
    return;
  }

  const attempts = Number(window.sessionStorage.getItem(CHUNK_RECOVERY_SESSION_KEY) || "0");
  if (attempts >= MAX_CHUNK_RECOVERY_ATTEMPTS) {
    return;
  }

  window.sessionStorage.setItem(CHUNK_RECOVERY_SESSION_KEY, String(attempts + 1));
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("__gtl_reload", Date.now().toString());
  window.location.replace(nextUrl.toString());
};

const isChunkScriptError = (event) => {
  const script = event?.target;
  if (!script || script === window) {
    return false;
  }

  const tagName = script?.tagName?.toLowerCase?.();
  if (tagName !== "script") {
    return false;
  }

  const src = String(script?.src || "");
  return src.includes("/assets/");
};

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    event?.preventDefault?.();
    recoverFromChunkLoadFailure();
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (isDynamicImportFailure(event?.reason)) {
      event.preventDefault?.();
      recoverFromChunkLoadFailure();
    }
  });

  window.addEventListener("error", (event) => {
    if (
      isDynamicImportFailure(event?.error) ||
      isDynamicImportFailure(event?.message) ||
      isChunkScriptError(event)
    ) {
      recoverFromChunkLoadFailure();
    }
  }, true);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
