import { NextRequest } from "next/server";

import { authJson, authOptionsResponse, withAuthErrors } from "@/modules/auth";
import { listEconomicEvents } from "@/modules/news/phase2-repository";
import { requireNewsActor } from "@/app/api/news/_shared";

export const runtime = "nodejs";
export const OPTIONS = authOptionsResponse;

export async function GET(request: NextRequest) {
  return withAuthErrors(request, async () => {
    await requireNewsActor(request);
    const params = request.nextUrl.searchParams;
    const now = new Date();
    const from = params.get("from") || new Date(now.getTime() - 86_400_000).toISOString();
    const to = params.get("to") || new Date(now.getTime() + 7 * 86_400_000).toISOString();
    const events = await listEconomicEvents({ from, to, region: params.get("region"), impact: params.get("impact") });
    return authJson(request, { ok: true, events, fetchedAt: new Date().toISOString() });
  });
}
