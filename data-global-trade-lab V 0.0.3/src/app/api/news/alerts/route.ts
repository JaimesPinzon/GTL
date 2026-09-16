import { NextRequest } from "next/server";

import { authJson, authOptionsResponse, withAuthErrors } from "@/modules/auth";
import { AuthHttpError } from "@/modules/auth/errors";
import { createNewsAlert, deleteNewsAlert, listNewsAlerts, updateNewsAlert } from "@/modules/news/phase2-repository";
import { readJsonObject, requireNewsActor } from "@/app/api/news/_shared";

export const runtime = "nodejs";
export const OPTIONS = authOptionsResponse;

export async function GET(request: NextRequest) {
  return withAuthErrors(request, async () => {
    const user = await requireNewsActor(request);
    return authJson(request, { ok: true, alerts: await listNewsAlerts(user.id) });
  });
}

export async function POST(request: NextRequest) {
  return withAuthErrors(request, async () => {
    const user = await requireNewsActor(request);
    const body = await readJsonObject(request);
    try {
      const alert = await createNewsAlert(user.id, body);
      return authJson(request, { ok: true, alert });
    } catch (error) {
      throw new AuthHttpError(400, error instanceof Error ? error.message : "No se pudo crear la alerta.");
    }
  });
}

export async function PATCH(request: NextRequest) {
  return withAuthErrors(request, async () => {
    const user = await requireNewsActor(request);
    const body = await readJsonObject(request);
    const alertId = typeof body.alertId === "string" ? body.alertId : "";
    if (!alertId) throw new AuthHttpError(400, "Selecciona una alerta válida.");
    return authJson(request, { ok: true, alert: await updateNewsAlert(user.id, alertId, body) });
  });
}

export async function DELETE(request: NextRequest) {
  return withAuthErrors(request, async () => {
    const user = await requireNewsActor(request);
    const alertId = request.nextUrl.searchParams.get("alertId") || "";
    if (!alertId) throw new AuthHttpError(400, "Selecciona una alerta válida.");
    return authJson(request, { ok: true, ...(await deleteNewsAlert(user.id, alertId)) });
  });
}
