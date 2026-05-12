import { NextRequest } from "next/server";

import { authJson, authOptionsResponse, getAuthenticatedSessions, withAuthErrors } from "@/modules/auth";

export const runtime = "nodejs";

const getBearerToken = (request: NextRequest) => (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

export async function OPTIONS(request: NextRequest) {
    return authOptionsResponse(request);
}

export async function GET(request: NextRequest) {
    return withAuthErrors(request, async () => {
        const sessions = await getAuthenticatedSessions(getBearerToken(request));
        return authJson(request, { ok: true, sessions });
    });
}
