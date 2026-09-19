import path from "node:path";

import { serverEnv } from "@/app/utils/env";
import { supabaseAdmin } from "@/app/utils/supabase/admin";
import { authConfig } from "@/modules/auth/config";
import { debugAuth } from "@/modules/auth/debug";
import { readCollection, writeCollection } from "@/modules/auth/repositories/file-store";
import { RefreshSessionDraft, RefreshSessionRecord } from "@/modules/auth/types";

const sessionsFile = path.join(authConfig.dataDirectory, "refresh-sessions.json");
const usesSupabaseSessions = serverEnv.AUTH_SESSION_STORE === "supabase";

type SessionRow = {
    id: string;
    user_id: string;
    family_id: string;
    token_hash: string;
    csrf_token_hash: string;
    refresh_token_ciphertext: string | null;
    csrf_token_ciphertext: string | null;
    created_at: string;
    updated_at: string;
    last_used_at: string;
    expires_at: string;
    user_agent: string;
    ip_address: string;
    revoked_at: string | null;
    revoked_reason: string | null;
    replaced_by_session_id: string | null;
};

export type AtomicSessionRotationResult = {
    outcome: "rotated" | "replayed" | "retry" | "missing" | "csrf_mismatch" | "expired" | "reused";
    sessionId: string | null;
    userId: string | null;
    familyId: string | null;
    refreshTokenCiphertext: string | null;
    csrfTokenCiphertext: string | null;
};

type RotationRow = {
    outcome: AtomicSessionRotationResult["outcome"];
    result_session_id: string | null;
    result_user_id: string | null;
    result_family_id: string | null;
    result_refresh_token_ciphertext: string | null;
    result_csrf_token_ciphertext: string | null;
};

type AtomicSessionRotationInput = {
    currentTokenHash: string;
    currentCsrfTokenHash: string;
    draft: RefreshSessionDraft;
    reuseIntervalSeconds: number;
};

const SESSION_COLUMNS = [
    "id",
    "user_id",
    "family_id",
    "token_hash",
    "csrf_token_hash",
    "refresh_token_ciphertext",
    "csrf_token_ciphertext",
    "created_at",
    "updated_at",
    "last_used_at",
    "expires_at",
    "user_agent",
    "ip_address",
    "revoked_at",
    "revoked_reason",
    "replaced_by_session_id",
].join(",");

const mapSessionRowToRecord = (row: SessionRow): RefreshSessionRecord => ({
    id: row.id,
    userId: row.user_id,
    familyId: row.family_id,
    tokenHash: row.token_hash,
    csrfTokenHash: row.csrf_token_hash,
    refreshTokenCiphertext: row.refresh_token_ciphertext || null,
    csrfTokenCiphertext: row.csrf_token_ciphertext || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    userAgent: row.user_agent,
    ipAddress: row.ip_address,
    revokedAt: row.revoked_at,
    revokedReason: row.revoked_reason,
    replacedBySessionId: row.replaced_by_session_id,
});

const mapRecordToSessionRow = (record: RefreshSessionRecord): SessionRow => ({
    id: record.id,
    user_id: record.userId,
    family_id: record.familyId,
    token_hash: record.tokenHash,
    csrf_token_hash: record.csrfTokenHash,
    refresh_token_ciphertext: record.refreshTokenCiphertext,
    csrf_token_ciphertext: record.csrfTokenCiphertext,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    last_used_at: record.lastUsedAt,
    expires_at: record.expiresAt,
    user_agent: record.userAgent,
    ip_address: record.ipAddress,
    revoked_at: record.revokedAt,
    revoked_reason: record.revokedReason,
    replaced_by_session_id: record.replacedBySessionId,
});

const readFileSessions = async () => {
    const sessions = await readCollection<RefreshSessionRecord>(sessionsFile, "sessions");
    return sessions.map((session) => ({
        ...session,
        refreshTokenCiphertext: session.refreshTokenCiphertext || null,
        csrfTokenCiphertext: session.csrfTokenCiphertext || null,
    }));
};
const writeFileSessions = (sessions: RefreshSessionRecord[]) => writeCollection(sessionsFile, "sessions", sessions);

