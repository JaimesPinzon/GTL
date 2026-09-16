import { NextRequest } from "next/server";

import { authJson, authOptionsResponse, getAuthenticatedUser, validateAllowedOrigin, withAuthErrors } from "@/modules/auth";
import { AuthHttpError } from "@/modules/auth/errors";
import { getNewsArticle, markNewsRead } from "@/modules/news/repository";

export const runtime = "nodejs";
export const OPTIONS = authOptionsResponse;

async function actor(request: NextRequest) {
  validateAllowedOrigin(request);
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new AuthHttpError(401, "Inicia sesión para consultar noticias.");
  return getAuthenticatedUser(token);
}

export async function GET(request: NextRequest, context: { params: Promise<{ newsId: string }> }) {
  return withAuthErrors(request, async () => {
    const user = await actor(request);
    const { newsId } = await context.params;
    const article = await getNewsArticle(newsId, user.id);
    if (!article) throw new AuthHttpError(404, "La noticia no existe o ya no está disponible.");
    await markNewsRead(user.id, newsId);
    return authJson(request, { ok: true, article });
  });
}
