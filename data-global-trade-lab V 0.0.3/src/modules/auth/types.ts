export type AuthUserRecord = {
    id: string;
    email: string;
    passwordHash: string;
    name: string;
    role: string;
    createdAt: string;
    updatedAt: string;
    lastLoginAt: string;
    balance: number;
    initialBalance: number;
    isActive: boolean;
};

export type RefreshSessionRecord = {
    id: string;
    userId: string;
    familyId: string;
    tokenHash: string;
    csrfTokenHash: string;
    createdAt: string;
    updatedAt: string;
    lastUsedAt: string;
    expiresAt: string;
    userAgent: string;
    ipAddress: string;
    revokedAt: string | null;
    revokedReason: string | null;
    replacedBySessionId: string | null;
};

export type AuthUser = {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string;
    user_metadata: {
        name: string;
        role: string;
        balance: number;
        initialBalance: number;
    };
};

export type AuthSessionPayload = {
    user: AuthUser;
    accessToken: string;
    accessTokenExpiresIn: number;
    refreshToken: string;
    csrfToken: string;
    sessionId: string;
};

export type AuthRequestMeta = {
    userAgent: string;
    ipAddress: string;
};

export type VerifiedAccessTokenPayload = {
    sub: string;
    type: string;
    sid?: string;
    email?: string;
    role?: string;
    iat: number;
    exp: number;
};

export type CookieDescriptor = {
    name: string;
    path: string;
    sameSite: "lax" | "strict" | "none";
    secure: boolean;
    httpOnly: boolean;
    domain?: string;
    maxAgeSeconds: number;
};
