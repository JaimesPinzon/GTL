import { env } from "@/lib/env";
import { APP_HOME_PATH } from "@/lib/routes";

export const getOAuthRedirectUrl = () => {
  if (env.VITE_OAUTH_REDIRECT_URL) {
    return env.VITE_OAUTH_REDIRECT_URL;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}${APP_HOME_PATH}`;
  }

  return APP_HOME_PATH;
};

