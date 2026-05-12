import i18n from "@/Languages/i18n";
import { resolveLocale } from "@/lib/locale";

const readCurrentPreferences = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const currentUserId = window.localStorage.getItem('currentTradingUserId');
    const rawStore = window.localStorage.getItem('gtlPreferencesExtras');

    if (!currentUserId || !rawStore) {
      return {};
    }

    const parsedStore = JSON.parse(rawStore);
    return parsedStore?.[currentUserId] || {};
  } catch {
    return {};
  }
};

export const generateMarketData = (symbol, currency = 'USD', baseVolatility = 0.02, numPoints = 300) => {
  let basePrice;
  switch (symbol) {
    case 'AAPL': basePrice = 215; break;
    case 'MSFT': basePrice = 425; break;
    case 'AMZN': basePrice = 180; break;
    case 'GOOGL': basePrice = 165; break;
    case 'NVDA': basePrice = 910; break;
    case 'TSLA': basePrice = 175; break;
    case 'META': basePrice = 505; break;
    case 'BRK.B': basePrice = 420; break;
    case 'JPM': basePrice = 198; break;
    case 'JNJ': basePrice = 155; break;
    case 'QQQ': basePrice = 445; break;
    case 'DIA': basePrice = 390; break;
    case 'SPY': basePrice = 520; break;
    case 'BTCUSD': basePrice = 60000; break;
    case 'ETHUSD': basePrice = 3500; break;
    case 'ECOPETROL': basePrice = 2300; break;
    case 'BANCOLOMBIA': basePrice = 35000; break;
    case 'PFBCOLOM': basePrice = 29000; break;
    case 'GRUPOARGOS': basePrice = 11000; break;
    case 'GRUPOSURA': basePrice = 27000; break;
    case 'PFGRUPSURAAAa': basePrice = 20000; break;
    case 'ISA': basePrice = 17000; break;
    case 'CEMARGOS': basePrice = 4500; break;
    case 'CORFICOLCF': basePrice = 15000; break;
    case 'GRUPOAVAL': basePrice = 600; break;
    case 'CELSIA': basePrice = 3800; break;
    case 'NU': basePrice = 11.50; break;
    case 'XRPUSD': basePrice = 0.52; break;
    case 'ADAUSD': basePrice = 0.45; break;
    case 'SOLUSD': basePrice = 150; break;
    default: basePrice = 100;
  }

  const data = [];
  const now = new Date();
  let lastClose = basePrice;

  for (let i = 0; i < numPoints; i++) {
    const time = new Date(now.getTime() - (numPoints - i) * 60000);
    const open = lastClose * (1 + (Math.random() * baseVolatility * 0.2 - baseVolatility * 0.1));
    const close = open * (1 + (Math.random() * baseVolatility - baseVolatility * 0.5));
    const high = Math.max(open, close) * (1 + Math.random() * baseVolatility * 0.3);
    const low = Math.min(open, close) * (1 - Math.random() * baseVolatility * 0.3);
    lastClose = close;

    data.push({
      time,
      open: Math.max(0.0001, open),
      high: Math.max(0.0001, high),
      low: Math.max(0.0001, low),
      close: Math.max(0.0001, close),
      value: close,
      currency,
    });
  }

  return data;
};

export const formatCurrency = (value, currency = null, decimals = 2) => {
  const preferences = readCurrentPreferences();
  const resolvedCurrency = currency || preferences.preferredCurrency || 'USD';
  const locale = resolveLocale(preferences);

  if (value === undefined || value === null || Number.isNaN(value)) {
    value = 0;
  }

  let minFractionDigits = decimals;
  let maxFractionDigits = decimals;

  if (resolvedCurrency === 'COP') {
    minFractionDigits = 0;
    maxFractionDigits = 0;
  } else if (value !== 0 && Math.abs(value) < 0.01 && resolvedCurrency === 'USD') {
    minFractionDigits = Math.max(2, Math.min(6, value.toString().split('.')[1]?.length || 2));
    maxFractionDigits = minFractionDigits;
  } else if (value !== 0 && Math.abs(value) < 1 && resolvedCurrency === 'USD') {
    minFractionDigits = Math.min(4, Math.max(2, value.toString().split('.')[1]?.length || 2));
    maxFractionDigits = minFractionDigits;
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: resolvedCurrency,
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
};

export const formatPercentage = (value) => {
  const preferences = readCurrentPreferences();

  if (value === undefined || value === null || Number.isNaN(value)) {
    value = 0;
  }

  return new Intl.NumberFormat(resolveLocale(preferences), {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
};

export const formatDate = (dateString) => {
  const preferences = readCurrentPreferences();
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return i18n.t("common.date.invalid");
  }

  return new Intl.DateTimeFormat(resolveLocale(preferences), {
    year: 'numeric',
    month: preferences.dateFormat === 'YYYY-MM-DD' ? '2-digit' : 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: preferences.hourFormat === '12h',
  }).format(date);
};
