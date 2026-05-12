import { NextRequest } from "next/server";

import { authJson, authOptionsResponse, revokeAuthenticatedSession, withAuthErrors } from "@/modules/auth";

export const runtime = "nodejs";

type SessionRouteContext = {
    params: Promise<{ sessionId: string }>;
};

const getBearerToken = (request: NextRequest) => (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

export async function OPTIONS(request: NextRequest) {
    return authOptionsResponse(request);
}

export async function DELETE(request: NextRequest, context: SessionRouteContext) {
    const { sessionId } = await context.params;

    return withAuthErrors(request, async () => {
        const revoked = await revokeAuthenticatedSession(getBearerToken(request), sessionId);
        return authJson(request, { ok: true, revoked });
    });
}
