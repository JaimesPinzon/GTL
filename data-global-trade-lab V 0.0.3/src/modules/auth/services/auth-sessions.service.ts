import { authConfig } from "@/modules/auth/config";
import { debugAuth } from "@/modules/auth/debug";
import { assertAuth, AuthHttpError } from "@/modules/auth/errors";
import { decryptSessionSecret, deriveCsrfToken, nowIso, randomToken, sha256 } from "@/modules/auth/lib/crypto";
import {
    findSessionById,
    findSessionByTokenHash,
    listSessionsForUser,
    revokeAllSessionsByUser,
    revokeSessionByIdForUser,
    revokeSessionByTokenHash,
    revokeSessionFamilyByTokenHash,
    rotateSessionAtomically,
    touchSessionCsrf,
} from "@/modules/auth/repositories/sessions.repository";
import { getUserById } from "@/modules/auth/repositories/users.repository";
import {
    createAccessTokenPayload,
    createRefreshSessionDraft,
    createSessionPayloadFromDraft,
} from "@/modules/auth/services/internal-session-factory";
import { AuthSessionPayload, RefreshSessionRecord } from "@/modules/auth/types";

const isWithinReuseInterval = (session: RefreshSessionRecord) => {
    if (session.revokedReason !== "rotated" || !session.revokedAt || !session.replacedBySessionId) return false;
    return Date.now() - new Date(session.revokedAt).getTime() <= authConfig.refreshReuseIntervalSeconds * 1000;
};

const readReplacementSecrets = async (session: RefreshSessionRecord) => {
    if (!isWithinReuseInterval(session) || !session.replacedBySessionId) return null;
    const replacement = await findSessionById(session.replacedBySessionId);
    if (
        !replacement ||
        replacement.revokedAt ||
        !replacement.refreshTokenCiphertext ||
        !replacement.csrfTokenCiphertext
    ) {
        return null;
    }

    return {
        session: replacement,
        refreshToken: decryptSessionSecret(replacement.refreshTokenCiphertext, authConfig.accessTokenSecret),
        csrfToken: decryptSessionSecret(replacement.csrfTokenCiphertext, authConfig.accessTokenSecret),
    };
};

const buildStoredSessionPayload = async (
    session: RefreshSessionRecord,
    refreshToken: string,
    csrfToken: string
): Promise<AuthSessionPayload> => {
    const user = await getUserById(session.userId);
    if (!user) throw new AuthHttpError(401, "Authenticated user no longer exists.");

    return {
        ...createAccessTokenPayload(user, session.id),
        refreshToken,
        csrfToken,
        sessionId: session.id,
    };
};

export const bootstrapCsrfToken = async (refreshToken: string, existingCsrfToken = "") => {
    if (!refreshToken) return { csrfToken: existingCsrfToken || randomToken(24) };

    const csrfToken = deriveCsrfToken(refreshToken, authConfig.accessTokenSecret);
    const session = await findSessionByTokenHash(sha256(refreshToken));
    if (session && !session.revokedAt && !session.replacedBySessionId) {
        await touchSessionCsrf(session.id, sha256(csrfToken), nowIso());
    }

    return { csrfToken };
};

export const restoreSessionFromRefreshToken = async (input: {
    refreshToken: string;
    userAgent: string;
    ipAddress: string;
}) => {
    try {
        assertAuth(input.refreshToken, 401, "Refresh cookie is missing.");
        const session = await findSessionByTokenHash(sha256(input.refreshToken));
        if (!session) throw new AuthHttpError(401, "Refresh token is invalid.");

        const replay = await readReplacementSecrets(session);
        if (replay) {
            return buildStoredSessionPayload(replay.session, replay.refreshToken, replay.csrfToken);
        }

        assertAuth(!session.revokedAt && !session.replacedBySessionId, 401, "Refresh token reuse detected. Session family revoked.");
        assertAuth(new Date(session.expiresAt).getTime() > Date.now(), 401, "Refresh token expired.");

        const csrfToken = deriveCsrfToken(input.refreshToken, authConfig.accessTokenSecret);
        const updated = await touchSessionCsrf(session.id, sha256(csrfToken), nowIso());
        assertAuth(updated, 409, "Refresh session changed concurrently. Retry the request.", {
            code: "REFRESH_CONCURRENT_RETRY",
        });
        return buildStoredSessionPayload(session, input.refreshToken, csrfToken);
    } catch (error) {
        if (error instanceof AuthHttpError) throw error;
        debugAuth("restore:unexpected-error", {
            message: error instanceof Error ? error.message : String(error),
        });
        throw new AuthHttpError(401, "Refresh token is invalid.");
    }
};

