import path from "node:path";

import { serverEnv } from "@/app/utils/env";
import { supabaseAdmin } from "@/app/utils/supabase/admin";
import { authConfig } from "@/modules/auth/config";
import { debugAuth } from "@/modules/auth/debug";
import { readCollection, writeCollection } from "@/modules/auth/repositories/file-store";
import { RefreshSessionRecord } from "@/modules/auth/types";

const sessionsFile = path.join(authConfig.dataDirectory, "refresh-sessions.json");
const usesSupabaseSessions = serverEnv.AUTH_SESSION_STORE === "supabase";

type SessionRow = {
    id: string;
    user_id: string;
    family_id: string;
    token_hash: string;
    csrf_token_hash: string;
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

const mapSessionRowToRecord = (row: SessionRow): RefreshSessionRecord => ({
    id: row.id,
    userId: row.user_id,
    familyId: row.family_id,
    tokenHash: row.token_hash,
    csrfTokenHash: row.csrf_token_hash,
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

const isMissingSupabaseSessionsTableError = (error: unknown) => {
    const code = typeof error === "object" && error !== null ? String((error as { code?: string }).code || "") : "";
    const message =
        typeof error === "object" && error !== null ? String((error as { message?: string }).message || "") : String(error || "");

    return code === "42P01" || message.toLowerCase().includes("auth_refresh_sessions");
};

const readFileSessions = () => readCollection<RefreshSessionRecord>(sessionsFile, "sessions");
const writeFileSessions = (sessions: RefreshSessionRecord[]) => writeCollection(sessionsFile, "sessions", sessions);

export const readSessions = async () => {
    if (!usesSupabaseSessions) {
        return readFileSessions();
    }

    const { data, error } = await supabaseAdmin
        .from("auth_refresh_sessions")
        .select(
            "id,user_id,family_id,token_hash,csrf_token_hash,created_at,updated_at,last_used_at,expires_at,user_agent,ip_address,revoked_at,revoked_reason,replaced_by_session_id"
        )
        .returns<SessionRow[]>();

    if (error) {
        if (isMissingSupabaseSessionsTableError(error)) {
            debugAuth("sessions:fallback-file-read", {
                reason: "Supabase auth_refresh_sessions table is not available yet.",
            });
            return readFileSessions();
        }
        throw error;
    }

    return (data || []).map(mapSessionRowToRecord);
};

export const writeSessions = async (sessions: RefreshSessionRecord[]) => {
    if (!usesSupabaseSessions) {
        return writeFileSessions(sessions);
    }

    const { error } = await supabaseAdmin
        .from("auth_refresh_sessions")
        .upsert(sessions.map(mapRecordToSessionRow), { onConflict: "id" });

    if (error) {
        if (isMissingSupabaseSessionsTableError(error)) {
            debugAuth("sessions:fallback-file-write", {
                reason: "Supabase auth_refresh_sessions table is not available yet.",
            });
            return writeFileSessions(sessions);
        }
        throw error;
    }
};
