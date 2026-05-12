import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/app/utils/env";

export function createSupabaseClient() {
    return createBrowserClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
}
