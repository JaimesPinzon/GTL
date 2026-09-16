import { NextRequest } from "next/server";

import { supabaseAdmin } from "@/app/utils/supabase/admin";
import { authJson, authOptionsResponse, getAuthenticatedUser, validateAllowedOrigin, withAuthErrors } from "@/modules/auth";
import { AuthHttpError } from "@/modules/auth/errors";
import { generateSyntheticTicks } from "@/modules/financial-lab/engine";
import { requireInteger, requireNumber, requireText, requireUuid } from "@/modules/financial-lab/validation";

export const runtime = "nodejs";
export const OPTIONS = authOptionsResponse;

const missingSchemaCodes = new Set(["42P01", "PGRST205", "PGRST204"]);

function databaseError(error: { code?: string; message?: string } | null, fallback = "No se pudo completar la operación del laboratorio.") {
  if (!error) return;
  if (missingSchemaCodes.has(error.code || "")) {
    throw new AuthHttpError(503, "El Laboratorio Financiero requiere aplicar la migración financial_lab_mvp.");
  }
  if (error.code === "23505") throw new AuthHttpError(409, "Ya existe un registro con esos datos.");
  if (error.code === "23503" || error.code === "23514") throw new AuthHttpError(400, "La configuración contiene valores incompatibles.");
  console.error("financial lab database error", { code: error.code, message: error.message });
  throw new AuthHttpError(500, fallback);
}

async function actor(request: NextRequest) {
  validateAllowedOrigin(request);
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new AuthHttpError(401, "Inicia sesión para abrir el laboratorio.");
  return getAuthenticatedUser(token);
}

async function roomAccess(userId: string, roomId: string) {
  const { data: room, error: roomError } = await supabaseAdmin
    .from("rooms")
    .select("id, name, created_by, default_currency")
    .eq("id", roomId)
    .maybeSingle();
  databaseError(roomError);
  if (!room) throw new AuthHttpError(404, "La clase no existe.");

  if (room.created_by === userId) return { room, role: "teacher" as const };

  const { data: membership, error } = await supabaseAdmin
    .from("room_members")
    .select("role_in_room, state")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .eq("state", "active")
    .maybeSingle();
  databaseError(error);
  if (!membership) throw new AuthHttpError(403, "No perteneces a esta clase.");
  return { room, role: membership.role_in_room as "teacher" | "monitor" | "student" };
}

const isStaff = (role: string) => role === "teacher" || role === "monitor";

async function requireStaff(userId: string, roomId: string) {
  const access = await roomAccess(userId, roomId);
  if (!isStaff(access.role)) throw new AuthHttpError(403, "Sólo el docente puede configurar el laboratorio.");
  return access;
}

async function getScenarioBundle(scenarioId: string) {
  const { data: scenario, error } = await supabaseAdmin
    .from("lab_scenarios")
    .select("*, market:lab_synthetic_markets(*, assets:lab_synthetic_assets(*)), timeline:lab_scenario_events(*, event:lab_events(*))")
    .eq("id", scenarioId)
    .maybeSingle();
  databaseError(error);
  if (!scenario) throw new AuthHttpError(404, "El escenario no existe.");
  return scenario;
}