let fileMutationTail: Promise<void> = Promise.resolve();
const withFileMutationLock = async <T>(action: () => Promise<T>) => {
    const previous = fileMutationTail;
    let release = () => {};
    fileMutationTail = new Promise<void>((resolve) => {
        release = resolve;
    });
    await previous;
    try {
        return await action();
    } finally {
        release();
    }
};

const throwRepositoryError = (label: string, error: unknown): never => {
    debugAuth(label, {
        code: typeof error === "object" && error !== null ? (error as { code?: string }).code : undefined,
        message: error instanceof Error ? error.message : String((error as { message?: string })?.message || error),
    });
    throw error;
};

export const insertSession = async (record: RefreshSessionRecord) => {
    if (!usesSupabaseSessions) {
        return withFileMutationLock(async () => {
            const sessions = await readFileSessions();
            sessions.push(record);
            await writeFileSessions(sessions);
        });
    }

    const { error } = await supabaseAdmin.from("auth_refresh_sessions").insert(mapRecordToSessionRow(record));
    if (error) throwRepositoryError("sessions:insert-error", error);
};

export const findSessionByTokenHash = async (tokenHash: string) => {
    if (!usesSupabaseSessions) {
        const sessions = await readFileSessions();
        return sessions.find((entry) => entry.tokenHash === tokenHash) || null;
    }

    const { data, error } = await supabaseAdmin
        .from("auth_refresh_sessions")
        .select(SESSION_COLUMNS)
        .eq("token_hash", tokenHash)
        .maybeSingle<SessionRow>();
    if (error) throwRepositoryError("sessions:find-token-error", error);
    return data ? mapSessionRowToRecord(data) : null;
};

export const findSessionById = async (sessionId: string) => {
    if (!usesSupabaseSessions) {
        const sessions = await readFileSessions();
        return sessions.find((entry) => entry.id === sessionId) || null;
    }

    const { data, error } = await supabaseAdmin
        .from("auth_refresh_sessions")
        .select(SESSION_COLUMNS)
        .eq("id", sessionId)
        .maybeSingle<SessionRow>();
    if (error) throwRepositoryError("sessions:find-id-error", error);
    return data ? mapSessionRowToRecord(data) : null;
};

export const touchSessionCsrf = async (sessionId: string, csrfTokenHash: string, usedAt: string) => {
    if (!usesSupabaseSessions) {
        return withFileMutationLock(async () => {
            const sessions = await readFileSessions();
            const session = sessions.find((entry) => entry.id === sessionId);
            if (!session || session.revokedAt || session.replacedBySessionId) return false;
            session.csrfTokenHash = csrfTokenHash;
            session.updatedAt = usedAt;
            session.lastUsedAt = usedAt;
            await writeFileSessions(sessions);
            return true;
        });
    }

    const { data, error } = await supabaseAdmin
        .from("auth_refresh_sessions")
        .update({ csrf_token_hash: csrfTokenHash, updated_at: usedAt, last_used_at: usedAt })
        .eq("id", sessionId)
        .is("revoked_at", null)
        .is("replaced_by_session_id", null)
        .select("id")
        .maybeSingle<{ id: string }>();
    if (error) throwRepositoryError("sessions:touch-csrf-error", error);
    return Boolean(data?.id);
};

