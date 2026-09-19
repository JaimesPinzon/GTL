import { authConfig } from "@/modules/auth/config";
import {
    deriveCsrfToken,
    encryptSessionSecret,
    nowIso,
    randomId,
    randomToken,
    sha256,
} from "@/modules/auth/lib/crypto";
import { insertSession } from "@/modules/auth/repositories/sessions.repository";
import { sanitizeUser } from "@/modules/auth/services/auth-users.service";
import { signAccessToken } from "@/modules/auth/services/auth-tokens.service";
import { AuthRequestMeta, AuthSessionPayload, AuthUserRecord, RefreshSessionDraft } from "@/modules/auth/types";

export const createRefreshSessionDraft = (meta: AuthRequestMeta): RefreshSessionDraft => {
    const refreshToken = randomToken(48);
    const csrfToken = deriveCsrfToken(refreshToken, authConfig.accessTokenSecret);
    const createdAt = nowIso();

    return {
        sessionId: randomId(),
        refreshToken,
        csrfToken,
        tokenHash: sha256(refreshToken),
        csrfTokenHash: sha256(csrfToken),
        refreshTokenCiphertext: encryptSessionSecret(refreshToken, authConfig.accessTokenSecret),
        csrfTokenCiphertext: encryptSessionSecret(csrfToken, authConfig.accessTokenSecret),
        createdAt,
        expiresAt: new Date(Date.now() + authConfig.refreshTokenTtlSeconds * 1000).toISOString(),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
    };
};

export const createSessionPayloadFromDraft = (
    user: AuthUserRecord,
    draft: RefreshSessionDraft,
    secrets: { refreshToken?: string; csrfToken?: string } = {}
): AuthSessionPayload => ({
    user: sanitizeUser(user),
    accessToken: signAccessToken({
        type: "access",
        sub: user.id,
        email: user.email,
        role: user.role,
        sid: draft.sessionId,
    }),
    accessTokenExpiresIn: authConfig.accessTokenTtlSeconds,
    refreshToken: secrets.refreshToken || draft.refreshToken,
    csrfToken: secrets.csrfToken || draft.csrfToken,
    sessionId: draft.sessionId,
});

// Este factory mantiene consistente la emisión de access token, refresh token y CSRF en todos los flujos.
export const createSessionPayload = async (
    user: AuthUserRecord,
    meta: AuthRequestMeta,
    familyId?: string
): Promise<AuthSessionPayload> => {
    const draft = createRefreshSessionDraft(meta);
    await insertSession({
        id: draft.sessionId,
        userId: user.id,
        familyId: familyId || randomId(),
        tokenHash: draft.tokenHash,
        csrfTokenHash: draft.csrfTokenHash,
        refreshTokenCiphertext: draft.refreshTokenCiphertext,
        csrfTokenCiphertext: draft.csrfTokenCiphertext,
        createdAt: draft.createdAt,
        updatedAt: draft.createdAt,
        lastUsedAt: draft.createdAt,
        expiresAt: draft.expiresAt,
        userAgent: draft.userAgent,
        ipAddress: draft.ipAddress,
        revokedAt: null,
        revokedReason: null,
        replacedBySessionId: null,
    });
    return createSessionPayloadFromDraft(user, draft);
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
