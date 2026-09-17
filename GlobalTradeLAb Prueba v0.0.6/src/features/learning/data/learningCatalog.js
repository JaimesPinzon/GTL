const localized = (es, en) => ({ es, en });

const categories = [
  { id: "markets", label: localized("Mercados financieros", "Financial markets"), icon: "Landmark" },
  { id: "trading", label: localized("Trading", "Trading"), icon: "CandlestickChart" },
  { id: "investing", label: localized("Inversión", "Investing"), icon: "TrendingUp" },
  { id: "technical", label: localized("Análisis técnico", "Technical analysis"), icon: "LineChart" },
  { id: "fundamental", label: localized("Análisis fundamental", "Fundamental analysis"), icon: "SearchCheck" },
  { id: "risk", label: localized("Gestión del riesgo", "Risk management"), icon: "ShieldCheck" },
  { id: "portfolios", label: localized("Portafolios", "Portfolios"), icon: "PieChart" },
  { id: "macro", label: localized("Macroeconomía", "Macroeconomics"), icon: "Globe2" },
  { id: "instruments", label: localized("Instrumentos financieros", "Financial instruments"), icon: "Layers3" },
  { id: "psychology", label: localized("Psicología financiera", "Financial psychology"), icon: "Brain" },
];

const lesson = (id, title, duration, type = "lesson", blocks = []) => ({
  id,
  slug: id,
  title,
  duration,
  type,
  blocks,
});

const standardBlocks = (topicEs, topicEn) => [
  {
    type: "lead",
    text: localized(
      `En esta lección comprenderás ${topicEs} y cómo utilizar este concepto al analizar decisiones financieras.`,
      `In this lesson you will understand ${topicEn} and how to use this concept when analyzing financial decisions.`
    ),
  },
  {
    type: "heading",
    text: localized("Idea central", "Core idea"),
  },
  {
    type: "text",
    text: localized(
      "Los mercados combinan información, expectativas y riesgo. El objetivo no es memorizar una definición, sino reconocer cómo cambia una decisión cuando cambian sus supuestos.",
      "Markets combine information, expectations, and risk. The goal is not to memorize a definition, but to recognize how a decision changes when its assumptions change."
    ),
  },
  {
    type: "note",
    title: localized("Recuerda", "Remember"),
    text: localized(
      "Una herramienta es útil solo cuando conoces sus límites y el contexto en el que fue diseñada.",
      "A tool is useful only when you understand its limits and the context it was designed for."
    ),
  },
  {
    type: "example",
    title: localized("Ejemplo aplicado", "Applied example"),
    text: localized(
      "Compara dos escenarios, identifica qué variable cambió y explica cómo afecta el resultado. Esa comparación convierte la teoría en criterio.",
      "Compare two scenarios, identify which variable changed, and explain how it affects the result. That comparison turns theory into judgment."
    ),
  },
  {
    type: "practice",
    title: localized("Aplicar en GlobalTradeLab", "Apply in GlobalTradeLab"),
    text: localized(
      "Abre el mercado de tu clase y observa este concepto en un gráfico real antes de continuar.",
      "Open your class market and observe this concept on a real chart before continuing."
    ),
  },
];