export const rotateSessionAtomically = async (
    input: AtomicSessionRotationInput
): Promise<AtomicSessionRotationResult> => {
    if (!usesSupabaseSessions) {
        return withFileMutationLock(async () => {
            const sessions = await readFileSessions();
            const current = sessions.find((entry) => entry.tokenHash === input.currentTokenHash);
            if (!current) {
                return { outcome: "missing", sessionId: null, userId: null, familyId: null, refreshTokenCiphertext: null, csrfTokenCiphertext: null };
            }
            if (current.csrfTokenHash !== input.currentCsrfTokenHash) {
                return { outcome: "csrf_mismatch", sessionId: current.id, userId: current.userId, familyId: current.familyId, refreshTokenCiphertext: null, csrfTokenCiphertext: null };
            }
            if (new Date(current.expiresAt).getTime() <= Date.now()) {
                return { outcome: "expired", sessionId: current.id, userId: current.userId, familyId: current.familyId, refreshTokenCiphertext: null, csrfTokenCiphertext: null };
            }
            if (!current.revokedAt && !current.replacedBySessionId) {
                const replacement: RefreshSessionRecord = {
                    id: input.draft.sessionId,
                    userId: current.userId,
                    familyId: current.familyId,
                    tokenHash: input.draft.tokenHash,
                    csrfTokenHash: input.draft.csrfTokenHash,
                    refreshTokenCiphertext: input.draft.refreshTokenCiphertext,
                    csrfTokenCiphertext: input.draft.csrfTokenCiphertext,
                    createdAt: input.draft.createdAt,
                    updatedAt: input.draft.createdAt,
                    lastUsedAt: input.draft.createdAt,
                    expiresAt: input.draft.expiresAt,
                    userAgent: input.draft.userAgent,
                    ipAddress: input.draft.ipAddress,
                    revokedAt: null,
                    revokedReason: null,
                    replacedBySessionId: null,
                };
                sessions.push(replacement);
                current.revokedAt = input.draft.createdAt;
                current.revokedReason = "rotated";
                current.replacedBySessionId = replacement.id;
                current.updatedAt = input.draft.createdAt;
                current.lastUsedAt = input.draft.createdAt;
                await writeFileSessions(sessions);
                return {
                    outcome: "rotated",
                    sessionId: replacement.id,
                    userId: replacement.userId,
                    familyId: replacement.familyId,
                    refreshTokenCiphertext: replacement.refreshTokenCiphertext,
                    csrfTokenCiphertext: replacement.csrfTokenCiphertext,
                };
            }

            const reuseAge = Date.now() - new Date(current.revokedAt || 0).getTime();
            if (
                current.revokedReason === "rotated" &&
                current.replacedBySessionId &&
                reuseAge <= input.reuseIntervalSeconds * 1000
            ) {
                const replacement = sessions.find((entry) => entry.id === current.replacedBySessionId);
                if (replacement && !replacement.revokedAt && replacement.refreshTokenCiphertext && replacement.csrfTokenCiphertext) {
                    return {
                        outcome: "replayed",
                        sessionId: replacement.id,
                        userId: replacement.userId,
                        familyId: replacement.familyId,
                        refreshTokenCiphertext: replacement.refreshTokenCiphertext,
                        csrfTokenCiphertext: replacement.csrfTokenCiphertext,
                    };
                }
                return { outcome: "retry", sessionId: current.replacedBySessionId, userId: current.userId, familyId: current.familyId, refreshTokenCiphertext: null, csrfTokenCiphertext: null };
            }

            const revokedAt = new Date().toISOString();
            sessions.forEach((entry) => {
                if (entry.familyId === current.familyId && !entry.revokedAt) {
                    entry.revokedAt = revokedAt;
                    entry.revokedReason = "reuse_detected";
                    entry.updatedAt = revokedAt;
                }
            });
            await writeFileSessions(sessions);
            return { outcome: "reused", sessionId: current.id, userId: current.userId, familyId: current.familyId, refreshTokenCiphertext: null, csrfTokenCiphertext: null };
        });
    }

    const { data, error } = await supabaseAdmin.rpc("rotate_auth_refresh_session", {
        p_current_token_hash: input.currentTokenHash,
        p_current_csrf_token_hash: input.currentCsrfTokenHash,
        p_new_session_id: input.draft.sessionId,
        p_new_token_hash: input.draft.tokenHash,
        p_new_csrf_token_hash: input.draft.csrfTokenHash,
        p_new_refresh_token_ciphertext: input.draft.refreshTokenCiphertext,
        p_new_csrf_token_ciphertext: input.draft.csrfTokenCiphertext,
        p_expires_at: input.draft.expiresAt,
        p_user_agent: input.draft.userAgent,
        p_ip_address: input.draft.ipAddress,
        p_reuse_interval_seconds: input.reuseIntervalSeconds,
    }).single<RotationRow>();
    if (error) throwRepositoryError("sessions:atomic-rotate-error", error);
    if (!data) throw new Error("Atomic refresh rotation returned no result.");

    return {
        outcome: data.outcome,
        sessionId: data.result_session_id,
        userId: data.result_user_id,
        familyId: data.result_family_id,
        refreshTokenCiphertext: data.result_refresh_token_ciphertext,
        csrfTokenCiphertext: data.result_csrf_token_ciphertext,
    };
};

