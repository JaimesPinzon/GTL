import { NextRequest, NextResponse } from "next/server";

import { authConfig } from "@/modules/auth/config";
import { assertAuth } from "@/modules/auth/errors";
import { debugCsrfValidation } from "@/modules/auth/http";

const toCookieOptions = (descriptor: (typeof authConfig.cookies)[keyof typeof authConfig.cookies], maxAge?: number) => ({
    httpOnly: descriptor.httpOnly,
    secure: descriptor.secure,
    sameSite: descriptor.sameSite,
    path: descriptor.path,
    domain: descriptor.domain,
    maxAge: maxAge ?? descriptor.maxAgeSeconds,
});

export const getAuthCookies = (request: NextRequest) => ({
    refreshToken: request.cookies.get(authConfig.cookies.refresh.name)?.value || "",
    csrfToken: request.cookies.get(authConfig.cookies.csrf.name)?.value || "",
});

export const applyAuthCookies = (response: NextResponse, refreshToken: string, csrfToken: string) => {
    response.cookies.set(authConfig.cookies.refresh.name, refreshToken, toCookieOptions(authConfig.cookies.refresh));
    response.cookies.set(authConfig.cookies.csrf.name, csrfToken, toCookieOptions(authConfig.cookies.csrf));
};

export const clearAuthCookies = (response: NextResponse) => {
    response.cookies.set(authConfig.cookies.refresh.name, "", toCookieOptions(authConfig.cookies.refresh, 0));
    response.cookies.set(authConfig.cookies.csrf.name, "", toCookieOptions(authConfig.cookies.csrf, 0));
};

export const setCsrfCookie = (response: NextResponse, csrfToken: string) => {
    response.cookies.set(authConfig.cookies.csrf.name, csrfToken, toCookieOptions(authConfig.cookies.csrf));
};

export const validateCsrfRequest = (request: NextRequest) => {
    const cookies = getAuthCookies(request);
    const headerToken = request.headers.get("x-csrf-token") || "";
    const matches = Boolean(cookies.csrfToken && headerToken && cookies.csrfToken === headerToken);

    debugCsrfValidation(request, Boolean(cookies.csrfToken), Boolean(headerToken), matches);

    assertAuth(cookies.csrfToken, 403, "CSRF validation failed.");
    assertAuth(headerToken, 403, "CSRF validation failed.");
    assertAuth(matches, 403, "CSRF validation failed.");
};
