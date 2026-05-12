import { assertAuth, AuthHttpError } from "@/modules/auth/errors";
import { debugAuth } from "@/modules/auth/debug";
import { nowIso, randomId, randomToken, sha256 } from "@/modules/auth/lib/crypto";
import { readSessions, writeSessions } from "@/modules/auth/repositories/sessions.repository";
import { getUserById } from "@/modules/auth/repositories/users.repository";
import { createAccessTokenPayload, createSessionPayload } from "@/modules/auth/services/internal-session-factory";

export const bootstrapCsrfToken = async (refreshToken: string) => {
    const csrfToken = randomToken(24);
    if (!refreshToken) {
        return { csrfToken };
    }

    const sessions = await readSessions();
    const session = sessions.find((entry) => entry.tokenHash === sha256(refreshToken) && !entry.revokedAt && !entry.replacedBySessionId);
    if (session) {
        session.csrfTokenHash = sha256(csrfToken);
        session.updatedAt = nowIso();
        await writeSessions(sessions);
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
        const sessions = await readSessions();
        const session = sessions.find((entry) => entry.tokenHash === sha256(input.refreshToken));
        if (!session) {
            throw new AuthHttpError(401, "Refresh token is invalid.");
        }

        assertAuth(!session.revokedAt && !session.replacedBySessionId, 401, "Refresh token reuse detected. Session family revoked.");
        assertAuth(new Date(session.expiresAt).getTime() > Date.now(), 401, "Refresh token expired.");

        const csrfToken = randomToken(24);
        session.updatedAt = nowIso();
        session.lastUsedAt = session.updatedAt;
        session.csrfTokenHash = sha256(csrfToken);
        await writeSessions(sessions);

        const user = await getUserById(session.userId);
        if (!user) {
            throw new AuthHttpError(401, "Authenticated user no longer exists.");
        }

        const accessPayload = createAccessTokenPayload(user, session.id);
        return {
            ...accessPayload,
            refreshToken: input.refreshToken,
            csrfToken,
            sessionId: session.id,
        };
    } catch (error) {
        if (error instanceof AuthHttpError) {
            throw error;
        }

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

    const sessions = await readSessions();
    const session = sessions.find((entry) => entry.tokenHash === sha256(input.refreshToken));

    debugAuth("refresh:session-lookup", {
        sessionFound: Boolean(session),
        sessionId: session?.id || null,
        revokedAt: session?.revokedAt || null,
    });

    if (!session) {
        throw new AuthHttpError(401, "Refresh token is invalid.");
    }

    assertAuth(!session.revokedAt && !session.replacedBySessionId, 401, "Refresh token reuse detected. Session family revoked.");
    assertAuth(new Date(session.expiresAt).getTime() > Date.now(), 401, "Refresh token expired.");

    const csrfMatch = session.csrfTokenHash === sha256(input.csrfToken);
    debugAuth("refresh:csrf-compare", { csrfMatch });
    assertAuth(csrfMatch, 403, "CSRF validation failed.");

    session.revokedAt = nowIso();
    session.revokedReason = "rotated";
    session.updatedAt = nowIso();
    session.replacedBySessionId = randomId();
    await writeSessions(sessions);

    const user = await getUserById(session.userId);
    if (!user) {
        throw new AuthHttpError(401, "Authenticated user no longer exists.");
    }

    return createSessionPayload(user, { userAgent: input.userAgent, ipAddress: input.ipAddress }, session.familyId);
};

export const revokeRefreshSession = async (refreshToken: string) => {
    if (!refreshToken) {
        return;
    }

    const sessions = await readSessions();
    const session = sessions.find((entry) => entry.tokenHash === sha256(refreshToken) && !entry.revokedAt);
    if (!session) {
        return;
    }

    session.revokedAt = nowIso();
    session.revokedReason = "logout";
    session.updatedAt = nowIso();
    await writeSessions(sessions);
};

export const revokeRefreshSessionFamily = async (refreshToken: string) => {
    if (!refreshToken) {
        return;
    }

    const sessions = await readSessions();
    const session = sessions.find((entry) => entry.tokenHash === sha256(refreshToken));
    if (!session) {
        return;
    }

    const now = nowIso();
    sessions.forEach((entry) => {
        if (entry.familyId === session.familyId && !entry.revokedAt) {
            entry.revokedAt = now;
            entry.revokedReason = "logout_all";
            entry.updatedAt = now;
        }
    });

    await writeSessions(sessions);
};

export const listActiveSessionsForUser = async (userId: string, currentSessionId?: string) => {
    const sessions = await readSessions();
    return sessions
        .filter((entry) => entry.userId === userId && !entry.revokedAt && new Date(entry.expiresAt).getTime() > Date.now())
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

export const revokeRefreshSessionById = async (userId: string, sessionId: string) => {
    const sessions = await readSessions();
    const session = sessions.find((entry) => entry.id === sessionId && entry.userId === userId);
    if (!session || session.revokedAt) {
        return false;
    }

    session.revokedAt = nowIso();
    session.revokedReason = "device_logout";
    session.updatedAt = nowIso();
    await writeSessions(sessions);
    return true;
};

export const revokeAllSessionsForUser = async (userId: string, reason = "security_event") => {
    const sessions = await readSessions();
    const now = nowIso();
    let changed = false;

    sessions.forEach((entry) => {
        if (entry.userId === userId && !entry.revokedAt) {
            entry.revokedAt = now;
            entry.revokedReason = reason;
            entry.updatedAt = now;
            changed = true;
        }
    });

    if (changed) {
        await writeSessions(sessions);
    }
};
