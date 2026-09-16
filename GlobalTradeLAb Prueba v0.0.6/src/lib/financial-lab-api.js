import { getAccessToken } from "@/lib/auth-api";
import { getBackendUrl } from "@/lib/env";

const parseResponse = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    const error = new Error(payload?.error || "No se pudo completar la operación del laboratorio.");
    error.status = response.status;
    throw error;
  }
  return payload;
};

const authHeaders = async () => {
  const token = await getAccessToken();
  if (!token) throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
  return { Authorization: `Bearer ${token}` };
};

export async function fetchFinancialLab(roomId, sessionId = null) {
  const query = new URLSearchParams({ roomId });
  if (sessionId) query.set("sessionId", sessionId);
  const response = await fetch(getBackendUrl(`/api/financial-lab?${query}`), {
    headers: await authHeaders(),
    cache: "no-store",
  });
  return parseResponse(response);
}

export async function mutateFinancialLab(action, payload) {
  const response = await fetch(getBackendUrl("/api/financial-lab"), {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  return parseResponse(response);
}

