const DEFAULT_TIMEZONE = "(UTC-05:00) Bogota";

export const getDefaultTimezone = () => DEFAULT_TIMEZONE;

export const parseTimezoneOffsetMinutes = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim().toUpperCase();

  if (normalizedValue === "UTC" || normalizedValue === "(UTC)") {
    return 0;
  }

  const match = normalizedValue.match(/UTC([+-])(\d{1,2})(?::?(\d{2}))?/);

  if (!match) {
    return null;
  }

  const [, sign, hours, minutes = "00"] = match;
  const totalMinutes = Number(hours) * 60 + Number(minutes);

  return sign === "-" ? -totalMinutes : totalMinutes;
};

export const formatTimezoneOffsetLabel = (value) => {
  const offsetMinutes = parseTimezoneOffsetMinutes(value);

  if (offsetMinutes === null) {
    return "UTC";
  }

  if (offsetMinutes === 0) {
    return "UTC";
  }

  const sign = offsetMinutes < 0 ? "-" : "+";
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, "0");
  const minutes = String(absoluteMinutes % 60).padStart(2, "0");

  return `UTC${sign}${hours}:${minutes}`;
};

export const formatTimezoneOffsetCompact = (value) => {
  const offsetMinutes = parseTimezoneOffsetMinutes(value);

  if (offsetMinutes === null || offsetMinutes === 0) {
    return "UTC";
  }

  const sign = offsetMinutes < 0 ? "-" : "+";
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;

  return minutes === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${String(minutes).padStart(2, "0")}`;
};

export const getTimezoneMarketLabel = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  const marketLabelMatch = value.match(/\)\s*(.+)$/);
  return marketLabelMatch ? marketLabelMatch[1].trim() : value.trim();
};

export const normalizeTimezoneValue = (
  value,
  availableTimezones = [],
  fallback = DEFAULT_TIMEZONE
) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }

  if (availableTimezones.includes(value)) {
    return value;
  }

  const normalizedOffset = formatTimezoneOffsetLabel(value);
  const matchedTimezone = availableTimezones.find(
    (timezone) => formatTimezoneOffsetLabel(timezone) === normalizedOffset
  );

  return matchedTimezone || value;
};

export const convertUnixSecondsToTimezone = (
  unixSeconds,
  targetTimezone,
  sourceTimezone = "UTC"
) => {
  if (!Number.isFinite(unixSeconds)) {
    return unixSeconds;
  }

  const sourceOffsetMinutes = parseTimezoneOffsetMinutes(sourceTimezone) ?? 0;
  const targetOffsetMinutes = parseTimezoneOffsetMinutes(targetTimezone) ?? 0;
  const differenceInSeconds = (targetOffsetMinutes - sourceOffsetMinutes) * 60;

  return unixSeconds + differenceInSeconds;
};

export const shiftSeriesToTimezone = (series = [], targetTimezone) =>
  (Array.isArray(series) ? series : []).map((entry) => {
    const sourceTimezone =
      entry?.sourceTimezone ||
      entry?.timezone ||
      entry?.exchangeTimezone ||
      "UTC";

    return {
      ...entry,
      time: convertUnixSecondsToTimezone(entry?.time, targetTimezone, sourceTimezone),
    };
  });

export const formatUnixSecondsInTimezone = (
  unixSeconds,
  timezone,
  locale = "es-CO",
  formatOptions = {}
) => {
  const shiftedUnixSeconds = convertUnixSecondsToTimezone(unixSeconds, timezone, "UTC");
  const date = new Date(shiftedUnixSeconds * 1000);

  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    ...formatOptions,
  }).format(date);
};
