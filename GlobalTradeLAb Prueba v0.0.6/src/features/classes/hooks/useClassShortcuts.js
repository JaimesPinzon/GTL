import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "gtl.class.shortcuts.collapsed";
const CHANGE_EVENT = "gtl:class-shortcuts-change";

const readCollapsed = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "true";
};

export const useClassShortcuts = () => {
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);

  useEffect(() => {
    const handleChange = (event) => setIsCollapsed(Boolean(event.detail?.isCollapsed));
    window.addEventListener(CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(CHANGE_EVENT, handleChange);
  }, []);

  const toggleShortcuts = useCallback(() => {
    const next = !readCollapsed();
    window.localStorage.setItem(STORAGE_KEY, String(next));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { isCollapsed: next } }));
  }, []);

  return { isCollapsed, toggleShortcuts };
};
