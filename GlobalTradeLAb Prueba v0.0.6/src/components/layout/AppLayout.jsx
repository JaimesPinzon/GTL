import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { ClassContextProvider } from "@/features/classes/context/ClassContext";
import { ClassMarketContextProvider } from "@/features/classes/context/ClassMarketContext";

const AppLayout = () => {
  const [isChartFullScreen, setIsChartFullScreen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleChartFullscreenChange = (event) => {
      setIsChartFullScreen(Boolean(event?.detail?.isFullScreen));
    };

    window.addEventListener("gtl:chart-fullscreen-change", handleChartFullscreenChange);

    return () => {
      window.removeEventListener("gtl:chart-fullscreen-change", handleChartFullscreenChange);
    };
  }, []);

  return (
    <ClassContextProvider>
      <ClassMarketContextProvider>
        <div className={`flex h-screen w-full bg-background ${isChartFullScreen ? "pl-0" : "pl-[72px]"}`}>
          {isChartFullScreen ? null : <Sidebar />}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
            <Header />
            <main id="app-main" className="flex-1 overflow-hidden">
              <Outlet />
            </main>
          </div>
        </div>
      </ClassMarketContextProvider>
    </ClassContextProvider>
  );
};

export default AppLayout;
