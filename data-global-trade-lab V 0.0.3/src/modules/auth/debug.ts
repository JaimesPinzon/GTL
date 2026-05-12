import { authConfig } from "@/modules/auth/config";

export const debugAuth = (label: string, details: unknown) => {
    if (authConfig.debug) {
        console.info(`[auth-debug] ${label}`, details);
    }
};
