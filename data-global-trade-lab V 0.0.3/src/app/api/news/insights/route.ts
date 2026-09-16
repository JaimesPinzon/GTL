import { NextRequest } from "next/server";

import { authJson, authOptionsResponse, withAuthErrors } from "@/modules/auth";
import { AuthHttpError } from "@/modules/auth/errors";
import { canAccessRoom, canManageRoom } from "@/app/api/rooms/_shared";
import { readJsonObject, requireNewsActor } from "@/app/api/news/_shared";
import {
  createLabEventFromNews,
  getClassPortfolioNews,
  getDailyDigest,
  getEducationalExplanation,
  getHistoricalImpact,
} from "@/modules/news/phase3-repository";

export const runtime = "nodejs";
export const OPTIONS = authOptionsResponse;

export async function GET(request: NextRequest) {
  return withAuthErrors(request, async () => {
    const user = await requireNewsActor(request);
    const params = request.nextUrl.searchParams;
    const mode = params.get("mode") || "impact";
    if (mode === "impact") {
      const newsId = params.get("newsId") || "";
      const symbol = params.get("symbol") || "";
      if (!newsId || !symbol) throw new AuthHttpError(400, "Selecciona una noticia y un activo.");
      return authJson(request, { ok: true, impact: await getHistoricalImpact(newsId, symbol) });
    }
    if (mode === "portfolio" || mode === "daily") {
      const roomId = params.get("roomId") || "";
      if (!roomId || !(await canAccessRoom(user.id, roomId))) throw new AuthHttpError(403, "No puedes consultar esta clase.");
      const includeWholeClass = await canManageRoom(user.id, roomId);
      const data = mode === "daily" ? await getDailyDigest(user.id, roomId, includeWholeClass) : await getClassPortfolioNews(user.id, roomId, includeWholeClass);
      return authJson(request, { ok: true, data });
    }
    throw new AuthHttpError(400, "Análisis de noticias no reconocido.");
  });
}

export async function POST(request: NextRequest) {
  return withAuthErrors(request, async () => {
    const user = await requireNewsActor(request);
    const body = await readJsonObject(request);
    const action = String(body.action || "");
    const newsId = typeof body.newsId === "string" ? body.newsId : "";
    if (!newsId) throw new AuthHttpError(400, "Selecciona una noticia válida.");
    if (action === "explain") {
      const language = body.language === "en" ? "en" : "es";
      const explanation = await getEducationalExplanation(user.id, newsId, language);
      if (!explanation) throw new AuthHttpError(404, "La noticia no existe.");
      return authJson(request, { ok: true, explanation });
    }
    if (action === "create_lab_event") {
      const roomId = typeof body.roomId === "string" ? body.roomId : "";
      if (!roomId || !(await canManageRoom(user.id, roomId))) throw new AuthHttpError(403, "Sólo docentes y monitores pueden crear eventos del laboratorio.");
      const event = await createLabEventFromNews(user.id, roomId, newsId, body);
      if (!event) throw new AuthHttpError(404, "La noticia no existe.");
      return authJson(request, { ok: true, event });
    }
    throw new AuthHttpError(400, "Acción avanzada de noticias no reconocida.");
  });
}
