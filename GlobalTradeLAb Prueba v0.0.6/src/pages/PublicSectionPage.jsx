import React from "react";
import { useLocation } from "react-router-dom";
import { useTradingContext } from "@/contexts/TradingContext";
import {
  AboutSection,
  ContactSection,
  FeaturesSection,
  LandingLayout,
  LearningSection,
  MarketsSection,
  PlatformSection,
} from "@/components/landing/content";

const sectionMap = {
  "/plataforma-info": <PlatformSection />,
  "/mercados": <MarketsSection />,
  "/funcionalidades": <FeaturesSection />,
  "/aprendizaje": <LearningSection />,
  "/acerca-de": <AboutSection />,
  "/contacto": <ContactSection />,
};

const PublicSectionPage = () => {
  const location = useLocation();
  const { isAuthenticated, user, preferencesState } = useTradingContext();

  return (
    <LandingLayout
      isAuthenticated={isAuthenticated}
      user={user}
      preferencesState={preferencesState}
    >
      {sectionMap[location.pathname] || <PlatformSection />}
    </LandingLayout>
  );
};

export default PublicSectionPage;
