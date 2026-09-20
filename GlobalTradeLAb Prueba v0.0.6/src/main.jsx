import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import "@/Languages/i18n";
import { isDynamicImportFailure, recoverFromChunkLoadFailure } from "@/lib/chunk-recovery";

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
