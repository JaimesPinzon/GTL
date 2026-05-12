import { NextRequest, NextResponse } from "next/server";

import {
    applyAuthCookies,
    authJson,
    authOptionsResponse,
    changeAuthenticatedPassword,
    clearAuthCookies,
    getAuthenticatedUser,
    getAuthCookies,
    getRequestMeta,
    issueBootstrapCsrf,
    loginUser,
    logoutAllUserSessions,
    logoutUserSession,
    refreshUserSession,
    registerUser,
    restoreUserSession,
    setCsrfCookie,
    validateAllowedOrigin,
    validateCsrfRequest,
    withAuthErrors,
} from "@/modules/auth";
import { parseChangePasswordBody, parseLoginBody, parseRegisterBody } from "@/modules/auth/validators";

export const runtime = "nodejs";

type RouteContext = {
    params: Promise<{ action: string }>;
};

const notFound = (request: NextRequest, action: string) =>
    authJson(
        request,
        {
            ok: false,
            error: `Unknown auth action: ${action}`,
        },
        404
    );

export async function OPTIONS(request: NextRequest) {
    return authOptionsResponse(request);
}

export async function GET(request: NextRequest, context: RouteContext) {
    const { action } = await context.params;

    return withAuthErrors(request, async () => {
        if (action === "csrf") {
            const { refreshToken } = getAuthCookies(request);
            const result = await issueBootstrapCsrf(refreshToken);
            const response = authJson(request, { ok: true, csrfToken: result.csrfToken });
            setCsrfCookie(response, result.csrfToken);
            return response;
        }

        if (action === "restore") {
            const { refreshToken } = getAuthCookies(request);
            const result = await restoreUserSession({
                refreshToken,
                ...getRequestMeta(request),
            });
            const response = authJson(request, {
                ok: true,
                user: result.user,
                accessToken: result.accessToken,
                accessTokenExpiresIn: result.accessTokenExpiresIn,
                csrfToken: result.csrfToken,
            });
            applyAuthCookies(response, result.refreshToken, result.csrfToken);
            return response;
        }

        if (action === "me") {
            const authorization = request.headers.get("authorization") || "";
            const token = authorization.replace(/^Bearer\s+/i, "");
            const user = await getAuthenticatedUser(token);
            return authJson(request, { ok: true, user });
        }

        return notFound(request, action);
    });
}

export async function POST(request: NextRequest, context: RouteContext) {
    const { action } = await context.params;

    return withAuthErrors(request, async () => {
        if (action === "login") {
            validateAllowedOrigin(request);
            validateCsrfRequest(request);
            const body = await parseLoginBody(request);
            const result = await loginUser({
                email: body.email,
                password: body.password,
                ...getRequestMeta(request),
            });
            const response = authJson(request, {
                ok: true,
                user: result.user,
                accessToken: result.accessToken,
                accessTokenExpiresIn: result.accessTokenExpiresIn,
                csrfToken: result.csrfToken,
            });
            applyAuthCookies(response, result.refreshToken, result.csrfToken);
            return response;
        }

        if (action === "register") {
            validateAllowedOrigin(request);
            validateCsrfRequest(request);
            const body = await parseRegisterBody(request);
            const result = await registerUser({
                name: body.name,
                email: body.email,
                password: body.password,
                role: body.role,
                ...getRequestMeta(request),
            });
            const response = authJson(
                request,
                {
                    ok: true,
                    user: result.user,
                    accessToken: result.accessToken,
                    accessTokenExpiresIn: result.accessTokenExpiresIn,
                    csrfToken: result.csrfToken,
                },
                201
            );
            applyAuthCookies(response, result.refreshToken, result.csrfToken);
            return response;
        }

        if (action === "refresh") {
            validateAllowedOrigin(request);
            validateCsrfRequest(request);
            const { refreshToken } = getAuthCookies(request);
            const result = await refreshUserSession({
                refreshToken,
                csrfToken: request.headers.get("x-csrf-token") || "",
                ...getRequestMeta(request),
            });
            const response = authJson(request, {
                ok: true,
                user: result.user,
                accessToken: result.accessToken,
                accessTokenExpiresIn: result.accessTokenExpiresIn,
                csrfToken: result.csrfToken,
            });
            applyAuthCookies(response, result.refreshToken, result.csrfToken);
            return response;
        }

        if (action === "logout") {
            validateAllowedOrigin(request);
            validateCsrfRequest(request);
            const { refreshToken } = getAuthCookies(request);
            await logoutUserSession(refreshToken);
            const response = authJson(request, { ok: true });
            clearAuthCookies(response);
            return response;
        }

        if (action === "logout-all") {
            validateAllowedOrigin(request);
            validateCsrfRequest(request);
            const { refreshToken } = getAuthCookies(request);
            await logoutAllUserSessions(refreshToken);
            const response = authJson(request, { ok: true });
            clearAuthCookies(response);
            return response;
        }

        if (action === "change-password") {
            validateAllowedOrigin(request);
            validateCsrfRequest(request);
            const authorization = request.headers.get("authorization") || "";
            const token = authorization.replace(/^Bearer\s+/i, "");
            const body = await parseChangePasswordBody(request);
            await changeAuthenticatedPassword(token, body.currentPassword, body.newPassword);
            const response = authJson(request, { ok: true });
            clearAuthCookies(response);
            return response;
        }

        return notFound(request, action);
    }).then((response) => {
        if (!(response instanceof NextResponse)) {
            return response;
        }

        if ((action === "restore" || action === "refresh") && response.status === 401) {
            clearAuthCookies(response);
        }

        return response;
    });
}
