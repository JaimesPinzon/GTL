import { NextRequest } from "next/server";

import { getAuthenticatedUser, validateAllowedOrigin } from "@/modules/auth";
import { AuthHttpError } from "@/modules/auth/errors";

export async function requireNewsActor(request: NextRequest) {
  validateAllowedOrigin(request);
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new AuthHttpError(401, "Inicia sesión para utilizar Noticias.");
  return getAuthenticatedUser(token);
}

export async function readJsonObject(request: NextRequest) {
  const value = await request.json().catch(() => null);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AuthHttpError(400, "La solicitud no contiene JSON válido.");
  return value as Record<string, unknown>;
}
