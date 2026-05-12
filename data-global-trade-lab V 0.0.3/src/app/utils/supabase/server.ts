import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/app/utils/env";

export async function createSupabaseClient() {
    const cookiesStore = await cookies();

    return createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return cookiesStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookiesStore.set(name, value, options);
                        });
                    } catch {
                        // Server Components cannot always write cookies.
                    }
                },
            },
        }
    );
}
