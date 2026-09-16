import { NextRequest } from "next/server";

import { authJson, authOptionsResponse, withAuthErrors } from "@/modules/auth";
import { getUnreadNewsBySymbol } from "@/modules/news/phase2-repository";
import { requireNewsActor } from "@/app/api/news/_shared";

export const runtime = "nodejs";
export const OPTIONS = authOptionsResponse;

export async function GET(request: NextRequest) {
  return withAuthErrors(request, async () => {
    const user = await requireNewsActor(request);
    const symbols = (request.nextUrl.searchParams.get("symbols") || "").split(",").filter(Boolean);
    return authJson(request, { ok: true, counts: await getUnreadNewsBySymbol(user.id, symbols) });
  });
}
