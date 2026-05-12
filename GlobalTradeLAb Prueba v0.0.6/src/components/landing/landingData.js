import {
  BarChart3,
  CandlestickChart,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  Wallet,
  WalletCards,
} from "lucide-react";

export const getPublicNavItems = (t) => [
  { label: t("landing.navigation.home"), to: "/" },
  { label: t("landing.navigation.platform"), to: "/plataforma-info" },
  { label: t("landing.navigation.markets"), to: "/mercados" },
  { label: t("landing.navigation.features"), to: "/funcionalidades" },
  { label: t("landing.navigation.learning"), to: "/aprendizaje" },
  { label: t("landing.navigation.about"), to: "/acerca-de" },
  { label: t("landing.navigation.contact"), to: "/contacto" },
];

export const getFooterGroups = (t) => [
  {
    title: t("landing.footer.groups.explore.title"),
    links: [
      { label: t("landing.navigation.home"), to: "/" },
      { label: t("landing.navigation.platform"), to: "/plataforma-info" },
      { label: t("landing.navigation.features"), to: "/funcionalidades" },
      { label: t("landing.navigation.contact"), to: "/contacto" },
    ],
  },
  {
    title: t("landing.footer.groups.markets.title"),
    links: [
      { label: t("landing.navigation.markets"), to: "/mercados" },
      { label: t("landing.footer.groups.markets.demo"), to: "/plataforma-info" },
      { label: t("common.actions.logIn"), to: "/login" },
      { label: t("common.actions.register"), to: "/register" },
    ],
  },
  {
    title: t("landing.footer.groups.learning.title"),
    links: [
      { label: t("landing.navigation.learning"), to: "/aprendizaje" },
      { label: t("landing.navigation.about"), to: "/acerca-de" },
      { label: t("landing.footer.groups.learning.demoAccount"), to: "/register" },
      { label: t("landing.footer.groups.learning.guidedExperience"), to: "/aprendizaje" },
    ],
  },
  {
    title: t("landing.footer.groups.access.title"),
    links: [
      { label: t("landing.footer.groups.access.register"), to: "/register" },
      { label: t("landing.footer.groups.access.login"), to: "/login" },
      { label: t("landing.footer.groups.access.institutionalContact"), to: "/contacto" },
      { label: t("landing.footer.groups.access.overview"), to: "/plataforma-info" },
    ],
  },
];

export const getMarketItems = (t) => t("landing.markets.items", { returnObjects: true });

export const getMarketTypeLabels = (t) => ({
  crypto: t("landing.markets.marketTypes.crypto"),
  stock: t("landing.markets.marketTypes.stock"),
  index: t("landing.markets.marketTypes.index"),
  forex: t("landing.markets.marketTypes.forex"),
  commodities: t("landing.markets.marketTypes.commodities"),
});

export const getStartSteps = (t) => t("landing.learning.steps", { returnObjects: true });

export const getPlatformHotspots = (t) => [
  {
    id: "markets",
    title: t("landing.platform.hotspots.markets.title"),
    description: t("landing.platform.hotspots.markets.description"),
    top: "18%",
    left: "10%",
  },
  {
    id: "chart",
    title: t("landing.platform.hotspots.chart.title"),
    description: t("landing.platform.hotspots.chart.description"),
    top: "29%",
    left: "47%",
  },
  {
    id: "orders",
    title: t("landing.platform.hotspots.orders.title"),
    description: t("landing.platform.hotspots.orders.description"),
    top: "40%",
    left: "84%",
  },
  {
    id: "portfolio",
    title: t("landing.platform.hotspots.portfolio.title"),
    description: t("landing.platform.hotspots.portfolio.description"),
    top: "76%",
    left: "78%",
  },
  {
    id: "watchlist",
    title: t("landing.platform.hotspots.watchlist.title"),
    description: t("landing.platform.hotspots.watchlist.description"),
    top: "69%",
    left: "17%",
  },
];

export const getPlatformScreens = (t) => [
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: t("landing.platform.screens.dashboard.title"),
    caption: t("landing.platform.screens.dashboard.caption"),
  },
  {
    id: "asset",
    icon: CandlestickChart,
    title: t("landing.platform.screens.asset.title"),
    caption: t("landing.platform.screens.asset.caption"),
  },
  {
    id: "portfolio",
    icon: Wallet,
    title: t("landing.platform.screens.portfolio.title"),
    caption: t("landing.platform.screens.portfolio.caption"),
  },
  {
    id: "history",
    icon: BarChart3,
    title: t("landing.platform.screens.history.title"),
    caption: t("landing.platform.screens.history.caption"),
  },
];

export const getAboutCards = (t) => [
  {
    icon: WalletCards,
    title: t("landing.about.cards.simulation.title"),
    description: t("landing.about.cards.simulation.description"),
  },
  {
    icon: CandlestickChart,
    title: t("landing.about.cards.visualization.title"),
    description: t("landing.about.cards.visualization.description"),
  },
  {
    icon: Wallet,
    title: t("landing.about.cards.portfolio.title"),
    description: t("landing.about.cards.portfolio.description"),
  },
  {
    icon: GraduationCap,
    title: t("landing.about.cards.learning.title"),
    description: t("landing.about.cards.learning.description"),
  },
];

export const getFeatureCards = (t) => [
  {
    icon: Landmark,
    title: t("landing.features.cards.explore.title"),
    description: t("landing.features.cards.explore.description"),
  },
  {
    icon: CandlestickChart,
    title: t("landing.features.cards.analyze.title"),
    description: t("landing.features.cards.analyze.description"),
  },
  {
    icon: WalletCards,
    title: t("landing.features.cards.simulate.title"),
    description: t("landing.features.cards.simulate.description"),
  },
  {
    icon: Wallet,
    title: t("landing.features.cards.portfolio.title"),
    description: t("landing.features.cards.portfolio.description"),
  },
  {
    icon: Landmark,
    title: t("landing.features.cards.watchlist.title"),
    description: t("landing.features.cards.watchlist.description"),
  },
  {
    icon: GraduationCap,
    title: t("landing.features.cards.learn.title"),
    description: t("landing.features.cards.learn.description"),
  },
];
