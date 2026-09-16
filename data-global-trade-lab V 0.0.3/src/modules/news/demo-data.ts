export type NewsAsset = {
  symbol: string;
  name: string;
  type: "stock" | "etf" | "index" | "forex" | "crypto" | "commodities" | "bonds";
  relationType: "direct" | "related" | "mentioned";
  change: number | null;
};

export type NewsArticle = {
  id: string;
  title: string;
  summary: string;
  bodyExcerpt: string;
  source: string;
  sourceUrl: string | null;
  imageUrl: string | null;
  author: string | null;
  category: string;
  region: string;
  country: string | null;
  publishedAt: string;
  updatedAt: string;
  eventClusterId: string | null;
  importanceScore: number;
  isBreaking: boolean;
  isDemo: boolean;
  sentiment: { label: "positive" | "neutral" | "negative" | "mixed"; score: number | null };
  clusterSize?: number;
  assets: NewsAsset[];
  topics: string[];
  saved?: boolean;
  read?: boolean;
};

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const demoNews: NewsArticle[] = [
  {
    id: "demo-fed-rates",
    title: "Los mercados evalúan la próxima decisión de tasas en Estados Unidos",
    summary: "Bonos, acciones y dólar ajustan posiciones mientras los inversionistas comparan inflación, empleo y expectativas de política monetaria.",
    bodyExcerpt: "Este contenido de demostración ilustra cómo GTL relaciona un acontecimiento macroeconómico con los activos que podrían reaccionar. La versión conectada mostrará el contenido permitido por la licencia del proveedor y enlazará la publicación original.",
    source: "Escenario educativo GTL",
    sourceUrl: null,
    imageUrl: null,
    author: "Equipo GTL",
    category: "economy",
    region: "north-america",
    country: "Estados Unidos",
    publishedAt: ago(18),
    updatedAt: ago(18),
    eventClusterId: "demo-fed-policy",
    importanceScore: 9.6,
    isBreaking: true,
    isDemo: true,
    sentiment: { label: "mixed", score: 0.05 },
    assets: [
      { symbol: "SPY", name: "S&P 500 ETF", type: "etf", relationType: "related", change: 0.48 },
      { symbol: "QQQ", name: "Nasdaq 100 ETF", type: "etf", relationType: "related", change: 0.71 },
      { symbol: "DIA", name: "Dow Jones ETF", type: "etf", relationType: "related", change: -0.12 },
    ],
    topics: ["interest-rates", "central-banks", "inflation"],
  },
  {
    id: "demo-nvda-demand",
    title: "La demanda de infraestructura de IA vuelve a poner a los semiconductores en foco",
    summary: "El mercado analiza capacidad, márgenes y gasto de capital ante una nueva ronda de expectativas para el sector tecnológico.",
    bodyExcerpt: "La noticia de demostración permite explorar el flujo Noticias → activo → clase. Usa el enlace de mercado para comprobar disponibilidad y abrir el instrumento dentro del contexto académico.",
    source: "Escenario educativo GTL",
    sourceUrl: null,
    imageUrl: null,
    author: "Equipo GTL",
    category: "markets",
    region: "north-america",
    country: "Estados Unidos",
    publishedAt: ago(42),
    updatedAt: ago(42),
    eventClusterId: "demo-ai-chips",
    importanceScore: 8.7,
    isBreaking: false,
    isDemo: true,
    sentiment: { label: "positive", score: 0.62 },
    assets: [
      { symbol: "NVDA", name: "NVIDIA", type: "stock", relationType: "direct", change: 1.28 },
      { symbol: "QQQ", name: "Nasdaq 100 ETF", type: "etf", relationType: "related", change: 0.71 },
    ],
    topics: ["earnings", "technology", "artificial-intelligence"],
  },
  {
    id: "demo-bitcoin-volatility",
    title: "Bitcoin amplía su rango intradía mientras aumenta la actividad del mercado",
    summary: "El movimiento concentra la atención en liquidez, gestión de riesgo y correlación con activos tecnológicos.",
    bodyExcerpt: "El escenario destaca que el color representa variación de precio, no una clasificación positiva o negativa de la noticia.",
    source: "Escenario educativo GTL",
    sourceUrl: null,
    imageUrl: null,
    author: "Equipo GTL",
    category: "markets",
    region: "global",
    country: null,
    publishedAt: ago(67),
    updatedAt: ago(67),
    eventClusterId: "demo-crypto-volatility",
    importanceScore: 8.1,
    isBreaking: false,
    isDemo: true,
    sentiment: { label: "mixed", score: -0.18 },
    assets: [
      { symbol: "BTCUSD", name: "Bitcoin / dólar", type: "crypto", relationType: "direct", change: -0.82 },
      { symbol: "ETHUSD", name: "Ether / dólar", type: "crypto", relationType: "related", change: -0.35 },
    ],
    topics: ["crypto", "volatility", "liquidity"],
  },
  {
    id: "demo-latam-fintech",
    title: "Las plataformas financieras latinoamericanas aceleran su expansión regional",
    summary: "Inversionistas comparan crecimiento de clientes, costo de fondeo y calidad de cartera en el sector fintech.",
    bodyExcerpt: "Este ejemplo conecta noticias corporativas con una acción disponible en el universo inicial de GTL.",
    source: "Escenario educativo GTL",
    sourceUrl: null,
    imageUrl: null,
    author: "Equipo GTL",
    category: "markets",
    region: "latin-america",
    country: "Brasil",
    publishedAt: ago(96),
    updatedAt: ago(96),
    eventClusterId: "demo-latam-fintech",
    importanceScore: 7.4,
    isBreaking: false,
    isDemo: true,
    sentiment: { label: "positive", score: 0.41 },
    assets: [{ symbol: "NU", name: "Nu Holdings", type: "stock", relationType: "direct", change: 0.64 }],
    topics: ["fintech", "banking", "latin-america"],
  },
  {
    id: "demo-index-divergence",
    title: "Los principales índices estadounidenses muestran señales mixtas al cierre",
    summary: "Tecnología, industriales y mercado amplio terminan con diferencias que invitan a revisar composición y concentración.",
    bodyExcerpt: "La comparación entre ETFs sirve como punto de partida para una actividad de análisis de índices.",
    source: "Escenario educativo GTL",
    sourceUrl: null,
    imageUrl: null,
    author: "Equipo GTL",
    category: "markets",
    region: "north-america",
    country: "Estados Unidos",
    publishedAt: ago(133),
    updatedAt: ago(133),
    eventClusterId: "demo-us-close",
    importanceScore: 6.9,
    isBreaking: false,
    isDemo: true,
    sentiment: { label: "neutral", score: 0.08 },
    assets: [
      { symbol: "SPY", name: "S&P 500 ETF", type: "etf", relationType: "direct", change: 0.48 },
      { symbol: "DIA", name: "Dow Jones ETF", type: "etf", relationType: "direct", change: -0.12 },
      { symbol: "QQQ", name: "Nasdaq 100 ETF", type: "etf", relationType: "direct", change: 0.71 },
    ],
    topics: ["indices", "market-close", "diversification"],
  },
  {
    id: "demo-ethereum-network",
    title: "La actividad de la red de Ethereum impulsa el debate sobre costos y escalabilidad",
    summary: "Participantes observan el uso de aplicaciones, las comisiones y el comportamiento relativo frente a Bitcoin.",
    bodyExcerpt: "El escenario se presenta con fines educativos y no constituye recomendación de inversión.",
    source: "Escenario educativo GTL",
    sourceUrl: null,
    imageUrl: null,
    author: "Equipo GTL",
    category: "markets",
    region: "global",
    country: null,
    publishedAt: ago(205),
    updatedAt: ago(205),
    eventClusterId: "demo-ethereum-network",
    importanceScore: 6.2,
    isBreaking: false,
    isDemo: true,
    sentiment: { label: "neutral", score: -0.04 },
    assets: [
      { symbol: "ETHUSD", name: "Ether / dólar", type: "crypto", relationType: "direct", change: -0.35 },
      { symbol: "BTCUSD", name: "Bitcoin / dólar", type: "crypto", relationType: "related", change: -0.82 },
    ],
    topics: ["crypto", "blockchain", "technology"],
  },
];

