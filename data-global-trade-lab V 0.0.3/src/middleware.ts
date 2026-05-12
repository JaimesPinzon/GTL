import type { NextRequest } from "next/server";
import { updateSession } from "@/app/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
    return updateSession(request);
}

export const config = {
    // Las APIs ya controlan auth, cookies y CORS por su cuenta; pasarlas por el middleware
    // SSR de Supabase introduce fallos transversales y no aporta seguridad aquí.
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
