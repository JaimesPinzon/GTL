import { NextRequest } from "next/server";

import { authJson, authOptionsResponse, withAuthErrors } from "@/modules/auth";
import { AuthHttpError } from "@/modules/auth/errors";
import { canAccessRoom, canManageRoom } from "@/app/api/rooms/_shared";
import { createActivityFromNews, listClassNewsShares, shareNewsWithClass } from "@/modules/news/phase2-repository";
import { readJsonObject, requireNewsActor } from "@/app/api/news/_shared";

export const runtime = "nodejs";
export const OPTIONS = authOptionsResponse;

export async function GET(request: NextRequest) {
  return withAuthErrors(request, async () => {
    const user = await requireNewsActor(request);
    const roomId = request.nextUrl.searchParams.get("roomId") || "";
    if (!roomId || !(await canAccessRoom(user.id, roomId))) throw new AuthHttpError(403, "No puedes consultar las noticias de esta clase.");
    return authJson(request, { ok: true, shares: await listClassNewsShares(roomId) });
  });
}

export async function POST(request: NextRequest) {
  return withAuthErrors(request, async () => {
    const user = await requireNewsActor(request);
    const body = await readJsonObject(request);
    const roomId = typeof body.roomId === "string" ? body.roomId : "";
    const newsId = typeof body.newsId === "string" ? body.newsId : "";
    if (!roomId || !newsId) throw new AuthHttpError(400, "Selecciona una clase y una noticia válidas.");
    if (!(await canManageRoom(user.id, roomId))) throw new AuthHttpError(403, "Sólo docentes y monitores pueden realizar esta acción.");
    if (body.action === "share") {
      const share = await shareNewsWithClass(user.id, roomId, newsId, String(body.note || ""));
      return authJson(request, { ok: true, share });
    }
    if (body.action === "create_activity") {
      const activity = await createActivityFromNews(user.id, roomId, newsId, body);
      return authJson(request, { ok: true, activity });
    }
    throw new AuthHttpError(400, "Acción de clase no reconocida.");
  });
}
