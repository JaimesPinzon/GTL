import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import ClassHeader from "@/features/classes/components/ClassHeader";

const ClassLayout = () => {
  const [isChartFullScreen, setIsChartFullScreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = (event) => {
      setIsChartFullScreen(Boolean(event?.detail?.isFullScreen));
    };

    window.addEventListener("gtl:chart-fullscreen-change", handleFullscreenChange);
    return () => window.removeEventListener("gtl:chart-fullscreen-change", handleFullscreenChange);
  }, []);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      {isChartFullScreen ? null : <ClassHeader />}
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
};

export default ClassLayout;
