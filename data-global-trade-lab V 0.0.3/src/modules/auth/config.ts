import path from "node:path";

import { serverEnv } from "@/app/utils/env";

import { CookieDescriptor } from "@/modules/auth/types";

const defaultLocalDevOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    // Firebase Hosting default domains used by this project.
    "https://gtl1-f32d5.web.app",
    "https://gtl1-f32d5.firebaseapp.com",
];

const cookieSameSite = serverEnv.AUTH_COOKIE_SAME_SITE.toLowerCase() as "lax" | "strict" | "none";
const secureCookies = serverEnv.AUTH_COOKIE_SECURE || cookieSameSite === "none";
const refreshCookiePath: string = "/api/auth";
const hostPrefixEligible = secureCookies && !serverEnv.AUTH_COOKIE_DOMAIN && refreshCookiePath === "/";

const refreshCookieName = hostPrefixEligible ? "__Host-gtl_rt" : "gtl_rt";
const csrfCookieName = hostPrefixEligible ? "__Host-gtl_csrf" : "gtl_csrf";

export const authConfig = {
    accessTokenSecret: serverEnv.AUTH_ACCESS_TOKEN_SECRET,
    accessTokenTtlSeconds: serverEnv.AUTH_ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlSeconds: serverEnv.AUTH_REFRESH_TOKEN_TTL_SECONDS,
    csrfCookieTtlSeconds: serverEnv.AUTH_CSRF_COOKIE_TTL_SECONDS,
    dataDirectory: path.resolve(process.cwd(), serverEnv.AUTH_DATA_DIRECTORY),
    debug: serverEnv.AUTH_DEBUG,
    allowedOrigins: new Set([
        ...defaultLocalDevOrigins,
        ...serverEnv.AUTH_FRONTEND_ORIGINS,
    ]),
    cookies: {
        refresh: {
            name: refreshCookieName,
            path: refreshCookiePath,
            sameSite: cookieSameSite,
            secure: secureCookies,
            httpOnly: true,
            domain: serverEnv.AUTH_COOKIE_DOMAIN || undefined,
            maxAgeSeconds: serverEnv.AUTH_REFRESH_TOKEN_TTL_SECONDS,
        } satisfies CookieDescriptor,
        csrf: {
            name: csrfCookieName,
            path: "/",
            sameSite: cookieSameSite,
            secure: secureCookies,
            httpOnly: false,
            domain: serverEnv.AUTH_COOKIE_DOMAIN || undefined,
            maxAgeSeconds: serverEnv.AUTH_CSRF_COOKIE_TTL_SECONDS,
        } satisfies CookieDescriptor,
        preferences: {
            name: "gtl_pref",
            path: "/",
            sameSite: "lax",
            secure: secureCookies,
            httpOnly: false,
            domain: serverEnv.AUTH_COOKIE_DOMAIN || undefined,
            maxAgeSeconds: 60 * 60 * 24 * 180,
        } satisfies CookieDescriptor,
    },
} as const;
