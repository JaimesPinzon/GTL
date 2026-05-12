import { authConfig } from "@/modules/auth/config";
import { nowIso, randomId, randomToken, sha256 } from "@/modules/auth/lib/crypto";
import { readSessions, writeSessions } from "@/modules/auth/repositories/sessions.repository";
import { sanitizeUser } from "@/modules/auth/services/auth-users.service";
import { signAccessToken } from "@/modules/auth/services/auth-tokens.service";
import { AuthRequestMeta, AuthSessionPayload, AuthUserRecord } from "@/modules/auth/types";

// Este factory mantiene consistente la emisión de access token, refresh token y CSRF en todos los flujos.
export const createSessionPayload = async (
    user: AuthUserRecord,
    meta: AuthRequestMeta,
    familyId?: string
): Promise<AuthSessionPayload> => {
    const refreshToken = randomToken(48);
    const csrfToken = randomToken(24);
    const sessionId = randomId();
    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + authConfig.refreshTokenTtlSeconds * 1000).toISOString();
    const sessions = await readSessions();

    sessions.push({
        id: sessionId,
        userId: user.id,
        familyId: familyId || randomId(),
        tokenHash: sha256(refreshToken),
        csrfTokenHash: sha256(csrfToken),
        createdAt,
        updatedAt: createdAt,
        lastUsedAt: createdAt,
        expiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        revokedAt: null,
        revokedReason: null,
        replacedBySessionId: null,
    });

    await writeSessions(sessions);

    return {
        user: sanitizeUser(user),
        accessToken: signAccessToken({
            type: "access",
            sub: user.id,
            email: user.email,
            role: user.role,
            sid: sessionId,
        }),
        accessTokenExpiresIn: authConfig.accessTokenTtlSeconds,
        refreshToken,
        csrfToken,
        sessionId,
    };
};

export const createAccessTokenPayload = (user: AuthUserRecord, sessionId: string) => ({
    user: sanitizeUser(user),
    accessToken: signAccessToken({
        type: "access",
        sub: user.id,
        email: user.email,
        role: user.role,
        sid: sessionId,
    }),
    accessTokenExpiresIn: authConfig.accessTokenTtlSeconds,
});
