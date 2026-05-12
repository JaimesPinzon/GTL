import { NextRequest } from "next/server";

import { assertAuth } from "@/modules/auth/errors";

const readJsonBody = async (request: NextRequest) => {
    try {
        return await request.json();
    } catch {
        return null;
    }
};

const asTrimmedString = (value: unknown) => String(value || "").trim();

export const parseLoginBody = async (request: NextRequest) => {
    const body = await readJsonBody(request);
    assertAuth(body && typeof body === "object", 400, "Request body must be a valid JSON object.");

    const email = asTrimmedString((body as Record<string, unknown>).email).toLowerCase();
    const password = String((body as Record<string, unknown>).password || "");

    assertAuth(email.length > 0, 400, "Email is required.");
    assertAuth(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 400, "Email format is invalid.");
    assertAuth(password.length > 0, 400, "Password is required.");

    return { email, password };
};

export const parseRegisterBody = async (request: NextRequest) => {
    const body = await readJsonBody(request);
    assertAuth(body && typeof body === "object", 400, "Request body must be a valid JSON object.");

    const name = asTrimmedString((body as Record<string, unknown>).name);
    const email = asTrimmedString((body as Record<string, unknown>).email).toLowerCase();
    const password = String((body as Record<string, unknown>).password || "");
    const role = asTrimmedString((body as Record<string, unknown>).role || "student").toLowerCase();

    assertAuth(name.length >= 2, 400, "Name must contain at least 2 characters.");
    assertAuth(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 400, "Email format is invalid.");
    assertAuth(password.length >= 10, 400, "Password must contain at least 10 characters.");
    assertAuth(["student", "teacher"].includes(role), 400, "Role must be student or teacher.");

    return { name, email, password, role };
};

export const parseChangePasswordBody = async (request: NextRequest) => {
    const body = await readJsonBody(request);
    assertAuth(body && typeof body === "object", 400, "Request body must be a valid JSON object.");

    const currentPassword = String((body as Record<string, unknown>).currentPassword || "");
    const newPassword = String((body as Record<string, unknown>).newPassword || "");

    assertAuth(currentPassword.length > 0, 400, "Current password is required.");
    assertAuth(newPassword.length >= 10, 400, "New password must contain at least 10 characters.");
    assertAuth(currentPassword !== newPassword, 400, "New password must be different from the current password.");

    return { currentPassword, newPassword };
};