async function getSessionBundle(sessionId: string, userId: string, role: string) {
  const { data: session, error } = await supabaseAdmin
    .from("lab_simulation_sessions")
    .select("*, scenario:lab_scenarios(*, market:lab_synthetic_markets(*, assets:lab_synthetic_assets(*)), timeline:lab_scenario_events(*, event:lab_events(*)))")
    .eq("id", sessionId)
    .maybeSingle();
  databaseError(error);
  if (!session) throw new AuthHttpError(404, "La sesión no existe.");

  const maxPeriod = isStaff(role) ? Number(session.scenario?.duration_periods || 0) : Number(session.current_period || 0);
  const ticksQuery = supabaseAdmin
    .from("lab_simulation_ticks")
    .select("*")
    .eq("session_id", sessionId)
    .lte("period", maxPeriod)
    .order("period", { ascending: true });
  const positionsQuery = supabaseAdmin
    .from("lab_positions")
    .select("*, asset:lab_synthetic_assets(id,name,symbol)")
    .eq("session_id", sessionId);
  const actionsQuery = supabaseAdmin
    .from("lab_simulation_actions")
    .select("*, asset:lab_synthetic_assets(id,name,symbol)")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(isStaff(role) ? 200 : 50);
  const participantsQuery = supabaseAdmin
    .from("lab_session_participants")
    .select("*, profile:profiles(user_id,name,email)")
    .eq("session_id", sessionId);

  if (!isStaff(role)) {
    positionsQuery.eq("user_id", userId);
    actionsQuery.eq("user_id", userId);
    participantsQuery.eq("user_id", userId);
  }

  const [ticksResult, positionsResult, actionsResult, participantsResult, interventionsResult] = await Promise.all([
    ticksQuery,
    positionsQuery,
    actionsQuery,
    participantsQuery,
    isStaff(role)
      ? supabaseAdmin.from("lab_teacher_interventions").select("*").eq("session_id", sessionId).order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null }),
  ]);
  databaseError(ticksResult.error);
  databaseError(positionsResult.error);
  databaseError(actionsResult.error);
  databaseError(participantsResult.error);
  databaseError(interventionsResult.error);

  const timeline = Array.isArray(session.scenario?.timeline) ? session.scenario.timeline : [];
  const visibleTimeline = isStaff(role)
    ? timeline
    : timeline.filter((item: { activation_period: number }) => Number(item.activation_period) <= Number(session.current_period));

  return {
    ...session,
    scenario: { ...session.scenario, timeline: visibleTimeline },
    ticks: ticksResult.data || [],
    positions: positionsResult.data || [],
    actions: actionsResult.data || [],
    participants: participantsResult.data || [],
    interventions: interventionsResult.data || [],
  };
}

export async function GET(request: NextRequest) {
  return withAuthErrors(request, async () => {
    const user = await actor(request);
    const roomId = requireUuid(request.nextUrl.searchParams.get("roomId"), "identificador de clase");
    const access = await roomAccess(user.id, roomId);
    const sessionIdValue = request.nextUrl.searchParams.get("sessionId");
    const sessionId = sessionIdValue ? requireUuid(sessionIdValue, "identificador de sesión") : null;

    if (!isStaff(access.role)) {
      const { data: sessions, error } = await supabaseAdmin
        .from("lab_simulation_sessions")
        .select("id, name, state, current_period, speed, initial_balance, started_at, finished_at, scenario:lab_scenarios(id,name,duration_periods,academic_objective)")
        .eq("room_id", roomId)
        .in("state", ["active", "paused", "finished"])
        .order("created_at", { ascending: false });
      databaseError(error);
      const selectedId = sessionId || sessions?.[0]?.id || null;
      const selectedSession = selectedId ? await getSessionBundle(selectedId, user.id, access.role) : null;
      if (selectedSession && selectedSession.room_id !== roomId) throw new AuthHttpError(403, "La sesión no pertenece a esta clase.");
      return authJson(request, { ok: true, role: access.role, room: access.room, sessions: sessions || [], selectedSession });
    }

    const [marketsResult, eventsResult, scenariosResult, sessionsResult] = await Promise.all([
      supabaseAdmin
        .from("lab_synthetic_markets")
        .select("*, assets:lab_synthetic_assets(*)")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("lab_events")
        .select("*")
        .or(`created_by.eq.${user.id},event_kind.eq.base`)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("lab_scenarios")
        .select("*, market:lab_synthetic_markets(id,name,base_currency), timeline:lab_scenario_events(*, event:lab_events(id,name,headline,direction))")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("lab_simulation_sessions")
        .select("*, scenario:lab_scenarios(id,name,duration_periods)")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false }),
    ]);
    databaseError(marketsResult.error);
    databaseError(eventsResult.error);
    databaseError(scenariosResult.error);
    databaseError(sessionsResult.error);
    const selectedId = sessionId || sessionsResult.data?.find((item) => ["active", "paused"].includes(item.state))?.id || null;
    const selectedSession = selectedId ? await getSessionBundle(selectedId, user.id, access.role) : null;
    if (selectedSession && selectedSession.room_id !== roomId) throw new AuthHttpError(403, "La sesión no pertenece a esta clase.");

    return authJson(request, {
      ok: true,
      role: access.role,
      room: access.room,
      markets: marketsResult.data || [],
      events: eventsResult.data || [],
      scenarios: scenariosResult.data || [],
      sessions: sessionsResult.data || [],
      selectedSession,
    });
  });
}

