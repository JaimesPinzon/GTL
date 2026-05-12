function getEnvVariable(key: string) {
    const value = process.env[key];

    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }

    return value;
}

function getOptionalEnvVariable(key: string, fallback = "") {
    const value = process.env[key]?.trim();
    return value || fallback;
}

function getEnumEnvVariable<T extends string>(key: string, allowedValues: T[], fallback: T) {
    const value = getOptionalEnvVariable(key, fallback).toLowerCase() as T;
    return allowedValues.includes(value) ? value : fallback;
}

function getBooleanEnvVariable(key: string, fallback = false) {
    const value = getOptionalEnvVariable(key);
    if (!value) {
        return fallback;
    }

    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function getNumberEnvVariable(key: string, fallback: number) {
    const parsed = Number.parseInt(getOptionalEnvVariable(key), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getOriginsEnvVariable(key: string, fallback: string[]) {
    const value = getOptionalEnvVariable(key);
    if (!value) {
        return fallback;
    }

    return value
        .split(",")
        .map((entry) => entry.trim().replace(/\/$/, ""))
        .filter(Boolean);
}

export const env = {
    NEXT_PUBLIC_SUPABASE_URL: getEnvVariable("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: getEnvVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
};

export const serverEnv = {
    TWELVEDATA_API_KEY: getEnvVariable("TWELVEDATA_API_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: getEnvVariable("SUPABASE_SERVICE_ROLE_KEY"),
    AUTH_FRONTEND_ORIGINS: getOriginsEnvVariable("AUTH_FRONTEND_ORIGINS", ["http://localhost:5173"]),
    AUTH_ACCESS_TOKEN_SECRET: getEnvVariable("AUTH_ACCESS_TOKEN_SECRET"),
    AUTH_ACCESS_TOKEN_TTL_SECONDS: getNumberEnvVariable("AUTH_ACCESS_TOKEN_TTL_SECONDS", 900),
    AUTH_REFRESH_TOKEN_TTL_SECONDS: getNumberEnvVariable("AUTH_REFRESH_TOKEN_TTL_SECONDS", 60 * 60 * 24 * 30),
    AUTH_CSRF_COOKIE_TTL_SECONDS: getNumberEnvVariable("AUTH_CSRF_COOKIE_TTL_SECONDS", 86400),
    AUTH_COOKIE_DOMAIN: getOptionalEnvVariable("AUTH_COOKIE_DOMAIN"),
    AUTH_COOKIE_SAME_SITE: getOptionalEnvVariable("AUTH_COOKIE_SAME_SITE", "lax"),
    AUTH_COOKIE_SECURE: getBooleanEnvVariable("AUTH_COOKIE_SECURE", false),
    AUTH_USERS_STORE: getEnumEnvVariable("AUTH_USERS_STORE", ["file", "supabase"], "supabase"),
    AUTH_SESSION_STORE: getEnumEnvVariable("AUTH_SESSION_STORE", ["file", "supabase"], "file"),
    AUTH_DATA_DIRECTORY: getOptionalEnvVariable("AUTH_DATA_DIRECTORY", "./data/auth"),
    AUTH_DEBUG: getBooleanEnvVariable("AUTH_DEBUG", false),
};
