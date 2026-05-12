import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    env[key] = value;
  }
  return env;
}

function normalizeTime(value) {
  const isoLike = String(value ?? "").trim().replace(" ", "T");
  if (!isoLike) return null;
  const parsed = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(isoLike) ? isoLike : `${isoLike}Z`);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function parseNumber(value) {
  const num = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(num) ? num : null;
}

async function fetchTimeSeries(apiKey, symbol, interval, outputsize = 500) {
  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("outputsize", String(outputsize));
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`time_series ${symbol} ${interval} HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload?.status === "error" || payload?.code || payload?.message) {
    throw new Error(`time_series ${symbol} ${interval}: ${payload?.message ?? "unknown error"}`);
  }

  return payload;
}

async function main() {
  const root = path.resolve(process.cwd());
  const envPath = path.join(root, ".env.local");
  const env = readEnvFile(envPath);

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const twelveDataApiKey = env.TWELVEDATA_API_KEY;

  if (!supabaseUrl || !serviceRoleKey || !twelveDataApiKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or TWELVEDATA_API_KEY");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const symbol = "BTC/USD";
  const intervalMap = [
    { td: "1min", tf: "1m", outputsize: 1000 },
    { td: "5min", tf: "5m", outputsize: 1000 },
    { td: "15min", tf: "15m", outputsize: 1000 },
    { td: "1h", tf: "1h", outputsize: 1000 },
    { td: "1day", tf: "1d", outputsize: 1000 },
  ];

  for (const config of intervalMap) {
    const payload = await fetchTimeSeries(twelveDataApiKey, symbol, config.td, config.outputsize);
    const values = Array.isArray(payload?.values) ? payload.values : [];

    const rows = values
      .map((item) => {
        const open = parseNumber(item?.open);
        const high = parseNumber(item?.high);
        const low = parseNumber(item?.low);
        const close = parseNumber(item?.close);
        const openTime = normalizeTime(item?.datetime);
        if (!openTime || open == null || high == null || low == null || close == null) {
          return null;
        }

        return {
          exchange_id: payload?.meta?.exchange ?? "TWELVEDATA",
          instrument_id: symbol,
          timeframe: config.tf,
          open_time: openTime,
          requested_symbol: symbol,
          provider_symbol: payload?.meta?.symbol ?? symbol,
          exchange: payload?.meta?.exchange ?? null,
          currency: payload?.meta?.currency ?? "USD",
          open_price: open,
          high_price: high,
          low_price: low,
          close_price: close,
          volume: parseNumber(item?.volume),
          provider: "twelvedata",
          source_range: "seed",
          is_final: true,
          fetched_at: new Date().toISOString(),
        };
      })
      .filter(Boolean);

    if (rows.length === 0) {
      console.log(`[seed] ${config.tf}: no rows`);
      continue;
    }

    const { error } = await supabase.from("candles").upsert(rows, {
      onConflict: "exchange_id,instrument_id,timeframe,open_time",
      ignoreDuplicates: false,
    });

    if (error) {
      throw new Error(`[seed] ${config.tf} upsert failed: ${error.message}`);
    }

    console.log(`[seed] ${config.tf}: upserted ${rows.length} rows`);
  }

  console.log("[seed] done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