export const revokeSessionByTokenHash = async (tokenHash: string, reason: string, revokedAt: string) => {
    if (!usesSupabaseSessions) {
        return withFileMutationLock(async () => {
            const sessions = await readFileSessions();
            const session = sessions.find((entry) => entry.tokenHash === tokenHash && !entry.revokedAt);
            if (!session) return;
            session.revokedAt = revokedAt;
            session.revokedReason = reason;
            session.updatedAt = revokedAt;
            await writeFileSessions(sessions);
        });
    }

    const { error } = await supabaseAdmin
        .from("auth_refresh_sessions")
        .update({ revoked_at: revokedAt, revoked_reason: reason, updated_at: revokedAt })
        .eq("token_hash", tokenHash)
        .is("revoked_at", null);
    if (error) throwRepositoryError("sessions:revoke-token-error", error);
};

const revokeAllSessionsByFilter = async (
    filter: { familyId?: string; userId?: string },
    reason: string,
    revokedAt: string
) => {
    if (!usesSupabaseSessions) {
        return withFileMutationLock(async () => {
            const sessions = await readFileSessions();
            let changed = false;
            sessions.forEach((entry) => {
                const matches = filter.familyId ? entry.familyId === filter.familyId : entry.userId === filter.userId;
                if (matches && !entry.revokedAt) {
                    entry.revokedAt = revokedAt;
                    entry.revokedReason = reason;
                    entry.updatedAt = revokedAt;
                    changed = true;
                }
            });
            if (changed) await writeFileSessions(sessions);
        });
    }

    let query = supabaseAdmin
        .from("auth_refresh_sessions")
        .update({ revoked_at: revokedAt, revoked_reason: reason, updated_at: revokedAt })
        .is("revoked_at", null);
    query = filter.familyId ? query.eq("family_id", filter.familyId) : query.eq("user_id", filter.userId || "");
    const { error } = await query;
    if (error) throwRepositoryError("sessions:revoke-filter-error", error);
};

export const revokeSessionFamilyByTokenHash = async (tokenHash: string, reason: string, revokedAt: string) => {
    const session = await findSessionByTokenHash(tokenHash);
    if (!session) return;
    return revokeAllSessionsByFilter({ familyId: session.familyId }, reason, revokedAt);
};

export const listSessionsForUser = async (userId: string) => {
    if (!usesSupabaseSessions) {
        const sessions = await readFileSessions();
        return sessions.filter((entry) => entry.userId === userId);
    }

    const { data, error } = await supabaseAdmin
        .from("auth_refresh_sessions")
        .select(SESSION_COLUMNS)
        .eq("user_id", userId)
        .returns<SessionRow[]>();
    if (error) throwRepositoryError("sessions:list-user-error", error);
    return (data || []).map(mapSessionRowToRecord);
};

export const revokeSessionByIdForUser = async (userId: string, sessionId: string, reason: string, revokedAt: string) => {
    if (!usesSupabaseSessions) {
        return withFileMutationLock(async () => {
            const sessions = await readFileSessions();
            const session = sessions.find((entry) => entry.id === sessionId && entry.userId === userId && !entry.revokedAt);
            if (!session) return false;
            session.revokedAt = revokedAt;
            session.revokedReason = reason;
            session.updatedAt = revokedAt;
            await writeFileSessions(sessions);
            return true;
        });
    }

    const { data, error } = await supabaseAdmin
        .from("auth_refresh_sessions")
        .update({ revoked_at: revokedAt, revoked_reason: reason, updated_at: revokedAt })
        .eq("id", sessionId)
        .eq("user_id", userId)
        .is("revoked_at", null)
        .select("id")
        .maybeSingle<{ id: string }>();
    if (error) throwRepositoryError("sessions:revoke-id-error", error);
    return Boolean(data?.id);
};

export const revokeAllSessionsByUser = (userId: string, reason: string, revokedAt: string) =>
    revokeAllSessionsByFilter({ userId }, reason, revokedAt);