async function createMarket(userId: string, body: Record<string, unknown>) {
  const roomId = requireUuid(body.roomId, "identificador de clase");
  await requireStaff(userId, roomId);
  const market = (body.market || {}) as Record<string, unknown>;
  const assets = Array.isArray(body.assets) ? (body.assets as Record<string, unknown>[]) : [];
  if (assets.length < 1 || assets.length > 20) throw new AuthHttpError(400, "Agrega entre 1 y 20 activos sintéticos.");
  const timeframe = requireInteger(market.timeframeMinutes, "Frecuencia", 1, 1440);
  if (![1, 5, 15, 60, 1440].includes(timeframe)) throw new AuthHttpError(400, "La frecuencia seleccionada no está disponible.");

  const marketRow = {
    created_by: userId,
    name: requireText(market.name, "Nombre", 120, 3),
    description: typeof market.description === "string" ? market.description.trim().slice(0, 2000) : "",
    market_type: ["stocks", "forex", "commodities", "bonds", "crypto", "mixed"].includes(String(market.marketType)) ? market.marketType : "stocks",
    base_currency: requireText(market.baseCurrency || "USD", "Moneda", 3, 3).toUpperCase(),
    start_at: new Date(String(market.startAt || new Date().toISOString())).toISOString(),
    duration_periods: requireInteger(market.durationPeriods, "Duración", 10, 1000),
    timeframe_minutes: timeframe,
    configuration_mode: market.configurationMode === "advanced" ? "advanced" : "basic",
    trend: ["bullish", "bearish", "sideways", "custom"].includes(String(market.trend)) ? market.trend : "sideways",
    expected_return: requireNumber(market.expectedReturn ?? 0, "Rendimiento", -0.2, 0.2),
    volatility: requireNumber(market.volatility ?? 0.012, "Volatilidad", 0.0001, 1),
    liquidity: requireNumber(market.liquidity ?? 1000000, "Liquidez", 1, 1e15),
    average_volume: requireNumber(market.averageVolume ?? 100000, "Volumen", 1, 1e15),
    spread_bps: requireNumber(market.spreadBps ?? 10, "Spread", 0, 10000),
    jump_probability: requireNumber(market.jumpProbability ?? 0, "Probabilidad de salto", 0, 1),
    jump_magnitude: requireNumber(market.jumpMagnitude ?? 0, "Magnitud de salto", 0, 1),
    mean_reversion: requireNumber(market.meanReversion ?? 0, "Reversión", 0, 1),
    max_period_change: requireNumber(market.maxPeriodChange ?? 0.2, "Límite por periodo", 0.0001, 1),
    starting_balance: requireNumber(market.startingBalance ?? 100000, "Saldo inicial", 1, 1e15),
    seed: requireInteger(market.seed ?? 2026, "Semilla", 1, 2147483647),
    status: "available",
  };
  const { data: created, error } = await supabaseAdmin.from("lab_synthetic_markets").insert(marketRow).select("*").single();
  databaseError(error);

  const assetRows = assets.map((asset) => ({
    market_id: created.id,
    name: requireText(asset.name, "Nombre del activo", 120, 2),
    symbol: requireText(asset.symbol, "Símbolo", 15).toUpperCase(),
    sector: typeof asset.sector === "string" ? asset.sector.trim().slice(0, 100) || "General" : "General",
    initial_price: requireNumber(asset.initialPrice, "Precio inicial", 0.000001, 1e12),
    available_quantity: requireNumber(asset.availableQuantity ?? 500000, "Cantidad disponible", 0.000001, 1e18),
    currency: requireText(asset.currency || marketRow.base_currency, "Divisa", 3, 3).toUpperCase(),
    short_selling: Boolean(asset.shortSelling),
    max_leverage: requireNumber(asset.maxLeverage ?? 1, "Apalancamiento", 1, 20),
    commission_bps: requireNumber(asset.commissionBps ?? 0, "Comisión", 0, 10000),
  }));
  const { error: assetsError } = await supabaseAdmin.from("lab_synthetic_assets").insert(assetRows);
  if (assetsError) {
    await supabaseAdmin.from("lab_synthetic_markets").delete().eq("id", created.id);
    databaseError(assetsError, "No se pudieron guardar los activos sintéticos.");
  }
  return created;
}

