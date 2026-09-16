import { parseTimezoneOffsetMinutes } from "./timezones";

export const normalizeTimestampToUnixSeconds = (timeValue) => {
  if (timeValue == null) {
    return null;
  }

  if (typeof timeValue === "number" && Number.isFinite(timeValue)) {
    return timeValue > 1e12 ? Math.floor(timeValue / 1000) : Math.floor(timeValue);
  }

  if (typeof timeValue === "string") {
    const trimmedValue = timeValue.trim();
    const numericValue = Number(trimmedValue);

    if (Number.isFinite(numericValue) && trimmedValue !== "") {
      return numericValue > 1e12 ? Math.floor(numericValue / 1000) : Math.floor(numericValue);
    }

    const normalizedValue = trimmedValue.replace(" ", "T");
    const hasExplicitTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(normalizedValue);
    const timestamp = new Date(
      hasExplicitTimezone ? normalizedValue : `${normalizedValue}Z`
    ).getTime();

    return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : null;
  }

  const date = timeValue instanceof Date ? timeValue : new Date(timeValue);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : null;
};

export const getTimeBucketStart = (timeValue, timeframe, timezone = null) => {
  const normalizedSeconds = normalizeTimestampToUnixSeconds(timeValue);
  if (!Number.isFinite(normalizedSeconds)) {
    return null;
  }

  const timezoneOffsetMinutes = parseTimezoneOffsetMinutes(timezone) ?? 0;
  const shiftedSeconds = normalizedSeconds + timezoneOffsetMinutes * 60;
  const bucketDate = new Date(shiftedSeconds * 1000);

  const toUtcBucketSeconds = () =>
    Math.floor(bucketDate.getTime() / 1000) - timezoneOffsetMinutes * 60;

  switch (timeframe) {
    case "1m":
      bucketDate.setUTCSeconds(0, 0);
      return toUtcBucketSeconds();
    case "2m":
      bucketDate.setUTCSeconds(0, 0);
      bucketDate.setUTCMinutes(Math.floor(bucketDate.getUTCMinutes() / 2) * 2);
      return toUtcBucketSeconds();
    case "3m":
      bucketDate.setUTCSeconds(0, 0);
      bucketDate.setUTCMinutes(Math.floor(bucketDate.getUTCMinutes() / 3) * 3);
      return toUtcBucketSeconds();
    case "4m":
      bucketDate.setUTCSeconds(0, 0);
      bucketDate.setUTCMinutes(Math.floor(bucketDate.getUTCMinutes() / 4) * 4);
      return toUtcBucketSeconds();
    case "5m":
      bucketDate.setUTCSeconds(0, 0);
      bucketDate.setUTCMinutes(Math.floor(bucketDate.getUTCMinutes() / 5) * 5);
      return toUtcBucketSeconds();
    case "10m":
      bucketDate.setUTCSeconds(0, 0);
      bucketDate.setUTCMinutes(Math.floor(bucketDate.getUTCMinutes() / 10) * 10);
      return toUtcBucketSeconds();
    case "15m":
      bucketDate.setUTCSeconds(0, 0);
      bucketDate.setUTCMinutes(Math.floor(bucketDate.getUTCMinutes() / 15) * 15);
      return toUtcBucketSeconds();
    case "30m":
      bucketDate.setUTCSeconds(0, 0);
      bucketDate.setUTCMinutes(Math.floor(bucketDate.getUTCMinutes() / 30) * 30);
      return toUtcBucketSeconds();
    case "45m":
      bucketDate.setUTCSeconds(0, 0);
      bucketDate.setUTCMinutes(Math.floor(bucketDate.getUTCMinutes() / 45) * 45);
      return toUtcBucketSeconds();
    case "1H":
      bucketDate.setUTCMinutes(0, 0, 0);
      return toUtcBucketSeconds();
    case "2H":
      bucketDate.setUTCMinutes(0, 0, 0);
      bucketDate.setUTCHours(Math.floor(bucketDate.getUTCHours() / 2) * 2);
      return toUtcBucketSeconds();
    case "3H":
      bucketDate.setUTCMinutes(0, 0, 0);
      bucketDate.setUTCHours(Math.floor(bucketDate.getUTCHours() / 3) * 3);
      return toUtcBucketSeconds();
    case "4H":
      bucketDate.setUTCMinutes(0, 0, 0);
      bucketDate.setUTCHours(Math.floor(bucketDate.getUTCHours() / 4) * 4);
      return toUtcBucketSeconds();
    case "1D":
      bucketDate.setUTCHours(0, 0, 0, 0);
      return toUtcBucketSeconds();
    case "1W": {
      bucketDate.setUTCHours(0, 0, 0, 0);
      const day = bucketDate.getUTCDay();
      const diff = (day + 6) % 7;
      bucketDate.setUTCDate(bucketDate.getUTCDate() - diff);
      return toUtcBucketSeconds();
    }
    case "1M":
      return Math.floor(Date.UTC(bucketDate.getUTCFullYear(), bucketDate.getUTCMonth(), 1) / 1000) - timezoneOffsetMinutes * 60;
    case "3M":
      return Math.floor(Date.UTC(
        bucketDate.getUTCFullYear(),
        Math.floor(bucketDate.getUTCMonth() / 3) * 3,
        1
      ) / 1000) - timezoneOffsetMinutes * 60;
    case "6M":
      return Math.floor(Date.UTC(
        bucketDate.getUTCFullYear(),
        Math.floor(bucketDate.getUTCMonth() / 6) * 6,
        1
      ) / 1000) - timezoneOffsetMinutes * 60;
    case "1Y":
      return Math.floor(Date.UTC(bucketDate.getUTCFullYear(), 0, 1) / 1000) - timezoneOffsetMinutes * 60;
    case "3Y":
      return Math.floor(Date.UTC(Math.floor(bucketDate.getUTCFullYear() / 3) * 3, 0, 1) / 1000) - timezoneOffsetMinutes * 60;
    case "5Y":
      return Math.floor(Date.UTC(Math.floor(bucketDate.getUTCFullYear() / 5) * 5, 0, 1) / 1000) - timezoneOffsetMinutes * 60;
    default:
      return normalizedSeconds;
  }
};
