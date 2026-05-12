import "server-only";

import { createClient } from "@supabase/supabase-js";
import { env, serverEnv } from "@/app/utils/env";

export const supabaseAdmin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);