async function createEvent(userId: string, body: Record<string, unknown>) {
  const roomId = requireUuid(body.roomId, "identificador de clase");
  await requireStaff(userId, roomId);
  const event = (body.event || {}) as Record<string, unknown>;
  const { data, error } = await supabaseAdmin
    .from("lab_events")
    .insert({
      created_by: userId,
      source_event_id: event.sourceEventId ? requireUuid(event.sourceEventId, "evento de origen") : null,
      event_kind: event.sourceEventId ? "custom" : "custom",
      name: requireText(event.name, "Nombre", 140, 3),
      description: typeof event.description === "string" ? event.description.trim().slice(0, 3000) : "",
      category: typeof event.category === "string" ? event.category.trim().slice(0, 80) || "market" : "market",
      difficulty: ["basic", "intermediate", "advanced"].includes(String(event.difficulty)) ? event.difficulty : "intermediate",
      academic_objective: typeof event.academicObjective === "string" ? event.academicObjective.trim().slice(0, 1000) : "",
      activation_type: ["temporal", "manual"].includes(String(event.activationType)) ? event.activationType : "temporal",
      default_period: event.defaultPeriod == null ? null : requireInteger(event.defaultPeriod, "Periodo", 0, 1000),
      direction: ["positive", "negative", "mixed"].includes(String(event.direction)) ? event.direction : "negative",
      impact_percent: requireNumber(event.impactPercent ?? 0, "Impacto", -1, 1),
      volatility_multiplier: requireNumber(event.volatilityMultiplier ?? 1, "Multiplicador de volatilidad", 0.01, 20),
      duration_periods: requireInteger(event.durationPeriods ?? 1, "Duración", 1, 1000),
      headline: requireText(event.headline || event.name, "Titular", 220, 3),
      message: requireText(event.message || event.description || event.name, "Noticia", 5000, 3),
      simulated_source: requireText(event.simulatedSource || "Agencia GTL", "Fuente simulada", 120, 2),
      status: "published",
    })
    .select("*")
    .single();
  databaseError(error);
  return data;
}

