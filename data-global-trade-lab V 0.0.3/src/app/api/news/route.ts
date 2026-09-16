import { NextRequest } from "next/server";

import { authJson, authOptionsResponse, getAuthenticatedUser, validateAllowedOrigin, withAuthErrors } from "@/modules/auth";
import { AuthHttpError } from "@/modules/auth/errors";
import { listNews } from "@/modules/news/repository";

export const runtime = "nodejs";
export const OPTIONS = authOptionsResponse;

async function actor(request: NextRequest) {
  validateAllowedOrigin(request);
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new AuthHttpError(401, "Inicia sesión para consultar noticias.");
  return getAuthenticatedUser(token);
}

export async function GET(request: NextRequest) {
  return withAuthErrors(request, async () => {
    await actor(request);
    const params = request.nextUrl.searchParams;
    const requestedLimit = Number(params.get("limit") || 24);
    const limit = Number.isFinite(requestedLimit) ? Math.min(50, Math.max(1, Math.trunc(requestedLimit))) : 24;
    const symbols = (params.get("symbols") || "").split(",").map((value) => value.trim()).filter(Boolean).slice(0, 30);
    const result = await listNews({
      limit,
      cursor: params.get("cursor"),
      category: params.get("category"),
      region: params.get("region"),
      market: params.get("market"),
      symbol: params.get("symbol"),
      symbols,
      search: params.get("search"),
      sort: params.get("sort") === "trending" ? "trending" : "latest",
      clustered: params.get("clustered") === "true",
    });
    return authJson(request, { ok: true, ...result, fetchedAt: new Date().toISOString() });
  });
}
