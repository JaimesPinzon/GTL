import React from "react";
import { useTradingContext } from "@/contexts/TradingContext";
import {
  HomeDirectorySection,
  HomeHeroSection,
  LandingLayout,
} from "@/components/landing/content";

const LandingPage = () => {
  const { isAuthenticated, user, preferencesState } = useTradingContext();

  return (
    <LandingLayout
      isAuthenticated={isAuthenticated}
      user={user}
      preferencesState={preferencesState}
    >
      <HomeHeroSection
        isAuthenticated={isAuthenticated}
        user={user}
        preferencesState={preferencesState}
      />
      <HomeDirectorySection />
    </LandingLayout>
  );
};

export default LandingPage;
