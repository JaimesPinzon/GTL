import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useTradingContext } from "@/contexts/TradingContext";
import { useClassContext } from "@/features/classes/context/ClassContext";
import { APP_HOME_PATH } from "@/lib/routes";

const CenteredState = ({ title, description }) => (
  <div className="flex h-full min-h-[320px] items-center justify-center">
    <div className="text-center">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="mt-2 text-muted-foreground">{description}</p>
    </div>
  </div>
);

const ClassRouteGuard = ({ requiredRole }) => {
  const { t } = useTranslation();
  const { user, isLoading } = useTradingContext();
  const { activeClass, activeClassId, isHydratingClass, routeClassId, validateClassAccess } =
    useClassContext() || {};

  if (isLoading || isHydratingClass) {
    return (
      <CenteredState
        title={t("app.loading.title")}
        description={t("app.loading.subtitle")}
      />
    );
  }

  if (!routeClassId || !validateClassAccess?.(routeClassId)) {
    return <Navigate to={APP_HOME_PATH} replace />;
  }

  if (!activeClassId || !activeClass) {
    return <Navigate to={APP_HOME_PATH} replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to={APP_HOME_PATH} replace />;
  }

  return <Outlet />;
};

export default ClassRouteGuard;
