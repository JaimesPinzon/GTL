import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { env, serverEnv } from "@/app/utils/env";
import { supabaseAdmin } from "@/app/utils/supabase/admin";
import { nowIso, randomId } from "@/modules/auth/lib/crypto";
import { hashPassword, verifyPassword } from "@/modules/auth/lib/passwords";
import { readCollection, writeCollection } from "@/modules/auth/repositories/file-store";
import { AuthUserRecord } from "@/modules/auth/types";

const usersFile = path.join(process.cwd(), serverEnv.AUTH_DATA_DIRECTORY, "users.json");

type ProfileRow = {
    user_id: string;
    email: string | null;
    name: string | null;
    role: string | null;
    created_at: string | null;
    updated_at: string | null;
};

const usesSupabaseUsers = serverEnv.AUTH_USERS_STORE === "supabase";

const createPasswordAuthClient = () =>
    createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
        },
    });

const readFileUsers = async () => {
    const users = await readCollection<AuthUserRecord>(usersFile, "users");
    return users.map((user) => ({
        ...user,
        isActive: user.isActive ?? true,
    }));
};

const writeFileUsers = (users: AuthUserRecord[]) => writeCollection(usersFile, "users", users);

const mapSupabaseProfileToAuthUser = (
    profile: ProfileRow,
    authUser?: { last_sign_in_at?: string | null; email?: string | null }
): AuthUserRecord => ({
    id: profile.user_id,
    email: profile.email || authUser?.email || "",
    passwordHash: "",
    name: profile.name || "",
    role: profile.role || "student",
    createdAt: profile.created_at || nowIso(),
    updatedAt: profile.updated_at || nowIso(),
    lastLoginAt: authUser?.last_sign_in_at || profile.updated_at || profile.created_at || nowIso(),
    // Trading balances are now room-scoped (room_members / room_group_members),
    // not profile-scoped. Keep auth payload defaults for compatibility.
    balance: 100000,
    initialBalance: 100000,
    isActive: true,
});

const getSupabaseProfileById = async (userId: string) => {
    const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("user_id,email,name,role,created_at,updated_at")
        .eq("user_id", userId)
        .maybeSingle<ProfileRow>();

    if (error) {
        throw error;
    }

    return data;
};

const getSupabaseProfileByEmail = async (email: string) => {
    const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("user_id,email,name,role,created_at,updated_at")
        .eq("email", email)
        .maybeSingle<ProfileRow>();

    if (error) {
        throw error;
    }

    return data;
};

export const getUserById = async (userId: string): Promise<AuthUserRecord | null> => {
    if (!usesSupabaseUsers) {
        const users = await readFileUsers();
        return users.find((entry) => entry.id === userId) || null;
    }

    const profile = await getSupabaseProfileById(userId);
    if (!profile) {
        return null;
    }

    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error) {
        if (String(error.message || "").toLowerCase().includes("user not found")) {
            return null;
        }
        throw error;
    }

    return mapSupabaseProfileToAuthUser(profile, data.user);
};

export const getUserByEmail = async (email: string): Promise<AuthUserRecord | null> => {
    if (!usesSupabaseUsers) {
        const users = await readFileUsers();
        return users.find((entry) => entry.email === email) || null;
    }

    const profile = await getSupabaseProfileByEmail(email);
    if (!profile) {
        return null;
    }

    return getUserById(profile.user_id);
};

export const getOrCreateUserFromSupabaseAccessToken = async (accessToken: string): Promise<AuthUserRecord | null> => {
    if (!usesSupabaseUsers) {
        return null;
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    if (authError || !authData.user) {
        return null;
    }

    const supabaseUser = authData.user;
    const existingUser = await getUserById(supabaseUser.id);
    if (existingUser) {
        return existingUser;
    }

    const email = String(supabaseUser.email || "").trim().toLowerCase();
    if (!email) {
        return null;
    }

    const metadata = (supabaseUser.user_metadata || {}) as Record<string, unknown>;
    const nameFromMetadata = String(metadata.name || metadata.full_name || "").trim();
    const defaultName = email.split("@")[0] || "User";
    const role = String(metadata.role || "").trim().toLowerCase() === "teacher" ? "teacher" : "student";
    const { error: upsertError } = await supabaseAdmin.from("profiles").upsert({
        user_id: supabaseUser.id,
        email,
        name: nameFromMetadata || defaultName,
        role,
    });

    if (upsertError) {
        throw upsertError;
    }

    return getUserById(supabaseUser.id);
};

export const createUserRecord = async (input: {
    email: string;
    password: string;
    name: string;
    role: string;
    balance: number;
    initialBalance: number;
}): Promise<AuthUserRecord> => {
    if (!usesSupabaseUsers) {
        const users = await readFileUsers();
        const createdAt = nowIso();
        const user: AuthUserRecord = {
            id: randomId(),
            email: input.email,
            passwordHash: await hashPassword(input.password),
            name: input.name,
            role: input.role,
            createdAt,
            updatedAt: createdAt,
            lastLoginAt: createdAt,
            balance: input.balance,
            initialBalance: input.initialBalance,
            isActive: true,
        };
        users.push(user);
        await writeFileUsers(users);
        return user;
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
            name: input.name,
            role: input.role,
            balance: input.balance,
            initialBalance: input.initialBalance,
        },
    });

    if (error || !data.user) {
        throw error || new Error("Failed to create auth user.");
    }

    const { error: upsertError } = await supabaseAdmin.from("profiles").upsert({
        user_id: data.user.id,
        email: input.email,
        name: input.name,
        role: input.role,
    });

    if (upsertError) {
        throw upsertError;
    }

    return (await getUserById(data.user.id)) as AuthUserRecord;
};

export const verifyUserCredentials = async (email: string, password: string): Promise<AuthUserRecord | null> => {
    if (!usesSupabaseUsers) {
        const users = await readFileUsers();
        const user = users.find((entry) => entry.email === email);
        if (!user || !user.isActive) {
            return null;
        }

        const passwordMatches = await verifyPassword(password, user.passwordHash);
        return passwordMatches ? user : null;
    }

    const authClient = createPasswordAuthClient();
    const { data, error } = await authClient.auth.signInWithPassword({
        email,
        password,
    });

    if (error || !data.user) {
        return null;
    }

    return getUserById(data.user.id);
};

export const touchUserLogin = async (userId: string) => {
    if (!usesSupabaseUsers) {
        const users = await readFileUsers();
        const user = users.find((entry) => entry.id === userId);
        if (!user) {
            return;
        }

        user.lastLoginAt = nowIso();
        user.updatedAt = nowIso();
        await writeFileUsers(users);
        return;
    }

    await supabaseAdmin.from("profiles").update({ updated_at: nowIso() }).eq("user_id", userId);
};

export const updateUserPassword = async (userId: string, newPassword: string) => {
    if (!usesSupabaseUsers) {
        const users = await readFileUsers();
        const user = users.find((entry) => entry.id === userId);
        if (!user) {
            return;
        }

        user.passwordHash = await hashPassword(newPassword);
        user.updatedAt = nowIso();
        await writeFileUsers(users);
        return;
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
    });

    if (error) {
        throw error;
    }
};
