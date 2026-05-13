import { assertAuth, AuthHttpError } from "@/modules/auth/errors";
import {
    createUserRecord,
    getUserByEmail,
    getUserById,
    getOrCreateUserFromSupabaseAccessToken,
    touchUserLogin,
    updateUserPassword,
    verifyUserCredentials,
} from "@/modules/auth/repositories/users.repository";
import {
    bootstrapCsrfToken,
    revokeRefreshSessionById,
    revokeAllSessionsForUser,
    restoreSessionFromRefreshToken,
    revokeRefreshSession,
    revokeRefreshSessionFamily,
    rotateRefreshSession,
    listActiveSessionsForUser,
} from "@/modules/auth/services/auth-sessions.service";
import { createSessionPayload } from "@/modules/auth/services/internal-session-factory";
import { normalizeEmail, normalizeRole, sanitizeUser } from "@/modules/auth/services/auth-users.service";
import { verifyAccessToken } from "@/modules/auth/services/auth-tokens.service";
import { AuthRequestMeta } from "@/modules/auth/types";

export const registerUser = async (
    input: { name: string; email: string; password: string; role: string } & AuthRequestMeta
) => {
    const normalizedEmail = normalizeEmail(input.email);

    assertAuth(String(input.name || "").trim().length >= 2, 400, "Name must contain at least 2 characters.");
    assertAuth(String(input.password || "").length >= 10, 400, "Password must contain at least 10 characters.");

    const existingUser = await getUserByEmail(normalizedEmail);
    assertAuth(!existingUser, 409, "An account with that email already exists.");

    const user = await createUserRecord({
        email: normalizedEmail,
        password: input.password,
        name: String(input.name || "").trim(),
        role: normalizeRole(input.role),
        balance: 100000,
        initialBalance: 100000,
    });
    return createSessionPayload(user, input);
};

export const loginUser = async (input: { email: string; password: string } & AuthRequestMeta) => {
    const user = await verifyUserCredentials(normalizeEmail(input.email), input.password);
    if (!user || !user.isActive) {
        throw new AuthHttpError(401, "Invalid email or password.");
    }

    await touchUserLogin(user.id);
    return createSessionPayload(user, input);
};

export const loginUserWithSupabaseAccessToken = async (
    input: { accessToken: string } & AuthRequestMeta
) => {
    assertAuth(String(input.accessToken || "").trim().length > 0, 400, "Access token is required.");

    const user = await getOrCreateUserFromSupabaseAccessToken(input.accessToken);
    if (!user || !user.isActive) {
        throw new AuthHttpError(401, "Supabase access token is invalid.");
    }

    await touchUserLogin(user.id);
    return createSessionPayload(user, input);
};

export const issueBootstrapCsrf = bootstrapCsrfToken;
export const restoreUserSession = restoreSessionFromRefreshToken;
export const refreshUserSession = rotateRefreshSession;
export const logoutUserSession = revokeRefreshSession;
export const logoutAllUserSessions = revokeRefreshSessionFamily;

export const getAuthenticatedUser = async (accessToken: string) => {
    const payload = verifyAccessToken(accessToken);
    assertAuth(payload.type === "access", 401, "Invalid access token type.");

    const user = await getUserById(payload.sub);
    if (!user) {
        throw new AuthHttpError(401, "Authenticated user no longer exists.");
    }

    return sanitizeUser(user);
};

const getVerifiedPayload = (accessToken: string) => {
    const payload = verifyAccessToken(accessToken);
    assertAuth(payload.type === "access", 401, "Invalid access token type.");
    return payload;
};

export const getAuthenticatedSessions = async (accessToken: string) => {
    const payload = getVerifiedPayload(accessToken);
    return listActiveSessionsForUser(payload.sub, payload.sid);
};

export const revokeAuthenticatedSession = async (accessToken: string, sessionId: string) => {
    const payload = getVerifiedPayload(accessToken);
    assertAuth(sessionId, 400, "Session id is required.");
    return revokeRefreshSessionById(payload.sub, sessionId);
};

export const changeAuthenticatedPassword = async (
    accessToken: string,
    currentPassword: string,
    newPassword: string
) => {
    const payload = getVerifiedPayload(accessToken);
    const user = await getUserById(payload.sub);
    if (!user) {
        throw new AuthHttpError(401, "Authenticated user no longer exists.");
    }

    const passwordMatches = await verifyUserCredentials(user.email, currentPassword);
    assertAuth(passwordMatches, 401, "Current password is invalid.");

    await updateUserPassword(user.id, newPassword);
    await revokeAllSessionsForUser(user.id, "password_changed");

    return { ok: true };
};