export const rotateRefreshSession = async (input: {
    refreshToken: string;
    csrfToken: string;
    userAgent: string;
    ipAddress: string;
}) => {
    debugAuth("refresh:input", {
        hasRefreshCookie: Boolean(input.refreshToken),
        csrfHeaderPresent: Boolean(input.csrfToken),
    });

    assertAuth(input.refreshToken, 401, "Refresh cookie is missing.");
    assertAuth(input.csrfToken, 403, "CSRF token is missing.");

    const draft = createRefreshSessionDraft(input);
    const result = await rotateSessionAtomically({
        currentTokenHash: sha256(input.refreshToken),
        currentCsrfTokenHash: sha256(input.csrfToken),
        draft,
        reuseIntervalSeconds: authConfig.refreshReuseIntervalSeconds,
    });

    debugAuth("refresh:atomic-result", {
        outcome: result.outcome,
        sessionId: result.sessionId,
    });

    if (result.outcome === "missing") throw new AuthHttpError(401, "Refresh token is invalid.");
    if (result.outcome === "csrf_mismatch") throw new AuthHttpError(403, "CSRF validation failed.");
    if (result.outcome === "expired") throw new AuthHttpError(401, "Refresh token expired.");
    if (result.outcome === "reused") {
        throw new AuthHttpError(401, "Refresh token reuse detected. Session family revoked.");
    }
    if (result.outcome === "retry" || !result.sessionId || !result.userId) {
        throw new AuthHttpError(409, "Refresh session changed concurrently. Retry the request.", {
            code: "REFRESH_CONCURRENT_RETRY",
            retryAfterMs: 150,
        });
    }

    const user = await getUserById(result.userId);
    if (!user) throw new AuthHttpError(401, "Authenticated user no longer exists.");

    if (result.outcome === "rotated") return createSessionPayloadFromDraft(user, draft);

    if (!result.refreshTokenCiphertext || !result.csrfTokenCiphertext) {
        throw new AuthHttpError(409, "Refresh session changed concurrently. Retry the request.", {
            code: "REFRESH_CONCURRENT_RETRY",
            retryAfterMs: 150,
        });
    }
    const refreshToken = decryptSessionSecret(result.refreshTokenCiphertext, authConfig.accessTokenSecret);
    const csrfToken = decryptSessionSecret(result.csrfTokenCiphertext, authConfig.accessTokenSecret);
    return {
        ...createAccessTokenPayload(user, result.sessionId),
        refreshToken,
        csrfToken,
        sessionId: result.sessionId,
    };
};

export const revokeRefreshSession = async (refreshToken: string) => {
    if (!refreshToken) return;
    await revokeSessionByTokenHash(sha256(refreshToken), "logout", nowIso());
};

export const revokeRefreshSessionFamily = async (refreshToken: string) => {
    if (!refreshToken) return;
    await revokeSessionFamilyByTokenHash(sha256(refreshToken), "logout_all", nowIso());
};

export const listActiveSessionsForUser = async (userId: string, currentSessionId?: string) => {
    const sessions = await listSessionsForUser(userId);
    return sessions
        .filter((entry) => !entry.revokedAt && new Date(entry.expiresAt).getTime() > Date.now())
        .sort((left, right) => (left.lastUsedAt < right.lastUsedAt ? 1 : -1))
        .map((entry) => ({
            id: entry.id,
            createdAt: entry.createdAt,
            lastUsedAt: entry.lastUsedAt,
            expiresAt: entry.expiresAt,
            userAgent: entry.userAgent,
            ipAddress: entry.ipAddress,
            current: entry.id === currentSessionId,
        }));
};

export const revokeRefreshSessionById = (userId: string, sessionId: string) =>
    revokeSessionByIdForUser(userId, sessionId, "device_logout", nowIso());

export const revokeAllSessionsForUser = (userId: string, reason = "security_event") =>
    revokeAllSessionsByUser(userId, reason, nowIso());
