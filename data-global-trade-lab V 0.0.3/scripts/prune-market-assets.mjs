import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ENABLED_DATABASE_SYMBOLS = Object.freeze([
  "BTC/USD",
  "BTCUSD",
  "ETH/USD",
  "ETHUSD",
  "QQQ",
  "DIA",
  "SPY",
  "NU",
  "NVDA",
]);

const MARKET_TABLES = Object.freeze([
  { table: "quote_history", symbolColumn: "requested_symbol" },
  { table: "last_candle_market", symbolColumn: "symbol" },
  { table: "market_candles", symbolColumn: "requested_symbol", bucketColumn: "interval" },
  { table: "candles", symbolColumn: "instrument_id", bucketColumn: "timeframe" },
]);

function readEnvFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const env = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    env[key] = value;
  }

  return env;
}

async function countRows(query, context) {
  const { count, error } = await query;
  if (error) {
    const details = [error.message, error.details, error.hint, error.code].filter(Boolean).join(" | ");
    throw new Error(`${context}: ${details || "error sin detalles"}`);
  }
  return count ?? 0;
}

async function discoverColumnValues(supabase, table, column, filters = []) {
  const values = [];
  let lastValue = null;

  while (true) {
    let query = supabase.from(table).select(column).order(column, { ascending: true }).limit(1);
    for (const [filterColumn, filterValue] of filters) {
      query = query.eq(filterColumn, filterValue);
    }
    if (lastValue !== null) {
      query = query.gt(column, lastValue);
    }

    const { data, error } = await query;
    if (error) {
      const details = [error.message, error.details, error.hint, error.code].filter(Boolean).join(" | ");
      throw new Error(`No se pudieron listar valores de ${table}.${column}: ${details || "error sin detalles"}`);
    }

    const nextValue = data?.[0]?.[column];
    if (nextValue == null) break;
    values.push(String(nextValue));
    lastValue = nextValue;
  }

  return values;
}

async function getTableState(supabase, { table, symbolColumn }) {
  const symbols = await discoverColumnValues(supabase, table, symbolColumn);
  const rowsBySymbol = [];

  for (const symbol of symbols) {
    const count = await countRows(
      supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq(symbolColumn, symbol),
      `No se pudo contar ${table}.${symbol}`
    );
    rowsBySymbol.push({ symbol, count });
  }

  const enabled = rowsBySymbol
    .filter(({ symbol }) => ENABLED_DATABASE_SYMBOLS.includes(symbol))
    .reduce((sum, { count }) => sum + count, 0);
  const toDelete = rowsBySymbol
    .filter(({ symbol }) => !ENABLED_DATABASE_SYMBOLS.includes(symbol))
    .reduce((sum, { count }) => sum + count, 0);

  return {
    table,
    symbolColumn,
    total: enabled + toDelete,
    enabled,
    toDelete,
    disabledSymbols: rowsBySymbol
      .filter(({ symbol }) => !ENABLED_DATABASE_SYMBOLS.includes(symbol))
      .map(({ symbol }) => symbol),
  };
}

async function deleteDisabledRows(supabase, tableConfig, disabledSymbols) {
  const { table, symbolColumn, bucketColumn } = tableConfig;

  for (const symbol of disabledSymbols) {
    const buckets = bucketColumn
      ? await discoverColumnValues(supabase, table, bucketColumn, [[symbolColumn, symbol]])
      : [null];

    for (const bucket of buckets) {
      let query = supabase.from(table).delete().eq(symbolColumn, symbol);
      if (bucketColumn && bucket !== null) {
        query = query.eq(bucketColumn, bucket);
      }

      const { error } = await query;
      if (error) {
        const details = [error.message, error.details, error.hint, error.code].filter(Boolean).join(" | ");
        const bucketLabel = bucketColumn ? ` (${bucketColumn}=${bucket})` : "";
        throw new Error(
          `No se pudo eliminar ${symbol} de ${table}${bucketLabel}: ${details || "error sin detalles"}`
        );
      }
    }
  }
}

async function main() {
  const shouldApply = process.argv.includes("--apply");
  const root = path.resolve(process.cwd());
  const env = readEnvFile(path.join(root, ".env.local"));
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Activos conservados: ${ENABLED_DATABASE_SYMBOLS.join(", ")}`);
  const before = [];
  for (const tableConfig of MARKET_TABLES) {
    before.push(await getTableState(supabase, tableConfig));
  }
  console.table(before.map((row) => ({
    table: row.table,
    symbolColumn: row.symbolColumn,
    total: row.total,
    enabled: row.enabled,
    toDelete: row.toDelete,
  })));
  before.forEach(({ table, disabledSymbols }) => {
    console.log(`${table}: ${disabledSymbols.join(", ") || "sin activos deshabilitados"}`);
  });

  if (!shouldApply) {
    console.log("Simulacion completada. Ejecuta con --apply para confirmar la eliminacion.");
    return;
  }

  for (const tableConfig of MARKET_TABLES) {
    const tableState = before.find(({ table }) => table === tableConfig.table);
    await deleteDisabledRows(supabase, tableConfig, tableState?.disabledSymbols ?? []);
  }

  const after = [];
  for (const tableConfig of MARKET_TABLES) {
    after.push(await getTableState(supabase, tableConfig));
  }
  console.table(after.map((row) => ({
    table: row.table,
    symbolColumn: row.symbolColumn,
    total: row.total,
    enabled: row.enabled,
    toDelete: row.toDelete,
  })));

  const remainingDisabledRows = after.reduce((sum, row) => sum + row.toDelete, 0);
  if (remainingDisabledRows !== 0) {
    throw new Error(`La verificacion encontro ${remainingDisabledRows} filas de activos deshabilitados.`);
  }

  console.log("Eliminacion verificada: no quedan datos de mercado para activos deshabilitados.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
