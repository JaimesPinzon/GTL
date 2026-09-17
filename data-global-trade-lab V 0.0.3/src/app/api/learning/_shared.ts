import { NextRequest } from "next/server";

import { getAuthenticatedUser, validateAllowedOrigin } from "@/modules/auth";
import { AuthHttpError } from "@/modules/auth/errors";

export async function learningActor(request: NextRequest) {
  validateAllowedOrigin(request);
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new AuthHttpError(401, "Inicia sesión para acceder a Aprender.");
  return getAuthenticatedUser(token);
}

export const learningText = (value: unknown, field: string, maxLength = 160) => {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maxLength) throw new AuthHttpError(400, `${field} no es válido.`);
  return normalized;
};

export const learningBody = async (request: NextRequest) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AuthHttpError(400, "El cuerpo de la solicitud no es válido.");
  return body as Record<string, unknown>;
};