async function createScenario(userId: string, body: Record<string, unknown>) {
  const roomId = requireUuid(body.roomId, "identificador de clase");
  await requireStaff(userId, roomId);
  const scenario = (body.scenario || {}) as Record<string, unknown>;
  const marketId = requireUuid(scenario.marketId, "mercado");
  const { data: market, error: marketError } = await supabaseAdmin
    .from("lab_synthetic_markets")
    .select("id, duration_periods")
    .eq("id", marketId)
    .eq("created_by", userId)
    .maybeSingle();
  databaseError(marketError);
  if (!market) throw new AuthHttpError(403, "No puedes utilizar ese mercado.");
  const duration = requireInteger(scenario.durationPeriods ?? market.duration_periods, "Duración", 10, Number(market.duration_periods));
  const timeline = Array.isArray(body.timeline) ? (body.timeline as Record<string, unknown>[]) : [];
  const timelineEventIds = [...new Set(timeline.map((item) => requireUuid(item.eventId, "evento")))];
  if (timelineEventIds.length) {
    const { data: allowedEvents, error: eventsError } = await supabaseAdmin
      .from("lab_events")
      .select("id")
      .in("id", timelineEventIds)
      .or(`created_by.eq.${userId},event_kind.eq.base`);
    databaseError(eventsError);
    if ((allowedEvents || []).length !== timelineEventIds.length) {
      throw new AuthHttpError(403, "La línea de tiempo contiene un evento al que no tienes acceso.");
    }
  }
  const { data: created, error } = await supabaseAdmin
    .from("lab_scenarios")
    .insert({
      market_id: marketId,
      room_id: roomId,
      created_by: userId,
      name: requireText(scenario.name, "Nombre", 140, 3),
      description: typeof scenario.description === "string" ? scenario.description.trim().slice(0, 3000) : "",
      academic_objective: requireText(scenario.academicObjective, "Objetivo académico", 1200, 3),
      duration_periods: duration,
      seed: requireInteger(scenario.seed ?? 2026, "Semilla", 1, 2147483647),
      status: "ready",
      locked_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  databaseError(error);

  if (timeline.length) {
    const rows = timeline.map((item) => ({
      scenario_id: created.id,
      event_id: requireUuid(item.eventId, "evento"),
      activation_period: requireInteger(item.activationPeriod, "Periodo del evento", 0, duration - 1),
      impact_override: item.impactOverride == null ? null : requireNumber(item.impactOverride, "Impacto", -1, 1),
    }));
    const { error: timelineError } = await supabaseAdmin.from("lab_scenario_events").insert(rows);
    if (timelineError) {
      await supabaseAdmin.from("lab_scenarios").delete().eq("id", created.id);
      databaseError(timelineError, "No se pudo construir la línea de tiempo.");
    }
  }
  return created;
}

async function launchSession(userId: string, body: Record<string, unknown>) {
  const roomId = requireUuid(body.roomId, "identificador de clase");
  await requireStaff(userId, roomId);
  const scenarioId = requireUuid(body.scenarioId, "escenario");
  const scenario = await getScenarioBundle(scenarioId);
  if (scenario.created_by !== userId || (scenario.room_id && scenario.room_id !== roomId)) {
    throw new AuthHttpError(403, "El escenario no pertenece a esta clase.");
  }
  if (!scenario.market || !Array.isArray(scenario.market.assets) || !scenario.market.assets.length) {
    throw new AuthHttpError(409, "El escenario no tiene activos configurados.");
  }
  const seed = requireInteger(body.seed ?? scenario.seed, "Semilla", 1, 2147483647);
  const { data: session, error } = await supabaseAdmin
    .from("lab_simulation_sessions")
    .insert({
      scenario_id: scenarioId,
      room_id: roomId,
      created_by: userId,
      name: requireText(body.name || scenario.name, "Nombre de la sesión", 140, 3),
      state: "active",
      current_period: 0,
      speed: 1,
      seed,
      initial_balance: requireNumber(body.initialBalance ?? scenario.market.starting_balance, "Saldo inicial", 1, 1e15),
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  databaseError(error);

  const ticks = generateSyntheticTicks({
    sessionId: session.id,
    seed,
    market: { ...scenario.market, duration_periods: scenario.duration_periods },
    assets: scenario.market.assets,
    events: scenario.timeline || [],
  });
  for (let index = 0; index < ticks.length; index += 500) {
    const { error: ticksError } = await supabaseAdmin.from("lab_simulation_ticks").insert(ticks.slice(index, index + 500));
    if (ticksError) {
      await supabaseAdmin.from("lab_simulation_sessions").delete().eq("id", session.id);
      databaseError(ticksError, "No se pudo generar la serie sintética.");
    }
  }
  await Promise.all([
    supabaseAdmin.from("lab_scenarios").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", scenarioId),
    supabaseAdmin.from("lab_synthetic_markets").update({ status: "in_use", updated_at: new Date().toISOString() }).eq("id", scenario.market_id),
    supabaseAdmin.from("lab_teacher_interventions").insert({ session_id: session.id, teacher_id: userId, action_type: "start", payload: { seed } }),
  ]);
  return session;
}

async function refreshParticipantEquity(sessionId: string, period: number) {
  const [participantsResult, positionsResult, pricesResult] = await Promise.all([
    supabaseAdmin.from("lab_session_participants").select("id, user_id, cash_balance").eq("session_id", sessionId),
    supabaseAdmin.from("lab_positions").select("user_id, asset_id, quantity").eq("session_id", sessionId),
    supabaseAdmin.from("lab_simulation_ticks").select("asset_id, close_price").eq("session_id", sessionId).eq("period", period),
  ]);
  databaseError(participantsResult.error);
  databaseError(positionsResult.error);
  databaseError(pricesResult.error);
  const prices = new Map((pricesResult.data || []).map((item) => [item.asset_id, Number(item.close_price)]));
  const positionsByUser = new Map<string, { asset_id: string; quantity: number | string }[]>();
  (positionsResult.data || []).forEach((position) => {
    const current = positionsByUser.get(position.user_id) || [];
    current.push(position);
    positionsByUser.set(position.user_id, current);
  });
  const updates = await Promise.all((participantsResult.data || []).map((participant) => {
    const marketValue = (positionsByUser.get(participant.user_id) || []).reduce(
      (total, position) => total + Number(position.quantity) * Number(prices.get(position.asset_id) || 0),
      0
    );
    return supabaseAdmin
      .from("lab_session_participants")
      .update({ equity: Number(participant.cash_balance) + marketValue, updated_at: new Date().toISOString() })
      .eq("id", participant.id);
  }));
  updates.forEach((result) => databaseError(result.error, "No se pudo valorar el patrimonio sintético."));
}

async function controlSession(userId: string, body: Record<string, unknown>) {
  const roomId = requireUuid(body.roomId, "identificador de clase");
  await requireStaff(userId, roomId);
  const sessionId = requireUuid(body.sessionId, "sesión");
  const command = String(body.command || "");
  const allowed = new Set(["pause", "resume", "advance", "reset", "finish", "speed_change"]);
  if (!allowed.has(command)) throw new AuthHttpError(400, "Control de sesión no reconocido.");
  const { data: session, error } = await supabaseAdmin
    .from("lab_simulation_sessions")
    .select("*, scenario:lab_scenarios(duration_periods)")
    .eq("id", sessionId)
    .eq("room_id", roomId)
    .maybeSingle();
  databaseError(error);
  if (!session) throw new AuthHttpError(404, "La sesión no existe.");

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (command === "pause") update.state = "paused";
  if (command === "resume") update.state = "active";
  if (command === "advance") {
    const next = Math.min(Number(session.current_period) + 1, Number(session.scenario?.duration_periods) - 1);
    update.current_period = next;
    if (next >= Number(session.scenario?.duration_periods) - 1) {
      update.state = "finished";
      update.finished_at = new Date().toISOString();
    }
  }
  if (command === "finish") {
    update.state = "finished";
    update.finished_at = new Date().toISOString();
  }
  if (command === "speed_change") update.speed = requireNumber(body.speed, "Velocidad", 0.25, 60);
  if (command === "reset") {
    update.current_period = 0;
    update.state = "active";
    update.finished_at = null;
    const [actionsReset, positionsReset, participantsReset] = await Promise.all([
      supabaseAdmin.from("lab_simulation_actions").delete().eq("session_id", sessionId),
      supabaseAdmin.from("lab_positions").delete().eq("session_id", sessionId),
      supabaseAdmin.from("lab_session_participants").delete().eq("session_id", sessionId),
    ]);
    databaseError(actionsReset.error, "No se pudo limpiar el historial de la sesión.");
    databaseError(positionsReset.error, "No se pudieron limpiar las posiciones de la sesión.");
    databaseError(participantsReset.error, "No se pudo reiniciar la sesión.");
  }
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("lab_simulation_sessions")
    .update(update)
    .eq("id", sessionId)
    .select("*")
    .single();
  databaseError(updateError);
  if (command === "advance") {
    await refreshParticipantEquity(sessionId, Number(updated.current_period));
  }
  await supabaseAdmin.from("lab_teacher_interventions").insert({
    session_id: sessionId,
    teacher_id: userId,
    action_type: command,
    payload: command === "speed_change" ? { speed: update.speed } : {},
  });
  return updated;
}

async function placeOrder(userId: string, body: Record<string, unknown>) {
  const roomId = requireUuid(body.roomId, "identificador de clase");
  const access = await roomAccess(userId, roomId);
  const sessionId = requireUuid(body.sessionId, "sesión");
  const assetId = requireUuid(body.assetId, "activo");
  const side = body.side === "sell" ? "sell" : body.side === "buy" ? "buy" : null;
  if (!side) throw new AuthHttpError(400, "Selecciona compra o venta.");
  const quantity = requireNumber(body.quantity, "Cantidad", 0.000001, 1e12);
  const justification = requireText(body.justification, "Justificación", 5000, 3);
  const { data: session, error } = await supabaseAdmin
    .from("lab_simulation_sessions")
    .select("id, room_id, state, current_period, initial_balance, scenario:lab_scenarios(market_id)")
    .eq("id", sessionId)
    .eq("room_id", roomId)
    .maybeSingle();
  databaseError(error);
  if (!session) throw new AuthHttpError(404, "La sesión no existe.");
  if (session.state !== "active") throw new AuthHttpError(409, "La sesión debe estar activa para operar.");
  if (isStaff(access.role)) throw new AuthHttpError(403, "El panel docente no registra operaciones de estudiante.");
  const sessionScenario = Array.isArray(session.scenario) ? session.scenario[0] : session.scenario;

  const [{ data: asset, error: assetError }, { data: tick, error: tickError }] = await Promise.all([
    supabaseAdmin.from("lab_synthetic_assets").select("*").eq("id", assetId).eq("market_id", sessionScenario?.market_id).maybeSingle(),
    supabaseAdmin.from("lab_simulation_ticks").select("close_price").eq("session_id", sessionId).eq("asset_id", assetId).eq("period", session.current_period).maybeSingle(),
  ]);
  databaseError(assetError);
  databaseError(tickError);
  if (!asset || !tick) throw new AuthHttpError(400, "El activo no está disponible en esta sesión.");

  const { data: existingParticipant, error: participantError } = await supabaseAdmin
    .from("lab_session_participants")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  databaseError(participantError);
  let participant = existingParticipant;
  if (!participant) {
    const created = await supabaseAdmin
      .from("lab_session_participants")
      .insert({ session_id: sessionId, user_id: userId, cash_balance: session.initial_balance, equity: session.initial_balance })
      .select("*")
      .single();
    databaseError(created.error);
    participant = created.data;
  }

  const { data: currentPosition, error: positionError } = await supabaseAdmin
    .from("lab_positions")
    .select("*")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .eq("asset_id", assetId)
    .maybeSingle();
  databaseError(positionError);
  const price = Number(tick.close_price);
  const signedQuantity = side === "buy" ? quantity : -quantity;
  const previousQuantity = Number(currentPosition?.quantity || 0);
  const nextQuantity = previousQuantity + signedQuantity;
  if (!asset.short_selling && nextQuantity < 0) throw new AuthHttpError(409, "Este activo no permite posiciones cortas.");
  if (Math.abs(nextQuantity) > Number(asset.available_quantity)) throw new AuthHttpError(409, "La orden supera la cantidad disponible.");
  const notional = price * quantity;
  const commission = notional * (Number(asset.commission_bps || 0) / 10000);
  const cashDelta = side === "buy" ? -(notional + commission) : notional - commission;
  const nextCash = Number(participant.cash_balance) + cashDelta;
  if (nextCash < 0) throw new AuthHttpError(409, "Saldo sintético insuficiente.");

  let averagePrice = price;
  if (currentPosition && Math.sign(previousQuantity) === Math.sign(nextQuantity) && Math.sign(previousQuantity) === Math.sign(signedQuantity)) {
    averagePrice = (Math.abs(previousQuantity) * Number(currentPosition.average_price) + quantity * price) / Math.abs(nextQuantity);
  } else if (currentPosition && nextQuantity !== 0 && Math.sign(previousQuantity) === Math.sign(nextQuantity)) {
    averagePrice = Number(currentPosition.average_price);
  }

  const { data: createdAction, error: actionError } = await supabaseAdmin.from("lab_simulation_actions").insert({
    session_id: sessionId,
    user_id: userId,
    asset_id: assetId,
    period: session.current_period,
    action_type: side,
    quantity,
    execution_price: price,
    commission,
    justification,
  }).select("id").single();
  databaseError(actionError, "No se pudo registrar la orden.");

  try {
    if (Math.abs(nextQuantity) < 0.0000001) {
      const { error: deletePositionError } = await supabaseAdmin.from("lab_positions").delete().eq("session_id", sessionId).eq("user_id", userId).eq("asset_id", assetId);
      databaseError(deletePositionError, "No se pudo cerrar la posición.");
    } else {
      const { error: upsertError } = await supabaseAdmin.from("lab_positions").upsert(
        { session_id: sessionId, user_id: userId, asset_id: assetId, quantity: nextQuantity, average_price: averagePrice, updated_at: new Date().toISOString() },
        { onConflict: "session_id,user_id,asset_id" }
      );
      databaseError(upsertError, "No se pudo actualizar la posición.");
    }
  } catch (positionMutationError) {
    if (createdAction?.id) await supabaseAdmin.from("lab_simulation_actions").delete().eq("id", createdAction.id);
    throw positionMutationError;
  }

  const { data: allPositions } = await supabaseAdmin.from("lab_positions").select("asset_id, quantity").eq("session_id", sessionId).eq("user_id", userId);
  const assetIds = (allPositions || []).map((item) => item.asset_id);
  let marketValue = 0;
  if (assetIds.length) {
    const { data: prices } = await supabaseAdmin
      .from("lab_simulation_ticks")
      .select("asset_id, close_price")
      .eq("session_id", sessionId)
      .eq("period", session.current_period)
      .in("asset_id", assetIds);
    const pricesByAsset = new Map((prices || []).map((item) => [item.asset_id, Number(item.close_price)]));
    marketValue = (allPositions || []).reduce((sum, item) => sum + Number(item.quantity) * Number(pricesByAsset.get(item.asset_id) || 0), 0);
  }
  const equity = nextCash + marketValue;
  const closedQuantity = previousQuantity > 0 && side === "sell"
    ? Math.min(previousQuantity, quantity)
    : previousQuantity < 0 && side === "buy"
      ? Math.min(Math.abs(previousQuantity), quantity)
      : 0;
  const realizedDelta = previousQuantity > 0
    ? closedQuantity * (price - Number(currentPosition?.average_price || price))
    : previousQuantity < 0
      ? closedQuantity * (Number(currentPosition?.average_price || price) - price)
      : 0;
  const { error: balanceError } = await supabaseAdmin
    .from("lab_session_participants")
    .update({ cash_balance: nextCash, equity, realized_pnl: Number(participant.realized_pnl || 0) + realizedDelta - commission, updated_at: new Date().toISOString() })
    .eq("id", participant.id);
  if (balanceError) {
    console.error("financial lab participant balance update failed after order", { actionId: createdAction?.id, code: balanceError.code });
    databaseError(balanceError, "La orden se registró, pero no fue posible actualizar el saldo. Contacta al docente.");
  }
  return { executionPrice: price, commission, cashBalance: nextCash, equity };
}

export async function POST(request: NextRequest) {
  return withAuthErrors(request, async () => {
    const user = await actor(request);
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      throw new AuthHttpError(400, "La solicitud no contiene JSON válido.");
    }
    const action = String(body.action || "");
    let data: unknown;
    if (action === "create_market") data = await createMarket(user.id, body);
    else if (action === "create_event") data = await createEvent(user.id, body);
    else if (action === "create_scenario") data = await createScenario(user.id, body);
    else if (action === "launch_session") data = await launchSession(user.id, body);
    else if (action === "control_session") data = await controlSession(user.id, body);
    else if (action === "place_order") data = await placeOrder(user.id, body);
    else throw new AuthHttpError(400, "Acción del laboratorio no reconocida.");
    return authJson(request, { ok: true, data });
  });
}