const courses = [
  {
    id: "market-foundations",
    slug: "fundamentos-mercados-financieros",
    title: localized("Fundamentos de los mercados financieros", "Financial market foundations"),
    shortTitle: localized("Fundamentos de mercados", "Market foundations"),
    description: localized(
      "Comprende cómo se conectan participantes, activos, precios y bolsas antes de tomar tu primera decisión de inversión.",
      "Understand how participants, assets, prices, and exchanges connect before making your first investment decision."
    ),
    category: "markets",
    level: "beginner",
    durationMinutes: 270,
    rating: 4.9,
    students: 1840,
    type: "course",
    featured: true,
    isNew: false,
    icon: "Landmark",
    accent: "from-sky-500/25 via-blue-500/10 to-transparent",
    outcomes: [
      localized("Distinguir los principales mercados e instrumentos.", "Distinguish the main markets and instruments."),
      localized("Comprender cómo se forma un precio.", "Understand how a price is formed."),
      localized("Reconocer el papel del riesgo y la rentabilidad.", "Recognize the role of risk and return."),
    ],
    modules: [
      {
        id: "market-basics",
        title: localized("El ecosistema financiero", "The financial ecosystem"),
        lessons: [
          lesson("que-son-los-mercados", localized("¿Qué son los mercados financieros?", "What are financial markets?"), 14, "lesson", standardBlocks("qué son los mercados financieros", "what financial markets are")),
          lesson("participantes", localized("Participantes y sus objetivos", "Participants and their goals"), 18, "lesson", standardBlocks("quién participa en el mercado", "who participates in the market")),
          lesson("formacion-precios", localized("Cómo se forma un precio", "How a price is formed"), 20, "lesson", standardBlocks("la formación de precios", "price formation")),
        ],
      },
      {
        id: "assets-and-orders",
        title: localized("Activos y órdenes", "Assets and orders"),
        lessons: [
          lesson("activos-financieros", localized("Activos financieros", "Financial assets"), 16, "lesson", standardBlocks("los activos financieros", "financial assets")),
          lesson("bolsa", localized("Funcionamiento de una bolsa", "How an exchange works"), 22, "video", standardBlocks("el funcionamiento de una bolsa", "how an exchange works")),
          lesson("ordenes", localized("Órdenes de mercado y límite", "Market and limit orders"), 24, "practice", standardBlocks("los tipos de órdenes", "order types")),
        ],
      },
    ],
  },
  {
    id: "technical-analysis",
    slug: "analisis-tecnico",
    title: localized("Fundamentos del análisis técnico", "Technical analysis fundamentals"),
    shortTitle: localized("Análisis técnico", "Technical analysis"),
    description: localized(
      "Aprende a interpretar precio, volumen, tendencias y niveles relevantes con una metodología clara y verificable.",
      "Learn to interpret price, volume, trends, and relevant levels with a clear, verifiable method."
    ),
    category: "technical",
    level: "beginner",
    durationMinutes: 220,
    rating: 4.8,
    students: 1240,
    type: "course",
    featured: true,
    isNew: false,
    icon: "LineChart",
    accent: "from-violet-500/25 via-indigo-500/10 to-transparent",
    outcomes: [
      localized("Leer la estructura básica de un gráfico.", "Read the basic structure of a chart."),
      localized("Identificar tendencias, soportes y resistencias.", "Identify trends, support, and resistance."),
      localized("Construir una hipótesis técnica con criterios de invalidación.", "Build a technical thesis with invalidation criteria."),
    ],
    modules: [
      {
        id: "introduction",
        title: localized("Introducción", "Introduction"),
        lessons: [
          lesson("introduccion", localized("¿Qué es el análisis técnico?", "What is technical analysis?"), 12, "lesson", standardBlocks("el propósito del análisis técnico", "the purpose of technical analysis")),
          lesson("precio", localized("Precio y estructura", "Price and structure"), 17, "lesson", standardBlocks("la estructura del precio", "price structure")),
          lesson("volumen", localized("Volumen y participación", "Volume and participation"), 18, "video", standardBlocks("la lectura del volumen", "reading volume")),
        ],
      },
      {
        id: "trends",
        title: localized("Tendencias", "Trends"),
        lessons: [
          lesson("tendencias", localized("Tendencias del mercado", "Market trends"), 22, "lesson", standardBlocks("cómo identificar una tendencia", "how to identify a trend")),
          lesson("soportes", localized("Soportes", "Support"), 24, "practice", standardBlocks("la identificación de soportes", "identifying support")),
          lesson("resistencias", localized("Resistencias", "Resistance"), 24, "practice", standardBlocks("la identificación de resistencias", "identifying resistance")),
        ],
      },
      {
        id: "indicators",
        title: localized("Indicadores y confirmación", "Indicators and confirmation"),
        lessons: [
          lesson("medias-moviles", localized("Medias móviles", "Moving averages"), 26, "lesson", standardBlocks("las medias móviles", "moving averages")),
          lesson("rsi", localized("RSI y momentum", "RSI and momentum"), 28, "quiz", standardBlocks("el indicador RSI", "the RSI indicator")),
          lesson("plan-tecnico", localized("Construye un plan técnico", "Build a technical plan"), 30, "assessment", standardBlocks("la construcción de un plan técnico", "building a technical plan")),
        ],
      },
    ],
  },
  {
    id: "risk-management",
    slug: "gestion-del-riesgo",
    title: localized("Gestión del riesgo", "Risk management"),
    shortTitle: localized("Gestión del riesgo", "Risk management"),
    description: localized(
      "Define cuánto arriesgar, cómo dimensionar una posición y cuándo una idea deja de ser válida.",
      "Define how much to risk, how to size a position, and when an idea is no longer valid."
    ),
    category: "risk",
    level: "intermediate",
    durationMinutes: 185,
    rating: 4.9,
    students: 960,
    type: "course",
    featured: true,
    isNew: false,
    icon: "ShieldCheck",
    accent: "from-emerald-500/25 via-teal-500/10 to-transparent",
    outcomes: [
      localized("Calcular el riesgo monetario de una operación.", "Calculate the monetary risk of a trade."),
      localized("Relacionar probabilidad, pérdida y rentabilidad.", "Relate probability, loss, and return."),
      localized("Aplicar límites consistentes a un portafolio.", "Apply consistent limits to a portfolio."),
    ],
    modules: [
      {
        id: "risk-principles",
        title: localized("Principios de riesgo", "Risk principles"),
        lessons: [
          lesson("incertidumbre", localized("Riesgo e incertidumbre", "Risk and uncertainty"), 16, "lesson", standardBlocks("la diferencia entre riesgo e incertidumbre", "the difference between risk and uncertainty")),
          lesson("regla-uno", localized("La regla del 1 %", "The 1% rule"), 21, "practice", standardBlocks("la regla del uno por ciento", "the one percent rule")),
          lesson("stop-loss", localized("Stop-loss e invalidación", "Stop-loss and invalidation"), 22, "lesson", standardBlocks("el uso responsable del stop-loss", "responsible stop-loss use")),
        ],
      },
      {
        id: "position-sizing",
        title: localized("Tamaño y relación riesgo/rentabilidad", "Sizing and risk-return"),
        lessons: [
          lesson("tamano-posicion", localized("Tamaño de posición", "Position sizing"), 24, "practice", standardBlocks("el tamaño de una posición", "position sizing")),
          lesson("riesgo-rentabilidad", localized("Relación riesgo/rentabilidad", "Risk-return ratio"), 28, "lesson", standardBlocks("la relación entre riesgo y rentabilidad", "the risk-return relationship")),
          lesson("limites-portafolio", localized("Límites del portafolio", "Portfolio limits"), 26, "assessment", standardBlocks("los límites agregados de riesgo", "aggregate risk limits")),
        ],
      },
    ],
  },
  {
    id: "investment-intro",
    slug: "introduccion-inversion",
    title: localized("Introducción a la inversión", "Introduction to investing"),
    shortTitle: localized("Introducción a la inversión", "Introduction to investing"),
    description: localized("Construye una base para invertir con objetivos, horizonte y criterios definidos.", "Build a foundation for investing with clear goals, time horizon, and criteria."),
    category: "investing",
    level: "beginner",
    durationMinutes: 160,
    rating: 4.7,
    students: 780,
    type: "course",
    featured: false,
    isNew: true,
    icon: "TrendingUp",
    accent: "from-amber-500/25 via-orange-500/10 to-transparent",
    outcomes: [localized("Definir objetivos y horizonte de inversión.", "Define investment goals and horizon."), localized("Relacionar retorno esperado y tolerancia al riesgo.", "Relate expected return and risk tolerance.")],
    modules: [{ id: "investment-plan", title: localized("Tu plan de inversión", "Your investment plan"), lessons: [lesson("objetivos", localized("Objetivos financieros", "Financial goals"), 18, "lesson", standardBlocks("la definición de objetivos", "goal setting")), lesson("horizonte", localized("Horizonte y liquidez", "Horizon and liquidity"), 20, "lesson", standardBlocks("el horizonte de inversión", "investment horizon")), lesson("perfil", localized("Perfil de riesgo", "Risk profile"), 24, "quiz", standardBlocks("el perfil de riesgo", "risk profile"))] }],
  },
  {
    id: "fundamental-analysis",
    slug: "analisis-fundamental",
    title: localized("Análisis fundamental", "Fundamental analysis"),
    shortTitle: localized("Análisis fundamental", "Fundamental analysis"),
    description: localized("Conecta estados financieros, negocio, valoración y contexto para estudiar una compañía.", "Connect financial statements, business, valuation, and context to study a company."),
    category: "fundamental",
    level: "intermediate",
    durationMinutes: 310,
    rating: 4.8,
    students: 640,
    type: "course",
    featured: true,
    isNew: false,
    icon: "SearchCheck",
    accent: "from-cyan-500/25 via-sky-500/10 to-transparent",
    outcomes: [localized("Interpretar estados financieros básicos.", "Interpret basic financial statements."), localized("Distinguir precio, valor y narrativa.", "Distinguish price, value, and narrative.")],
    modules: [{ id: "company-analysis", title: localized("Entender una compañía", "Understanding a company"), lessons: [lesson("modelo-negocio", localized("Modelo de negocio", "Business model"), 24, "lesson", standardBlocks("el modelo de negocio", "the business model")), lesson("estados-financieros", localized("Estados financieros", "Financial statements"), 32, "video", standardBlocks("los estados financieros", "financial statements")), lesson("valoracion", localized("Introducción a la valoración", "Introduction to valuation"), 35, "practice", standardBlocks("los fundamentos de valoración", "valuation fundamentals"))] }],
  },
  {
    id: "portfolio-construction",
    slug: "construccion-portafolios",
    title: localized("Construcción y gestión de portafolios", "Portfolio construction and management"),
    shortTitle: localized("Gestión de portafolios", "Portfolio management"),
    description: localized("Combina activos con intención y evalúa el riesgo del conjunto, no solo de cada posición.", "Combine assets intentionally and evaluate portfolio risk, not just individual positions."),
    category: "portfolios",
    level: "intermediate",
    durationMinutes: 260,
    rating: 4.8,
    students: 520,
    type: "course",
    featured: false,
    isNew: true,
    icon: "PieChart",
    accent: "from-fuchsia-500/25 via-purple-500/10 to-transparent",
    outcomes: [localized("Comprender diversificación y correlación.", "Understand diversification and correlation."), localized("Definir una política de rebalanceo.", "Define a rebalancing policy.")],
    modules: [{ id: "portfolio-basics", title: localized("Arquitectura del portafolio", "Portfolio architecture"), lessons: [lesson("diversificacion", localized("Diversificación", "Diversification"), 22, "lesson", standardBlocks("la diversificación", "diversification")), lesson("correlacion", localized("Correlación", "Correlation"), 24, "lesson", standardBlocks("la correlación entre activos", "asset correlation")), lesson("rebalanceo", localized("Rebalanceo", "Rebalancing"), 26, "practice", standardBlocks("el rebalanceo", "rebalancing"))] }],
  },
  {
    id: "macro-markets",
    slug: "macroeconomia-mercados",
    title: localized("Macroeconomía aplicada a mercados", "Macroeconomics applied to markets"),
    shortTitle: localized("Macroeconomía aplicada", "Applied macroeconomics"),
    description: localized("Interpreta inflación, tasas, crecimiento y política monetaria desde la perspectiva del mercado.", "Interpret inflation, rates, growth, and monetary policy from a market perspective."),
    category: "macro",
    level: "advanced",
    durationMinutes: 295,
    rating: 4.7,
    students: 410,
    type: "course",
    featured: false,
    isNew: true,
    icon: "Globe2",
    accent: "from-rose-500/25 via-pink-500/10 to-transparent",
    outcomes: [localized("Leer un calendario económico con contexto.", "Read an economic calendar with context."), localized("Conectar tasas e inflación con activos.", "Connect rates and inflation with assets.")],
    modules: [{ id: "macro-cycle", title: localized("El ciclo macroeconómico", "The macroeconomic cycle"), lessons: [lesson("inflacion", localized("Inflación", "Inflation"), 25, "lesson", standardBlocks("la inflación", "inflation")), lesson("tasas", localized("Tasas de interés", "Interest rates"), 28, "lesson", standardBlocks("las tasas de interés", "interest rates")), lesson("politica-monetaria", localized("Política monetaria", "Monetary policy"), 31, "video", standardBlocks("la política monetaria", "monetary policy"))] }],
  },
  {
    id: "decision-psychology",
    slug: "psicologia-decisiones",
    title: localized("Psicología y toma de decisiones", "Psychology and decision-making"),
    shortTitle: localized("Psicología financiera", "Financial psychology"),
    description: localized("Reconoce sesgos, diseña procesos y mejora la calidad de tus decisiones bajo presión.", "Recognize biases, design processes, and improve decision quality under pressure."),
    category: "psychology",
    level: "intermediate",
    durationMinutes: 145,
    rating: 4.9,
    students: 890,
    type: "course",
    featured: true,
    isNew: false,
    icon: "Brain",
    accent: "from-blue-500/25 via-cyan-500/10 to-transparent",
    outcomes: [localized("Reconocer sesgos frecuentes.", "Recognize common biases."), localized("Usar un diario de decisiones.", "Use a decision journal.")],
    modules: [{ id: "biases", title: localized("Sesgos y proceso", "Biases and process"), lessons: [lesson("sesgos", localized("Sesgos cognitivos", "Cognitive biases"), 20, "lesson", standardBlocks("los sesgos cognitivos", "cognitive biases")), lesson("emociones", localized("Decidir bajo presión", "Deciding under pressure"), 22, "lesson", standardBlocks("las decisiones bajo presión", "decisions under pressure")), lesson("diario", localized("Diario de decisiones", "Decision journal"), 24, "practice", standardBlocks("el diario de decisiones", "the decision journal"))] }],
  },
];

