import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import {
  changePassword as changePasswordRequest,
  listSessions,
  loginWithGoogleOAuth,
  loginWithPassword,
  logoutAllSessions,
  logoutSession,
  revokeSessionById,
  registerWithPassword,
} from "@/lib/auth-api";
import {
  buildTradingUser,
  persistClientSecurityExtras,
  readClientSecurityExtras,
  registerSecurityLoginEvent,
  upsertTradingUser,
} from "@/lib/trading-profile";

const getFriendlyAuthErrorMessage = (error, t) => {
  const rawMessage = error instanceof Error ? error.message : String(error || "");
  const normalizedMessage = rawMessage.trim().toLowerCase();

  if (
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("fetch failed") ||
    normalizedMessage.includes("networkerror") ||
    normalizedMessage.includes("load failed")
  ) {
    return t("auth.login.networkError");
  }

  return rawMessage || t("auth.login.genericError");
};

export const useAuthManager = ({
  allUsers,
  setAllUsers,
  setCurrentUserId,
  clearSessionState,
  setConnectionIssue,
  toast,
  syncUserFromAuth,
}) => {
  const { t } = useTranslation();

  const login = useCallback(
    async (loginData) => {
      try {
        setConnectionIssue(null);
        const data = await loginWithPassword({
          email: loginData.email,
          password: loginData.password,
        });

        if (!data.user) {
          toast({
            title: t("auth.login.errorTitle"),
            description: t("auth.login.invalidCredentials"),
            variant: "destructive",
          });
          return { success: false };
        }

        setCurrentUserId(data.user.id);
        setConnectionIssue(null);
        const knownSecurity = readClientSecurityExtras(data.user.id);
        const securityState = registerSecurityLoginEvent(data.user.id, {
          isNewDevice: knownSecurity.activeSessions.length === 0,
        });
        await syncUserFromAuth(data.user);

        if (securityState.notifyNewDevice && securityState.loginHistory[0]?.isNewDevice) {
          toast({
            title: t("auth.login.newDeviceTitle"),
            description: t("auth.login.newDeviceDescription"),
          });
        }

        toast({
          title: t("auth.login.successTitle"),
          description: t("auth.login.successDescription", {
            name: data.user.user_metadata?.name || data.user.email,
          }),
        });

        return { success: true };
      } catch (error) {
        const friendlyMessage = getFriendlyAuthErrorMessage(error, t);
        if (
          friendlyMessage === t("auth.login.networkError") ||
          friendlyMessage === t("auth.login.genericError")
        ) {
          setConnectionIssue({
            title: t("app.connection.networkErrorTitle"),
            description: t("app.connection.networkErrorDescription"),
            details: error instanceof Error ? error.message : String(error || ""),
          });
        }
        toast({
          title: t("auth.login.errorTitle"),
          description: friendlyMessage,
          variant: "destructive",
        });
        return { success: false };
      }
    },
    [setConnectionIssue, setCurrentUserId, syncUserFromAuth, t, toast]
  );

  const loginWithGoogle = useCallback(async () => {
    try {
      setConnectionIssue(null);
      await loginWithGoogleOAuth();
      return { success: true, redirecting: true };
    } catch (error) {
      const friendlyMessage = getFriendlyAuthErrorMessage(error, t);
      toast({
        title: t("auth.login.errorTitle"),
        description: friendlyMessage,
        variant: "destructive",
      });
      return { success: false };
    }
  }, [setConnectionIssue, t, toast]);

  const logout = useCallback(async () => {
    clearSessionState();

    toast({
      title: t("common.actions.logOut"),
      description: t("navigation.header.logoutAriaLabel"),
    });

    Promise.resolve()
      .then(async () => {
        try {
          await logoutSession();
        } catch (error) {
          console.error("logout signOut error", error);
        }
      })
      .catch((backgroundError) => {
        console.error("logout background error", backgroundError);
      });

    return true;
  }, [clearSessionState, t, toast]);

  const logoutAllDevices = useCallback(async () => {
    clearSessionState();

    try {
      await logoutAllSessions();
    } catch (error) {
      console.error("logoutAllDevices error", error);
    }

    toast({
      title: t("settings.security.logOutAllDevices"),
      description: t("settings.security.sessionsDescription"),
    });

    return true;
  }, [clearSessionState, t, toast]);

  const refreshSecuritySessions = useCallback(async () => {
    try {
      const sessions = await listSessions();
      const mappedSessions = sessions.map((session, index) => ({
        id: session.id,
        deviceLabel:
          session.userAgent?.trim() ||
          t("settings.security.numberedSession", { count: index + 1 }),
        location: session.ipAddress || "-",
        lastSeenAt: session.lastUsedAt || session.createdAt,
        current: Boolean(session.current),
      }));

      return mappedSessions;
    } catch (error) {
      console.error("refreshSecuritySessions error", error);
      return [];
    }
  }, [t]);

  const revokeDeviceSession = useCallback(
    async (sessionId) => {
      const revoked = await revokeSessionById(sessionId);
      if (revoked) {
        toast({
          title: t("settings.security.sessionsTitle"),
          description: t("settings.security.sessionsDescription"),
        });
      }
      return revoked;
    },
    [t, toast]
  );

  const changePassword = useCallback(
    async ({ currentPassword, newPassword }) => {
      await changePasswordRequest({ currentPassword, newPassword });
      clearSessionState();
      toast({
        title: t("settings.security.toasts.passwordUpdatedTitle"),
        description: t("settings.security.toasts.passwordUpdatedDescription"),
      });
      return true;
    },
    [clearSessionState, t, toast]
  );

  const register = useCallback(
    async (userData) => {
      let data;

      try {
        data = await registerWithPassword({
          name: userData.name,
          email: userData.email,
          password: userData.password,
          role: userData.role,
        });
      } catch (error) {
        toast({
          title: t("auth.register.errorTitle"),
          description: error?.message || t("auth.register.errorDescription"),
          variant: "destructive",
        });
        return { success: false };
      }

      if (!data.user) {
        toast({
          title: t("auth.register.errorTitle"),
          description: t("auth.register.errorDescription"),
          variant: "destructive",
        });
        return { success: false };
      }

      const authUser = {
        ...data.user,
        user_metadata: {
          ...data.user.user_metadata,
        },
        created_at: data.user.created_at,
        last_sign_in_at: data.user.last_sign_in_at,
      };

      const profile = buildTradingUser(authUser, undefined, {
        name: userData.name,
        role: userData.role,
        positions: [],
        transactions: [],
      });

      const persistedProfile = profile;

      setAllUsers((currentUsers) => upsertTradingUser(currentUsers, persistedProfile));
      setCurrentUserId(data.user.id);
      persistClientSecurityExtras(data.user.id, {
        lastPasswordChangedAt: "",
      });
      syncUserFromAuth(authUser).catch((syncError) => {
        console.error("syncUserFromAuth register error", syncError);
      });

      toast({
        title: t("auth.register.submitSuccessTitle"),
        description: t("auth.register.submitSuccessDescription", { name: profile.name }),
      });

      return {
        success: true,
        user: persistedProfile,
        requiresEmailConfirmation: false,
      };
    },
    [setAllUsers, setCurrentUserId, syncUserFromAuth, t, toast]
  );

  return {
    changePassword,
    login,
    loginWithGoogle,
    logout,
    logoutAllDevices,
    refreshSecuritySessions,
    register,
    revokeDeviceSession,
  };
};
