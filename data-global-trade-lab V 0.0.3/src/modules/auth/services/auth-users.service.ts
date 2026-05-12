import { AuthUser, AuthUserRecord } from "@/modules/auth/types";

export const normalizeEmail = (email: string) => String(email || "").trim().toLowerCase();
export const normalizeRole = (role: string) => (String(role || "").trim().toLowerCase() === "teacher" ? "teacher" : "student");

export const sanitizeUser = (user: AuthUserRecord): AuthUser => ({
    id: user.id,
    email: user.email,
    created_at: user.createdAt,
    last_sign_in_at: user.lastLoginAt,
    user_metadata: {
        name: user.name,
        role: user.role,
        balance: user.balance,
        initialBalance: user.initialBalance,
    },
});
