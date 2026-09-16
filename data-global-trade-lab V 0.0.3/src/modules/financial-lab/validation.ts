import { AuthHttpError } from "@/modules/auth/errors";

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const requireUuid = (value: unknown, label = "identificador") => {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new AuthHttpError(400, `El ${label} no es válido.`);
  }
  return value;
};

export const requireText = (value: unknown, label: string, max = 5000, min = 1) => {
  if (typeof value !== "string") throw new AuthHttpError(400, `${label} es obligatorio.`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new AuthHttpError(400, `${label} debe tener entre ${min} y ${max} caracteres.`);
  }
  return normalized;
};

export const requireNumber = (value: unknown, label: string, min: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new AuthHttpError(400, `${label} debe estar entre ${min} y ${max}.`);
  }
  return parsed;
};

export const requireInteger = (value: unknown, label: string, min: number, max: number) => {
  const parsed = requireNumber(value, label, min, max);
  if (!Number.isInteger(parsed)) throw new AuthHttpError(400, `${label} debe ser un número entero.`);
  return parsed;
};

