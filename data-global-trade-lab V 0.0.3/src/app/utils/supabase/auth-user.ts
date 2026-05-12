import "server-only";

import { createClient } from "@supabase/supabase-js";
import { env } from "@/app/utils/env";

export function createAuthenticatedSupabaseClient(accessToken: string) {
    return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        },
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
