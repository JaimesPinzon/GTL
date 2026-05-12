import { NextResponse } from "next/server";
import { createAuthenticatedSupabaseClient } from "@/app/utils/supabase/auth-user";
import { supabaseAdmin } from "@/app/utils/supabase/admin";

function getBearerToken(request: Request) {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
        return null;
    }

    return authorization.slice("Bearer ".length);
}

export async function DELETE(request: Request) {
    const accessToken = getBearerToken(request);

    if (!accessToken) {
        return NextResponse.json({ ok: false, error: "Missing access token" }, { status: 401 });
    }

    const supabase = createAuthenticatedSupabaseClient(accessToken);
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
