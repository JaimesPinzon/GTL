import { NextRequest } from "next/server";

import { authJson, authOptionsResponse, getAuthenticatedUser, validateAllowedOrigin, withAuthErrors } from "@/modules/auth";
import { AuthHttpError } from "@/modules/auth/errors";
import { listSavedNews, setSavedNews } from "@/modules/news/repository";

export const runtime = "nodejs";
export const OPTIONS = authOptionsResponse;

async function actor(request: NextRequest) {
  validateAllowedOrigin(request);
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new AuthHttpError(401, "Inicia sesión para gestionar noticias guardadas.");
  return getAuthenticatedUser(token);
}

export async function GET(request: NextRequest) {
  return withAuthErrors(request, async () => {
    const user = await actor(request);
    return authJson(request, { ok: true, articles: await listSavedNews(user.id) });
  });
}

export async function POST(request: NextRequest) {
  return withAuthErrors(request, async () => {
    const user = await actor(request);
    const body = await request.json().catch(() => null) as { newsId?: unknown; saved?: unknown } | null;
    const newsId = typeof body?.newsId === "string" ? body.newsId.trim() : "";
    if (!newsId) throw new AuthHttpError(400, "Selecciona una noticia válida.");
    const result = await setSavedNews(user.id, newsId, body?.saved !== false);
    return authJson(request, { ok: true, ...result });
  });
}
