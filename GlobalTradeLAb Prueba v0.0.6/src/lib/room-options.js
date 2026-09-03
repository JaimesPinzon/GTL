export const ROOM_CURRENCY_OPTIONS = [
  {
    code: "USD",
    label: "USD - Dolar estadounidense",
    defaultBaseBalance: 2500,
  },
  {
    code: "COP",
    label: "COP - Peso colombiano",
    defaultBaseBalance: 100000000,
  },
];

export const ROOM_MARKET_OPTIONS = [
  { id: "forex", label: "Forex" },
  { id: "crypto", label: "Crypto" },
  { id: "stocks", label: "Acciones" },
  { id: "indices", label: "Indices" },
  { id: "commodities", label: "Commodities" },
];

export const getDefaultRoomBalanceForCurrency = (currencyCode) => {
  const normalizedCode = String(currencyCode || "USD").trim().toUpperCase();
  const match = ROOM_CURRENCY_OPTIONS.find((currency) => currency.code === normalizedCode);
  return Number(match?.defaultBaseBalance ?? ROOM_CURRENCY_OPTIONS[0].defaultBaseBalance);
};