const paths = [
  {
    id: "path-market-intro",
    slug: "introduccion-mercados",
    title: localized("Introducción a los mercados", "Introduction to markets"),
    description: localized("La ruta inicial para comprender el sistema financiero y empezar a invertir con criterio.", "The starting path to understand the financial system and begin investing with judgment."),
    level: "beginner",
    durationMinutes: 430,
    certificate: true,
    icon: "Compass",
    courseIds: ["market-foundations", "investment-intro", "risk-management"],
  },
  {
    id: "path-trading",
    slug: "trading",
    title: localized("Trading con método", "Methodical trading"),
    description: localized("Del lenguaje del precio a un plan operativo con reglas de riesgo.", "From the language of price to a trading plan with risk rules."),
    level: "intermediate",
    durationMinutes: 520,
    certificate: true,
    icon: "CandlestickChart",
    courseIds: ["technical-analysis", "risk-management", "decision-psychology"],
  },
  {
    id: "path-analysis",
    slug: "analisis-integral",
    title: localized("Análisis integral", "Integrated analysis"),
    description: localized("Combina lectura técnica, fundamentos y contexto macroeconómico.", "Combine technical reading, fundamentals, and macroeconomic context."),
    level: "advanced",
    durationMinutes: 825,
    certificate: true,
    icon: "ScanSearch",
    courseIds: ["technical-analysis", "fundamental-analysis", "macro-markets"],
  },
  {
    id: "path-portfolio",
    slug: "gestor-portafolios",
    title: localized("Gestor de portafolios", "Portfolio manager"),
    description: localized("Diseña, controla y evalúa portafolios con una visión de conjunto.", "Design, control, and evaluate portfolios with a holistic view."),
    level: "intermediate",
    durationMinutes: 605,
    certificate: true,
    icon: "PieChart",
    courseIds: ["investment-intro", "portfolio-construction", "risk-management"],
  },
];

const localizeDeep = (value, locale) => {
  if (Array.isArray(value)) return value.map((item) => localizeDeep(item, locale));
  if (!value || typeof value !== "object") return value;
  if (Object.prototype.hasOwnProperty.call(value, "es") && Object.prototype.hasOwnProperty.call(value, "en")) {
    return value[locale] || value.es;
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, localizeDeep(item, locale)]));
};

export const resolveLearningLocale = (language = "es") => (String(language).toLowerCase().startsWith("en") ? "en" : "es");

export const getLearningCatalog = (language) => {
  const locale = resolveLearningLocale(language);
  return localizeDeep({ categories, courses, paths }, locale);
};

export const flattenCourseLessons = (course) =>
  (course?.modules || []).flatMap((module) =>
    module.lessons.map((item) => ({ ...item, moduleId: module.id, moduleTitle: module.title }))
  );

export const formatLearningDuration = (minutes, locale = "es") => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourLabel = resolveLearningLocale(locale) === "en" ? "h" : "h";
  return rest ? `${hours} ${hourLabel} ${rest} min` : `${hours} ${hourLabel}`;
};