export type EconomicEvent = {
  id: string;
  title: string;
  description: string;
  country: string;
  region: string;
  currency: string | null;
  category: string;
  impact: "low" | "medium" | "high";
  scheduledAt: string;
  previousValue: string | null;
  forecastValue: string | null;
  actualValue: string | null;
  status: "scheduled" | "released" | "revised" | "cancelled";
  sourceUrl: string | null;
  isDemo: boolean;
};

const fromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

export const demoEconomicEvents: EconomicEvent[] = [
  { id: "demo-us-cpi", title: "Índice de precios al consumidor", description: "Variación mensual del nivel general de precios.", country: "Estados Unidos", region: "north-america", currency: "USD", category: "inflation", impact: "high", scheduledAt: fromNow(3), previousValue: "0,2 %", forecastValue: "0,3 %", actualValue: null, status: "scheduled", sourceUrl: null, isDemo: true },
  { id: "demo-col-rate", title: "Decisión de tasa de política monetaria", description: "Anuncio de la autoridad monetaria sobre su tasa de referencia.", country: "Colombia", region: "latin-america", currency: "COP", category: "interest-rates", impact: "high", scheduledAt: fromNow(8), previousValue: "9,25 %", forecastValue: "9,00 %", actualValue: null, status: "scheduled", sourceUrl: null, isDemo: true },
  { id: "demo-us-jobs", title: "Solicitudes iniciales de desempleo", description: "Indicador semanal de nuevas solicitudes de subsidio.", country: "Estados Unidos", region: "north-america", currency: "USD", category: "employment", impact: "medium", scheduledAt: fromNow(27), previousValue: "221K", forecastValue: "225K", actualValue: null, status: "scheduled", sourceUrl: null, isDemo: true },
  { id: "demo-eu-pmi", title: "PMI compuesto preliminar", description: "Encuesta sobre actividad de manufactura y servicios.", country: "Zona euro", region: "europe", currency: "EUR", category: "growth", impact: "medium", scheduledAt: fromNow(45), previousValue: "51,0", forecastValue: "51,2", actualValue: null, status: "scheduled", sourceUrl: null, isDemo: true },
];
