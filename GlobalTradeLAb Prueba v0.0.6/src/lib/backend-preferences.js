import { getBackendUrl } from "@/lib/env";

export const getTimezonesFromBackend = async () => {
  const response = await fetch(getBackendUrl("/api/preferences/timezones"));

  if (!response.ok) {
    throw new Error(`Backend preferences request failed with status ${response.status}`);
  }

  const payload = await response.json();

  if (!payload.ok || !Array.isArray(payload.results)) {
    throw new Error(payload.error || "Preferences backend returned an invalid payload");
  }

  return payload.results;
};
