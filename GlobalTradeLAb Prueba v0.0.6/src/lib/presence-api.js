import { fetchWithAuth } from "@/lib/auth-api";

export async function reportUserPresence(activeRoomId = null) {
  return fetchWithAuth("/api/presence", {
    method: "POST",
    credentials: "omit",
    body: { activeRoomId: activeRoomId || null },
  });
}
