import { NextRequest, NextResponse } from "next/server";

import { authConfig } from "@/modules/auth/config";
import { debugAuth } from "@/modules/auth/debug";
import { assertAuth, AuthHttpError } from "@/modules/auth/errors";

const getClientIp = (request: NextRequest) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";

export const getRequestMeta = (request: NextRequest) => ({
    userAgent: request.headers.get("user-agent") || "",
    ipAddress: getClientIp(request),
});

export const authCorsHeaders = (request: NextRequest) => {
    const origin = request.headers.get("origin");
    const headers = new Headers();

    if (origin && authConfig.allowedOrigins.has(origin)) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Vary", "Origin");
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CSRF-Token");
        headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    }

    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    headers.set("Cross-Origin-Resource-Policy", "same-site");
    return headers;
};

export const authJson = (request: NextRequest, body: unknown, status = 200) =>
    NextResponse.json(body, {
        status,
        headers: authCorsHeaders(request),
    });

export const authOptionsResponse = (request: NextRequest) =>
    new NextResponse(null, {
        status: 204,
        headers: authCorsHeaders(request),
    });

export const debugCsrfValidation = (request: NextRequest, hasCookie: boolean, hasHeader: boolean, matches: boolean) => {
    debugAuth("csrf-validate", {
        method: request.method,
        path: request.nextUrl.pathname,
        hasCookie,
        hasHeader,
        matches,
    });
};

export const validateAllowedOrigin = (request: NextRequest) => {
    const origin = request.headers.get("origin");
    if (!origin) {
        return;
    }

    assertAuth(authConfig.allowedOrigins.has(origin), 403, "Origin is not allowed.");
};

export const withAuthErrors = async (request: NextRequest, action: () => Promise<NextResponse>) => {
    try {
        return await action();
    } catch (error) {
        if (error instanceof AuthHttpError) {
            return authJson(
                request,
                {
                    ok: false,
                    error: error.message,
                    details: error.details,
                },
                error.statusCode
            );
        }

        console.error("Unhandled auth route error", error);
        return authJson(request, { ok: false, error: "Internal server error." }, 500);
    }
};
