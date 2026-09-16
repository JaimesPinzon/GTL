import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Beaker,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Copy,
  FlaskConical,
  Gauge,
  Layers3,
  Library,
  Loader2,
  Newspaper,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  Rocket,
  Save,
  ShieldCheck,
  Sparkles,
  StepForward,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useClassContext } from "@/features/classes/context/ClassContext";
import { fetchFinancialLab, mutateFinancialLab } from "@/lib/financial-lab-api";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

const tabs = [
  ["overview", "Resumen", Gauge],
  ["markets", "Mercados", BarChart3],
  ["events", "Eventos", Library],
  ["scenarios", "Escenarios", Layers3],
  ["sessions", "Sesiones", Activity],
];

const statusLabels = {
  draft: "Borrador",
  validated: "Validado",
  available: "Disponible",
  in_use: "En uso",
  ready: "Listo",
  assigned: "Asignado",
  active: "Activa",
  paused: "Pausada",
  scheduled: "Programada",
  finished: "Finalizada",
  cancelled: "Cancelada",
  published: "Publicado",
  tested: "Probado",
  base: "Evento base",
  custom: "Personalizado",
};

const marketTypeLabels = {
  stocks: "Acciones",
  forex: "Divisas",
  commodities: "Materias primas",
  bonds: "Bonos",
  crypto: "Criptoactivos",
  mixed: "Mixto",
};

const formatMoney = (value, currency = "USD") =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const numberValue = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const StatusBadge = ({ status }) => {
  const tone = ["active", "available", "ready", "published"].includes(status)
    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
    : status === "paused"
      ? "border-amber-400/25 bg-amber-400/10 text-amber-300"
      : status === "finished"
        ? "border-slate-400/20 bg-slate-400/10 text-slate-300"
        : "border-blue-400/25 bg-blue-400/10 text-blue-300";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${tone}`}>
      {statusLabels[status] || status}
    </span>
  );
};

const Field = ({ label, hint, children }) => (
  <div className="space-y-2">
    <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</Label>
    {children}
    {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
  </div>
);

const SelectField = ({ value, onChange, children, className = "" }) => (
  <select
    value={value}
    onChange={(event) => onChange(event.target.value)}
    className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
  >
    {children}
  </select>
);

const Modal = ({ open, title, subtitle, onClose, children, wide = false }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className={`max-h-[92vh] w-full overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1220] shadow-2xl ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
        <div className="flex items-start justify-between border-b border-white/8 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(92vh-88px)] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
};

const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex min-h-[260px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center">
    <div className="rounded-2xl bg-blue-500/10 p-4 text-blue-300"><Icon className="h-7 w-7" /></div>
    <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
    <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">{description}</p>
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
);

const SyntheticChart = ({ ticks = [], assetId, compact = false }) => {
  const data = ticks.filter((tick) => !assetId || tick.asset_id === assetId).slice(-60);
  if (!data.length) {
    return <div className={`${compact ? "h-36" : "h-72"} flex items-center justify-center rounded-2xl border border-white/8 bg-slate-950/35 text-sm text-slate-500`}>Sin velas generadas todavía</div>;
  }
  const width = 900;
  const height = compact ? 190 : 320;
  const top = 16;
  const bottom = 24;
  const min = Math.min(...data.map((tick) => numberValue(tick.low_price)));
  const max = Math.max(...data.map((tick) => numberValue(tick.high_price)));
  const span = Math.max(max - min, max * 0.001);
  const xStep = width / data.length;
  const y = (price) => top + ((max - numberValue(price)) / span) * (height - top - bottom);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#070d18]">
      <svg viewBox={`0 0 ${width} ${height}`} className={`${compact ? "h-36" : "h-72"} w-full`} preserveAspectRatio="none" role="img" aria-label="Gráfico de velas del mercado sintético">
        {[0.25, 0.5, 0.75].map((ratio) => <line key={ratio} x1="0" x2={width} y1={height * ratio} y2={height * ratio} stroke="rgba(148,163,184,.1)" />)}
        {data.map((tick, index) => {
          const open = numberValue(tick.open_price);
          const close = numberValue(tick.close_price);
          const color = close >= open ? "#34d399" : "#fb7185";
          const center = index * xStep + xStep / 2;
          const bodyTop = Math.min(y(open), y(close));
          const bodyHeight = Math.max(2, Math.abs(y(open) - y(close)));
          return (
            <g key={`${tick.asset_id}-${tick.period}`}>
              <line x1={center} x2={center} y1={y(tick.high_price)} y2={y(tick.low_price)} stroke={color} strokeWidth="1.2" />
              <rect x={center - Math.max(2, xStep * 0.28)} y={bodyTop} width={Math.max(4, xStep * 0.56)} height={bodyHeight} fill={color} rx="1" />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const defaultMarket = () => ({
  name: "",
  description: "",
  marketType: "stocks",
  baseCurrency: "USD",
  startAt: new Date().toISOString().slice(0, 16),
  durationPeriods: 80,
  timeframeMinutes: 5,
  configurationMode: "basic",
  trend: "sideways",
  expectedReturn: 0,
  volatility: 0.012,
  liquidity: 1000000,
  averageVolume: 100000,
  spreadBps: 10,
  jumpProbability: 0.01,
  jumpMagnitude: 0.04,
  meanReversion: 0.03,
  maxPeriodChange: 0.2,
  startingBalance: 100000,
  seed: 2026,
});

const defaultAsset = () => ({
  name: "Empresa Alfa",
  symbol: "ALFA",
  sector: "Tecnología",
  initialPrice: 100,
  availableQuantity: 500000,
  currency: "USD",
  shortSelling: false,
  maxLeverage: 1,
  commissionBps: 5,
});

const MarketWizard = ({ open, onClose, onSubmit, saving }) => {
  const [step, setStep] = useState(1);
  const [market, setMarket] = useState(defaultMarket);
  const [assets, setAssets] = useState([defaultAsset()]);
  useEffect(() => {
    if (open) {
      setStep(1);
      setMarket(defaultMarket());
      setAssets([defaultAsset()]);
    }
  }, [open]);
  const update = (field, value) => setMarket((current) => ({ ...current, [field]: value }));
  const updateAsset = (index, field, value) => setAssets((current) => current.map((asset, assetIndex) => assetIndex === index ? { ...asset, [field]: value } : asset));
  const canContinue = step !== 1 || (market.name.trim().length >= 3 && market.description.trim().length >= 3);
  const previewTicks = useMemo(() => {
    const asset = assets[0];
    const output = [];
    let close = numberValue(asset?.initialPrice, 100);
    for (let period = 0; period < 32; period += 1) {
      const openPrice = close;
      const wave = Math.sin((period + numberValue(market.seed)) * 1.73) * numberValue(market.volatility, 0.012);
      const drift = market.trend === "bullish" ? 0.002 : market.trend === "bearish" ? -0.002 : 0;
      close = Math.max(0.01, openPrice * (1 + wave + drift));
      output.push({ asset_id: "preview", period, open_price: openPrice, close_price: close, high_price: Math.max(openPrice, close) * 1.004, low_price: Math.min(openPrice, close) * 0.996 });
    }
    return output;
  }, [assets, market.seed, market.trend, market.volatility]);

  return (
    <Modal open={open} onClose={onClose} title="Crear mercado sintético" subtitle="Asistente de configuración · los datos quedan separados del mercado real" wide>
      <div className="mb-7 grid grid-cols-5 gap-2">
        {["Información", "Activos", "Comportamiento", "Reglas", "Vista previa"].map((label, index) => (
          <div key={label} className="min-w-0">
            <div className={`h-1.5 rounded-full ${index + 1 <= step ? "bg-blue-500" : "bg-white/8"}`} />
            <p className={`mt-2 truncate text-xs ${index + 1 === step ? "text-blue-300" : "text-slate-500"}`}>{index + 1}. {label}</p>
          </div>
        ))}
      </div>

      {step === 1 ? (
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Nombre"><Input value={market.name} onChange={(e) => update("name", e.target.value)} placeholder="Mercado de innovación 2026" /></Field>
          <Field label="Tipo de mercado"><SelectField value={market.marketType} onChange={(value) => update("marketType", value)}>{Object.entries(marketTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField></Field>
          <div className="md:col-span-2"><Field label="Propósito académico"><Textarea value={market.description} onChange={(e) => update("description", e.target.value)} placeholder="Objetivo y competencias que se trabajarán..." /></Field></div>
          <Field label="Moneda base"><SelectField value={market.baseCurrency} onChange={(value) => update("baseCurrency", value)}><option>USD</option><option>COP</option><option>EUR</option></SelectField></Field>
          <Field label="Fecha inicial"><Input type="datetime-local" value={market.startAt} onChange={(e) => update("startAt", e.target.value)} /></Field>
          <Field label="Duración en periodos"><Input type="number" min="10" max="1000" value={market.durationPeriods} onChange={(e) => update("durationPeriods", e.target.value)} /></Field>
          <Field label="Frecuencia"><SelectField value={market.timeframeMinutes} onChange={(value) => update("timeframeMinutes", Number(value))}><option value="1">1 minuto</option><option value="5">5 minutos</option><option value="15">15 minutos</option><option value="60">1 hora</option><option value="1440">1 día</option></SelectField></Field>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          {assets.map((asset, index) => (
            <div key={index} className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
              <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold text-white">Activo {index + 1}</h3>{assets.length > 1 ? <button type="button" onClick={() => setAssets((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-xs text-rose-300">Eliminar</button> : null}</div>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Nombre"><Input value={asset.name} onChange={(e) => updateAsset(index, "name", e.target.value)} /></Field>
                <Field label="Símbolo"><Input value={asset.symbol} onChange={(e) => updateAsset(index, "symbol", e.target.value.toUpperCase())} /></Field>
                <Field label="Sector"><Input value={asset.sector} onChange={(e) => updateAsset(index, "sector", e.target.value)} /></Field>
                <Field label="Precio inicial"><Input type="number" min="0.01" step="0.01" value={asset.initialPrice} onChange={(e) => updateAsset(index, "initialPrice", e.target.value)} /></Field>
                <Field label="Cantidad disponible"><Input type="number" min="1" value={asset.availableQuantity} onChange={(e) => updateAsset(index, "availableQuantity", e.target.value)} /></Field>
                <Field label="Divisa"><Input value={asset.currency} maxLength={3} onChange={(e) => updateAsset(index, "currency", e.target.value.toUpperCase())} /></Field>
                <Field label="Apalancamiento máximo"><SelectField value={asset.maxLeverage} onChange={(value) => updateAsset(index, "maxLeverage", Number(value))}><option value="1">1:1</option><option value="2">1:2</option><option value="5">1:5</option></SelectField></Field>
                <Field label="Comisión (pbs)"><Input type="number" min="0" value={asset.commissionBps} onChange={(e) => updateAsset(index, "commissionBps", e.target.value)} /></Field>
                <label className="flex items-center gap-3 self-end rounded-xl border border-white/8 px-4 py-2.5 text-sm text-slate-300"><input type="checkbox" checked={asset.shortSelling} onChange={(e) => updateAsset(index, "shortSelling", e.target.checked)} /> Permitir ventas en corto</label>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={() => setAssets((current) => [...current, { ...defaultAsset(), name: `Activo ${current.length + 1}`, symbol: `ACT${current.length + 1}`, currency: market.baseCurrency }])}><Plus className="mr-2 h-4 w-4" />Añadir activo</Button>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-5">
          <div className="flex gap-2 rounded-2xl border border-white/8 bg-white/[0.02] p-2">
            {["basic", "advanced"].map((mode) => <button key={mode} type="button" onClick={() => update("configurationMode", mode)} className={`flex-1 rounded-xl px-4 py-2 text-sm ${market.configurationMode === mode ? "bg-blue-500 text-white" : "text-slate-400"}`}>{mode === "basic" ? "Modo básico" : "Modo avanzado"}</button>)}
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            <Field label="Tendencia"><SelectField value={market.trend} onChange={(value) => update("trend", value)}><option value="bullish">Alcista</option><option value="bearish">Bajista</option><option value="sideways">Lateral</option><option value="custom">Personalizada</option></SelectField></Field>
            <Field label="Volatilidad por periodo"><Input type="number" min="0.0001" max="1" step="0.001" value={market.volatility} onChange={(e) => update("volatility", e.target.value)} /></Field>
            <Field label="Rendimiento esperado"><Input type="number" min="-0.2" max="0.2" step="0.001" value={market.expectedReturn} onChange={(e) => update("expectedReturn", e.target.value)} /></Field>
            <Field label="Liquidez"><Input type="number" min="1" value={market.liquidity} onChange={(e) => update("liquidity", e.target.value)} /></Field>
            <Field label="Volumen promedio"><Input type="number" min="1" value={market.averageVolume} onChange={(e) => update("averageVolume", e.target.value)} /></Field>
            <Field label="Spread (pbs)"><Input type="number" min="0" value={market.spreadBps} onChange={(e) => update("spreadBps", e.target.value)} /></Field>
            {market.configurationMode === "advanced" ? <>
              <Field label="Probabilidad de salto"><Input type="number" min="0" max="1" step="0.01" value={market.jumpProbability} onChange={(e) => update("jumpProbability", e.target.value)} /></Field>
              <Field label="Magnitud de salto"><Input type="number" min="0" max="1" step="0.01" value={market.jumpMagnitude} onChange={(e) => update("jumpMagnitude", e.target.value)} /></Field>
              <Field label="Reversión a la media"><Input type="number" min="0" max="1" step="0.01" value={market.meanReversion} onChange={(e) => update("meanReversion", e.target.value)} /></Field>
            </> : null}
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Saldo inicial por estudiante"><Input type="number" min="1" value={market.startingBalance} onChange={(e) => update("startingBalance", e.target.value)} /></Field>
          <Field label="Cambio máximo por periodo"><Input type="number" min="0.001" max="1" step="0.01" value={market.maxPeriodChange} onChange={(e) => update("maxPeriodChange", e.target.value)} /></Field>
          <Field label="Semilla reproducible" hint="La misma semilla produce exactamente la misma trayectoria."><Input type="number" min="1" value={market.seed} onChange={(e) => update("seed", e.target.value)} /></Field>
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4 text-sm text-emerald-100"><ShieldCheck className="mb-3 h-5 w-5 text-emerald-300" /><p className="font-medium">Ejecución aislada</p><p className="mt-1 leading-6 text-emerald-100/65">Las órdenes, precios y saldos se guardan en el dominio del laboratorio y nunca tocan el portafolio ni las cotizaciones reales.</p></div>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div><SyntheticChart ticks={previewTicks} assetId="preview" /><p className="mt-3 text-xs text-slate-500">Vista preliminar orientativa. La serie definitiva se genera en el backend al iniciar la sesión.</p></div>
          <div className="space-y-3 rounded-2xl border border-white/8 bg-white/[0.025] p-5 text-sm">
            <p className="font-semibold text-white">Resumen de configuración</p>
            <div className="flex justify-between text-slate-400"><span>Mercado</span><span className="text-slate-200">{market.name}</span></div>
            <div className="flex justify-between text-slate-400"><span>Activos</span><span className="text-slate-200">{assets.length}</span></div>
            <div className="flex justify-between text-slate-400"><span>Periodos</span><span className="text-slate-200">{market.durationPeriods}</span></div>
            <div className="flex justify-between text-slate-400"><span>Volatilidad</span><span className="text-slate-200">{(numberValue(market.volatility) * 100).toFixed(2)}%</span></div>
            <div className="flex justify-between text-slate-400"><span>Semilla</span><span className="text-slate-200">{market.seed}</span></div>
            <div className="mt-4 rounded-xl bg-emerald-400/8 px-3 py-2 text-xs text-emerald-300"><Check className="mr-1 inline h-3.5 w-3.5" />Configuración consistente para publicar.</div>
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex items-center justify-between border-t border-white/8 pt-5">
        <Button type="button" variant="outline" disabled={step === 1 || saving} onClick={() => setStep((current) => current - 1)}><ArrowLeft className="mr-2 h-4 w-4" />Anterior</Button>
        {step < 5 ? <Button type="button" disabled={!canContinue} onClick={() => setStep((current) => current + 1)}>Continuar<ArrowRight className="ml-2 h-4 w-4" /></Button> : <Button type="button" disabled={saving} onClick={() => onSubmit({ market: { ...market, startAt: new Date(market.startAt).toISOString() }, assets })}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Guardar mercado</Button>}
      </div>
    </Modal>
  );
};

const EventDialog = ({ open, onClose, onSubmit, saving, sourceEvent = null }) => {
  const [event, setEvent] = useState({});
  useEffect(() => {
    if (!open) return;
    setEvent({
      sourceEventId: sourceEvent?.id || null,
      name: sourceEvent ? `${sourceEvent.name} · Variante` : "",
      description: sourceEvent?.description || "",
      category: sourceEvent?.category || "macroeconomics",
      difficulty: sourceEvent?.difficulty || "intermediate",
      academicObjective: sourceEvent?.academic_objective || "",
      activationType: "temporal",
      defaultPeriod: sourceEvent?.default_period ?? 10,
      direction: sourceEvent?.direction || "negative",
      impactPercent: sourceEvent?.impact_percent ?? -0.03,
      volatilityMultiplier: sourceEvent?.volatility_multiplier ?? 1.4,
      durationPeriods: sourceEvent?.duration_periods ?? 3,
      headline: sourceEvent?.headline || "",
      message: sourceEvent?.message || "",
      simulatedSource: sourceEvent?.simulated_source || "Agencia GTL",
    });
  }, [open, sourceEvent]);
  const update = (field, value) => setEvent((current) => ({ ...current, [field]: value }));
  return (
    <Modal open={open} onClose={onClose} title={sourceEvent ? "Personalizar evento" : "Crear evento"} subtitle={sourceEvent ? "Se creará una copia vinculada; el evento base permanece intacto." : "Configura el detonante, impacto y comunicación al estudiante."} wide>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Nombre"><Input value={event.name || ""} onChange={(e) => update("name", e.target.value)} /></Field>
        <Field label="Categoría"><Input value={event.category || ""} onChange={(e) => update("category", e.target.value)} /></Field>
        <div className="md:col-span-2"><Field label="Descripción"><Textarea value={event.description || ""} onChange={(e) => update("description", e.target.value)} /></Field></div>
        <div className="md:col-span-2"><Field label="Objetivo académico"><Input value={event.academicObjective || ""} onChange={(e) => update("academicObjective", e.target.value)} /></Field></div>
        <Field label="Activación"><SelectField value={event.activationType || "temporal"} onChange={(value) => update("activationType", value)}><option value="temporal">Temporal</option><option value="manual">Manual</option></SelectField></Field>
        <Field label="Periodo sugerido"><Input type="number" min="0" value={event.defaultPeriod ?? 0} onChange={(e) => update("defaultPeriod", e.target.value)} /></Field>
        <Field label="Dirección"><SelectField value={event.direction || "negative"} onChange={(value) => update("direction", value)}><option value="positive">Positiva</option><option value="negative">Negativa</option><option value="mixed">Mixta</option></SelectField></Field>
        <Field label="Impacto por periodo"><Input type="number" min="-1" max="1" step="0.01" value={event.impactPercent ?? 0} onChange={(e) => update("impactPercent", e.target.value)} /></Field>
        <Field label="Multiplicador de volatilidad"><Input type="number" min="0.01" max="20" step="0.1" value={event.volatilityMultiplier ?? 1} onChange={(e) => update("volatilityMultiplier", e.target.value)} /></Field>
        <Field label="Duración en periodos"><Input type="number" min="1" value={event.durationPeriods ?? 1} onChange={(e) => update("durationPeriods", e.target.value)} /></Field>
        <div className="md:col-span-2 border-t border-white/8 pt-5"><p className="mb-4 text-sm font-semibold text-white">Comunicación al estudiante</p></div>
        <Field label="Titular"><Input value={event.headline || ""} onChange={(e) => update("headline", e.target.value)} /></Field>
        <Field label="Fuente simulada"><Input value={event.simulatedSource || ""} onChange={(e) => update("simulatedSource", e.target.value)} /></Field>
        <div className="md:col-span-2"><Field label="Noticia"><Textarea value={event.message || ""} onChange={(e) => update("message", e.target.value)} /></Field></div>
      </div>
      <div className="mt-7 flex justify-end gap-3"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={saving || (event.name || "").trim().length < 3} onClick={() => onSubmit(event)}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Guardar evento</Button></div>
    </Modal>
  );
};

const ScenarioDialog = ({ open, onClose, onSubmit, saving, markets, events, initialEventId = null }) => {
  const { t } = useTranslation();
  const [scenario, setScenario] = useState({ name: "", description: "", academicObjective: "", marketId: "", durationPeriods: 80, seed: 2026 });
  const [timeline, setTimeline] = useState([]);
  useEffect(() => {
    if (!open) return;
    const market = markets[0];
    const initialEvent = events.find((event) => event.id === initialEventId);
    setScenario({ name: initialEvent ? `${t("news.lab.historicalSimulation")} · ${initialEvent.name}` : "", description: initialEvent?.description || "", academicObjective: initialEvent?.academic_objective || "", marketId: market?.id || "", durationPeriods: market?.duration_periods || 80, seed: market?.seed || 2026 });
    setTimeline(initialEvent ? [{ eventId: initialEvent.id, activationPeriod: Math.min(numberValue(initialEvent.default_period, 10), numberValue(market?.duration_periods, 80) - 1), name: initialEvent.name, direction: initialEvent.direction }] : []);
  }, [events, initialEventId, open, markets, t]);
  const selectedMarket = markets.find((market) => market.id === scenario.marketId);
  const addEvent = (event) => setTimeline((current) => [...current, { eventId: event.id, activationPeriod: Math.min(numberValue(event.default_period, current.length * 10 + 10), numberValue(scenario.durationPeriods) - 1), name: event.name, direction: event.direction }]);
  return (
    <Modal open={open} onClose={onClose} title="Constructor de escenarios" subtitle="Une un mercado sintético, eventos, cronología y objetivo académico." wide>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Nombre"><Input value={scenario.name} onChange={(e) => setScenario((current) => ({ ...current, name: e.target.value }))} placeholder="Crisis de liquidez de Alfa" /></Field>
        <Field label="Mercado"><SelectField value={scenario.marketId} onChange={(value) => { const market = markets.find((item) => item.id === value); setScenario((current) => ({ ...current, marketId: value, durationPeriods: market?.duration_periods || current.durationPeriods })); }}><option value="">Selecciona un mercado</option>{markets.map((market) => <option key={market.id} value={market.id}>{market.name}</option>)}</SelectField></Field>
        <div className="md:col-span-2"><Field label="Objetivo académico"><Input value={scenario.academicObjective} onChange={(e) => setScenario((current) => ({ ...current, academicObjective: e.target.value }))} /></Field></div>
        <Field label="Duración"><Input type="number" min="10" max={selectedMarket?.duration_periods || 1000} value={scenario.durationPeriods} onChange={(e) => setScenario((current) => ({ ...current, durationPeriods: e.target.value }))} /></Field>
        <Field label="Semilla"><Input type="number" min="1" value={scenario.seed} onChange={(e) => setScenario((current) => ({ ...current, seed: e.target.value }))} /></Field>
      </div>
      <div className="mt-7 grid gap-5 lg:grid-cols-[0.85fr_1.4fr]">
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Biblioteca</p>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
            {events.map((event) => <button type="button" key={event.id} onClick={() => addEvent(event)} className="flex w-full items-center justify-between rounded-xl border border-white/8 bg-slate-950/25 px-3 py-3 text-left hover:border-blue-400/30"><span><span className="block text-sm text-slate-200">{event.name}</span><span className="mt-1 block text-xs text-slate-500">Impacto {(numberValue(event.impact_percent) * 100).toFixed(1)}%</span></span><Plus className="h-4 w-4 text-blue-300" /></button>)}
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Línea de tiempo</p><span className="text-xs text-slate-500">{scenario.durationPeriods} periodos</span></div>
          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-3"><span className="w-20 text-xs text-emerald-300">Periodo 0</span><span className="text-sm text-slate-200">Apertura normal del mercado</span></div>
            {timeline.length ? timeline.map((item, index) => (
              <div key={`${item.eventId}-${index}`} className="flex items-center gap-3 rounded-xl border border-white/8 bg-slate-950/25 px-3 py-2.5">
                <Input className="w-24" type="number" min="0" max={numberValue(scenario.durationPeriods) - 1} value={item.activationPeriod} onChange={(e) => setTimeline((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, activationPeriod: e.target.value } : entry))} />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{item.name}</span>
                {item.direction === "positive" ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <TrendingDown className="h-4 w-4 text-rose-400" />}
                <button type="button" onClick={() => setTimeline((current) => current.filter((_, entryIndex) => entryIndex !== index))} className="text-slate-500 hover:text-rose-300"><X className="h-4 w-4" /></button>
              </div>
            )) : <p className="py-10 text-center text-sm text-slate-500">Añade eventos desde la biblioteca.</p>}
          </div>
        </div>
      </div>
      <div className="mt-7 flex justify-end gap-3"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={saving || !scenario.marketId || scenario.name.trim().length < 3 || scenario.academicObjective.trim().length < 3} onClick={() => onSubmit({ scenario, timeline })}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}Validar y guardar</Button></div>
    </Modal>
  );
};

const TeacherSession = ({ session, onControl, busy }) => {
  const [assetId, setAssetId] = useState(session?.scenario?.market?.assets?.[0]?.id || "");
  useEffect(() => setAssetId(session?.scenario?.market?.assets?.[0]?.id || ""), [session?.id]);
  if (!session) return <EmptyState icon={Clock3} title="No hay una sesión seleccionada" description="Inicia un escenario listo o abre una sesión existente para supervisarla." />;
  const assets = session.scenario?.market?.assets || [];
  const activeEvents = (session.scenario?.timeline || []).filter((item) => Number(item.activation_period) <= Number(session.current_period));
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-white/8 bg-gradient-to-br from-blue-500/[0.08] to-transparent p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div><div className="flex items-center gap-3"><h3 className="text-xl font-semibold text-white">{session.name}</h3><StatusBadge status={session.state} /></div><p className="mt-2 text-sm text-slate-400">Periodo {session.current_period + 1} de {session.scenario?.duration_periods} · Semilla {session.seed}</p></div>
          <div className="flex flex-wrap gap-2">
            {session.state === "active" ? <Button variant="outline" disabled={busy} onClick={() => onControl("pause")}><Pause className="mr-2 h-4 w-4" />Pausar</Button> : session.state === "paused" ? <Button variant="outline" disabled={busy} onClick={() => onControl("resume")}><Play className="mr-2 h-4 w-4" />Reanudar</Button> : null}
            {!['finished','cancelled'].includes(session.state) ? <Button disabled={busy} onClick={() => onControl("advance")}><StepForward className="mr-2 h-4 w-4" />Avanzar periodo</Button> : null}
            <Button variant="outline" disabled={busy} onClick={() => onControl("reset")}><RefreshCcw className="mr-2 h-4 w-4" />Reiniciar</Button>
            {!['finished','cancelled'].includes(session.state) ? <Button variant="destructive" disabled={busy} onClick={() => onControl("finish")}>Finalizar</Button> : null}
          </div>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <div className="rounded-3xl border border-white/8 bg-white/[0.025] p-5">
          <div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Mercado en ejecución</p><p className="mt-1 text-xs text-slate-500">OHLC generado y normalizado en el backend</p></div><SelectField className="w-40" value={assetId} onChange={setAssetId}>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.symbol}</option>)}</SelectField></div>
          <SyntheticChart ticks={session.ticks} assetId={assetId} />
        </div>
        <div className="rounded-3xl border border-white/8 bg-white/[0.025] p-5">
          <p className="text-sm font-semibold text-white">Seguimiento en vivo</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-950/30 p-4"><Users className="h-4 w-4 text-blue-300" /><p className="mt-3 text-2xl font-semibold text-white">{session.participants?.length || 0}</p><p className="text-xs text-slate-500">Participantes</p></div>
            <div className="rounded-2xl bg-slate-950/30 p-4"><Activity className="h-4 w-4 text-violet-300" /><p className="mt-3 text-2xl font-semibold text-white">{session.actions?.length || 0}</p><p className="text-xs text-slate-500">Operaciones</p></div>
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Noticias reveladas</p>
          <div className="mt-3 space-y-2">{activeEvents.length ? activeEvents.slice().reverse().map((item) => <div key={item.id} className="rounded-xl border border-white/8 px-3 py-3"><p className="text-xs text-blue-300">Periodo {item.activation_period}</p><p className="mt-1 text-sm text-slate-200">{item.event?.headline || item.event?.name}</p></div>) : <p className="py-4 text-sm text-slate-500">Aún no se han publicado eventos.</p>}</div>
        </div>
      </div>
      {session.participants?.length ? <div className="rounded-3xl border border-white/8 bg-white/[0.025] p-5"><p className="mb-4 text-sm font-semibold text-white">Patrimonio de participantes</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-[0.1em] text-slate-500"><tr><th className="pb-3">Estudiante</th><th className="pb-3">Efectivo</th><th className="pb-3">Patrimonio</th><th className="pb-3">Resultado</th></tr></thead><tbody>{session.participants.map((participant) => <tr key={participant.id} className="border-t border-white/6"><td className="py-3 text-slate-200">{participant.profile?.name || participant.profile?.email || "Estudiante"}</td><td className="py-3 text-slate-400">{formatMoney(participant.cash_balance, session.scenario?.market?.base_currency)}</td><td className="py-3 text-slate-200">{formatMoney(participant.equity, session.scenario?.market?.base_currency)}</td><td className={`py-3 ${Number(participant.equity) >= Number(session.initial_balance) ? "text-emerald-300" : "text-rose-300"}`}>{formatMoney(Number(participant.equity) - Number(session.initial_balance), session.scenario?.market?.base_currency)}</td></tr>)}</tbody></table></div></div> : null}
    </div>
  );
};

const StudentWorkspace = ({ payload, selectedSessionId, onSelectSession, onOrder, saving }) => {
  const session = payload.selectedSession;
  const [assetId, setAssetId] = useState("");
  const [side, setSide] = useState("buy");
  const [quantity, setQuantity] = useState(1);
  const [justification, setJustification] = useState("");
  useEffect(() => setAssetId(session?.scenario?.market?.assets?.[0]?.id || ""), [session?.id]);
  if (!session) return <EmptyState icon={FlaskConical} title="Sin simulaciones disponibles" description="Cuando el docente inicie una sesión para esta clase aparecerá aquí. Los eventos futuros permanecerán ocultos." />;
  const assets = session.scenario?.market?.assets || [];
  const asset = assets.find((item) => item.id === assetId) || assets[0];
  const ticks = (session.ticks || []).filter((tick) => tick.asset_id === asset?.id);
  const latest = ticks[ticks.length - 1];
  const participant = session.participants?.[0];
  const position = session.positions?.find((item) => item.asset_id === asset?.id);
  const currency = session.scenario?.market?.base_currency || "USD";
  const timeline = session.scenario?.timeline || [];
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-white/8 bg-gradient-to-r from-blue-500/[0.1] to-violet-500/[0.06] p-5 md:flex-row md:items-center">
        <div><div className="flex items-center gap-3"><h2 className="text-xl font-semibold text-white">{session.name}</h2><StatusBadge status={session.state} /></div><p className="mt-2 text-sm text-slate-400">{session.scenario?.academic_objective}</p></div>
        <div className="flex items-center gap-3"><SelectField className="min-w-48" value={selectedSessionId || session.id} onChange={onSelectSession}>{payload.sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField><div className="rounded-xl bg-slate-950/40 px-4 py-2 text-center"><p className="text-lg font-semibold text-white">{session.current_period + 1}/{session.scenario?.duration_periods}</p><p className="text-[10px] uppercase tracking-wider text-slate-500">Periodo</p></div></div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.7fr_0.85fr]">
        <div className="rounded-3xl border border-white/8 bg-white/[0.025] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><SelectField className="w-44" value={assetId} onChange={setAssetId}>{assets.map((item) => <option key={item.id} value={item.id}>{item.symbol} · {item.name}</option>)}</SelectField><div><p className="text-lg font-semibold text-white">{formatMoney(latest?.close_price, asset?.currency || currency)}</p><p className="text-xs text-slate-500">Cotización sintética</p></div></div><span className="rounded-full border border-violet-400/20 bg-violet-400/8 px-3 py-1 text-xs text-violet-300">Entorno simulado</span></div>
          <SyntheticChart ticks={session.ticks} assetId={asset?.id} />
        </div>
        <div className="rounded-3xl border border-white/8 bg-white/[0.025] p-5">
          <div className="flex items-center justify-between"><p className="font-semibold text-white">Nueva orden</p><span className="text-xs text-slate-500">A mercado</span></div>
          <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => setSide("buy")} className={`rounded-xl py-2.5 text-sm font-semibold ${side === "buy" ? "bg-emerald-500 text-white" : "bg-white/5 text-slate-400"}`}>Comprar</button><button type="button" onClick={() => setSide("sell")} className={`rounded-xl py-2.5 text-sm font-semibold ${side === "sell" ? "bg-rose-500 text-white" : "bg-white/5 text-slate-400"}`}>Vender</button></div>
          <div className="mt-4 space-y-4"><Field label="Cantidad"><Input type="number" min="0.000001" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field><Field label="Justificación de la decisión"><Textarea value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="¿Qué información sustenta tu decisión?" /></Field></div>
          <div className="mt-4 rounded-xl bg-slate-950/35 px-3 py-3 text-xs text-slate-400"><div className="flex justify-between"><span>Valor estimado</span><span className="text-slate-200">{formatMoney(numberValue(latest?.close_price) * numberValue(quantity), currency)}</span></div><div className="mt-2 flex justify-between"><span>Posición actual</span><span className="text-slate-200">{numberValue(position?.quantity).toLocaleString("es-CO")}</span></div></div>
          <Button className="mt-5 w-full" disabled={saving || session.state !== "active" || justification.trim().length < 3 || !asset} onClick={() => onOrder({ sessionId: session.id, assetId: asset.id, side, quantity: numberValue(quantity), justification })}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CircleDollarSign className="mr-2 h-4 w-4" />}Enviar orden</Button>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-3xl border border-white/8 bg-white/[0.025] p-5"><WalletCards className="h-5 w-5 text-blue-300" /><p className="mt-4 text-xs uppercase tracking-[0.14em] text-slate-500">Saldo disponible</p><p className="mt-1 text-2xl font-semibold text-white">{formatMoney(participant?.cash_balance ?? session.initial_balance, currency)}</p></div>
        <div className="rounded-3xl border border-white/8 bg-white/[0.025] p-5"><Activity className="h-5 w-5 text-violet-300" /><p className="mt-4 text-xs uppercase tracking-[0.14em] text-slate-500">Patrimonio</p><p className="mt-1 text-2xl font-semibold text-white">{formatMoney(participant?.equity ?? session.initial_balance, currency)}</p></div>
        <div className="rounded-3xl border border-white/8 bg-white/[0.025] p-5"><Newspaper className="h-5 w-5 text-amber-300" /><p className="mt-4 text-xs uppercase tracking-[0.14em] text-slate-500">Noticias publicadas</p><p className="mt-1 text-2xl font-semibold text-white">{timeline.length}</p></div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/8 bg-white/[0.025] p-5"><p className="font-semibold text-white">Noticias del escenario</p><div className="mt-4 space-y-3">{timeline.length ? timeline.slice().reverse().map((item) => <article key={item.id} className="rounded-2xl border border-white/8 bg-slate-950/25 p-4"><div className="flex justify-between text-xs"><span className="text-blue-300">Periodo {item.activation_period}</span><span className="text-slate-500">{item.event?.simulated_source}</span></div><h3 className="mt-2 text-sm font-semibold text-slate-100">{item.event?.headline || item.event?.name}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{item.event?.message}</p></article>) : <p className="py-8 text-center text-sm text-slate-500">No hay noticias publicadas. Los eventos futuros están ocultos.</p>}</div></div>
        <div className="rounded-3xl border border-white/8 bg-white/[0.025] p-5"><p className="font-semibold text-white">Historial de decisiones</p><div className="mt-4 space-y-2">{session.actions?.length ? session.actions.map((action) => <div key={action.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/8 px-3 py-3"><div><p className={`text-sm font-semibold ${action.action_type === "buy" ? "text-emerald-300" : "text-rose-300"}`}>{action.action_type === "buy" ? "Compra" : "Venta"} · {action.asset?.symbol}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{action.justification}</p></div><div className="text-right"><p className="text-sm text-slate-200">{numberValue(action.quantity).toLocaleString("es-CO")}</p><p className="text-xs text-slate-500">{formatMoney(action.execution_price, currency)}</p></div></div>) : <p className="py-8 text-center text-sm text-slate-500">Aún no has registrado decisiones.</p>}</div></div>
      </div>
    </div>
  );
};

const FinancialLabPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { activeClassId, activeClass } = useClassContext() || {};
  const { toast } = useToast();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("overview");
  const [marketDialog, setMarketDialog] = useState(false);
  const [eventDialog, setEventDialog] = useState(false);
  const [scenarioDialog, setScenarioDialog] = useState(false);
  const [eventSource, setEventSource] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const linkedEventId = searchParams.get("event");
  const sourceNewsId = searchParams.get("news");

  const load = useCallback(async (sessionId = selectedSessionId, quiet = false) => {
    if (!activeClassId) return;
    if (!quiet) setLoading(true);
    try {
      const next = await fetchFinancialLab(activeClassId, sessionId);
      setPayload(next);
      if (next.selectedSession?.id) setSelectedSessionId(next.selectedSession.id);
    } catch (error) {
      toast({ title: "No se pudo cargar el laboratorio", description: error.message, variant: "destructive" });
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [activeClassId, selectedSessionId, toast]);

  useEffect(() => { void load(null); }, [activeClassId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!payload?.selectedSession || !["active", "paused"].includes(payload.selectedSession.state)) return undefined;
    const timer = window.setInterval(() => void load(selectedSessionId, true), 8000);
    return () => window.clearInterval(timer);
  }, [load, payload?.selectedSession?.id, payload?.selectedSession?.state, selectedSessionId]);

  const mutate = async (action, body, successMessage, after) => {
    setBusy(true);
    try {
      const result = await mutateFinancialLab(action, { roomId: activeClassId, ...body });
      toast({ title: successMessage });
      after?.(result.data);
      await load(result.data?.id && ["launch_session"].includes(action) ? result.data.id : selectedSessionId, true);
      return result.data;
    } catch (error) {
      toast({ title: "No se pudo completar la acción", description: error.message, variant: "destructive" });
      return null;
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="flex h-full items-center justify-center"><div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-400" /><p className="mt-3 text-sm text-slate-400">Preparando el laboratorio sintético…</p></div></div>;
  if (!payload) return <div className="flex h-full items-center justify-center text-slate-400">No fue posible abrir el laboratorio.</div>;

  if (payload.role === "student") {
    return <div className="scrollbar-dashboard h-full overflow-y-auto bg-[#070c15] p-4 md:p-6"><div className="mx-auto max-w-[1500px]"><div className="mb-6"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300"><Beaker className="h-4 w-4" />Laboratorio financiero · {activeClass?.name}</div><h1 className="mt-2 text-3xl font-bold text-white">Mesa de simulación</h1><p className="mt-2 text-sm text-slate-400">Opera en un mercado totalmente sintético. Tus resultados aquí no afectan el portafolio del mercado real.</p></div><StudentWorkspace payload={payload} selectedSessionId={selectedSessionId} onSelectSession={(id) => { setSelectedSessionId(id); void load(id); }} saving={busy} onOrder={async (order) => { const result = await mutate("place_order", order, "Orden sintética ejecutada"); if (result) await load(order.sessionId, true); }} /></div></div>;
  }

  const markets = payload.markets || [];
  const events = payload.events || [];
  const scenarios = payload.scenarios || [];
  const sessions = payload.sessions || [];
  const activeSessions = sessions.filter((session) => ["active", "paused"].includes(session.state));
  const customEvents = events.filter((event) => event.event_kind !== "base");
  const linkedEvent = events.find((event) => event.id === linkedEventId);

  const openEvent = (source = null) => { setEventSource(source); setEventDialog(true); };
  const launch = async (scenario) => {
    const session = await mutate("launch_session", { scenarioId: scenario.id, name: `${scenario.name} · ${activeClass?.name || "Clase"}`, seed: scenario.seed, initialBalance: markets.find((market) => market.id === scenario.market_id)?.starting_balance || 100000 }, "Sesión iniciada");
    if (session) { setSelectedSessionId(session.id); setTab("sessions"); }
  };
  const control = async (command) => {
    const sessionId = payload.selectedSession?.id || selectedSessionId;
    if (!sessionId) return;
    await mutate("control_session", { sessionId, command }, command === "reset" ? "Sesión reiniciada con la misma semilla" : "Control aplicado");
  };

  return (
    <div className="scrollbar-dashboard h-full overflow-y-auto bg-[#070c15] p-4 md:p-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="relative overflow-hidden rounded-[30px] border border-blue-400/10 bg-gradient-to-br from-[#101b31] via-[#0b1425] to-[#080f1c] p-6 md:p-8">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300"><FlaskConical className="h-4 w-4" />{activeClass?.name || "Clase activa"}</div><h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">Laboratorio financiero</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Crea mercados, configura eventos y diseña experiencias de simulación para tus clases.</p><div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-xs text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" />Entorno aislado de mercados y datos reales</div></div>
            <div className="flex flex-wrap gap-2"><Button onClick={() => setMarketDialog(true)}><Plus className="mr-2 h-4 w-4" />Crear mercado</Button><Button variant="outline" onClick={() => setScenarioDialog(true)} disabled={!markets.length}><Sparkles className="mr-2 h-4 w-4" />Crear escenario</Button><Button variant="outline" onClick={() => { setTab("events"); }}><Library className="mr-2 h-4 w-4" />Explorar eventos</Button></div>
          </div>
        </header>

        <nav className="mt-5 flex gap-2 overflow-x-auto rounded-2xl border border-white/8 bg-white/[0.025] p-2">
          {tabs.map(([id, label, Icon]) => <button type="button" key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition ${tab === id ? "bg-blue-500 text-white shadow-lg shadow-blue-950/30" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><Icon className="h-4 w-4" />{label}</button>)}
        </nav>

        {linkedEvent ? <section className="mt-5 flex flex-col justify-between gap-4 rounded-3xl border border-amber-400/20 bg-amber-400/[0.06] p-5 md:flex-row md:items-center"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">{t("news.lab.imported")}</p><h2 className="mt-2 font-semibold text-white">{linkedEvent.name}</h2><p className="mt-1 text-sm text-slate-400">{t("news.lab.importedDescription")}</p>{sourceNewsId ? <p className="mt-2 text-xs text-slate-500">{t("news.lab.source")}: {sourceNewsId}</p> : null}</div><div className="flex gap-2"><Button variant="outline" onClick={() => setTab("events")}>{t("news.lab.reviewEvent")}</Button><Button disabled={!markets.length} onClick={() => setScenarioDialog(true)}>{t("news.lab.createSimulation")}</Button></div></section> : null}

        <main className="mt-5 space-y-5">
          {tab === "overview" ? <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[[BarChart3, "Mercados sintéticos", markets.length, "Creados por ti", "text-blue-300", "bg-blue-400/10"], [Layers3, "Escenarios", scenarios.length, `${scenarios.filter((item) => item.status === "ready").length} listos`, "text-violet-300", "bg-violet-400/10"], [Library, "Eventos personalizados", customEvents.length, `${events.filter((item) => item.event_kind === "base").length} plantillas base`, "text-amber-300", "bg-amber-400/10"], [Activity, "Sesiones activas", activeSessions.length, `${sessions.filter((item) => item.state === "finished").length} finalizadas`, "text-emerald-300", "bg-emerald-400/10"]].map(([Icon, label, value, detail, color, background]) => <div key={label} className="rounded-3xl border border-white/8 bg-white/[0.025] p-5"><div className={`inline-flex rounded-xl p-2.5 ${color} ${background}`}><Icon className="h-5 w-5" /></div><p className="mt-5 text-3xl font-semibold text-white">{value}</p><p className="mt-1 text-sm font-medium text-slate-200">{label}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>)}
            </div>
            <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
              <section className="rounded-3xl border border-white/8 bg-white/[0.025] p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-white">Mis mercados</h2><p className="mt-1 text-xs text-slate-500">Bases sintéticas reutilizables</p></div><button type="button" onClick={() => setTab("markets")} className="text-xs text-blue-300">Ver todos <ChevronRight className="inline h-3.5 w-3.5" /></button></div><div className="mt-4 space-y-3">{markets.length ? markets.slice(0, 3).map((market) => <div key={market.id} className="flex items-center justify-between rounded-2xl border border-white/8 bg-slate-950/25 p-4"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-medium text-slate-100">{market.name}</p><StatusBadge status={market.status} /></div><p className="mt-1 text-xs text-slate-500">{marketTypeLabels[market.market_type]} · {market.assets?.length || 0} activos · {market.duration_periods} periodos</p></div><p className="ml-3 text-sm text-slate-300">{market.base_currency}</p></div>) : <EmptyState icon={BarChart3} title="Crea tu primer mercado" description="Define activos, comportamiento y reglas con el asistente." action={<Button size="sm" onClick={() => setMarketDialog(true)}>Comenzar</Button>} />}</div></section>
              <section className="rounded-3xl border border-white/8 bg-white/[0.025] p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-white">Escenarios recientes</h2><p className="mt-1 text-xs text-slate-500">Listos para probar o asignar</p></div><button type="button" onClick={() => setTab("scenarios")} className="text-xs text-blue-300">Ver todos <ChevronRight className="inline h-3.5 w-3.5" /></button></div><div className="mt-4 space-y-3">{scenarios.length ? scenarios.slice(0, 4).map((scenario) => <div key={scenario.id} className="rounded-2xl border border-white/8 bg-slate-950/25 p-4"><div className="flex items-center justify-between"><p className="font-medium text-slate-100">{scenario.name}</p><StatusBadge status={scenario.status} /></div><p className="mt-2 text-xs text-slate-500">{scenario.market?.name} · {scenario.timeline?.length || 0} eventos · semilla {scenario.seed}</p></div>) : <EmptyState icon={Layers3} title="Aún no hay escenarios" description="Crea un mercado y después organiza eventos en una línea de tiempo." />}</div></section>
            </div>
          </> : null}

          {tab === "markets" ? <section><div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-semibold text-white">Mercados sintéticos</h2><p className="mt-1 text-sm text-slate-500">Configuraciones propias, sin conexión con proveedores reales.</p></div><Button onClick={() => setMarketDialog(true)}><Plus className="mr-2 h-4 w-4" />Nuevo mercado</Button></div>{markets.length ? <div className="grid gap-4 lg:grid-cols-2">{markets.map((market) => <article key={market.id} className="rounded-3xl border border-white/8 bg-white/[0.025] p-5"><div className="flex justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.14em] text-blue-300">{marketTypeLabels[market.market_type]}</p><h3 className="mt-2 text-lg font-semibold text-white">{market.name}</h3></div><StatusBadge status={market.status} /></div><p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">{market.description}</p><div className="mt-5 grid grid-cols-3 gap-3 text-sm"><div><p className="text-xs text-slate-500">Activos</p><p className="mt-1 text-slate-200">{market.assets?.length || 0}</p></div><div><p className="text-xs text-slate-500">Volatilidad</p><p className="mt-1 text-slate-200">{(numberValue(market.volatility) * 100).toFixed(2)}%</p></div><div><p className="text-xs text-slate-500">Semilla</p><p className="mt-1 text-slate-200">{market.seed}</p></div></div><div className="mt-5 flex flex-wrap gap-2">{market.assets?.map((asset) => <span key={asset.id} className="rounded-lg bg-slate-950/40 px-2.5 py-1 text-xs text-slate-300">{asset.symbol} · {formatMoney(asset.initial_price, asset.currency)}</span>)}</div></article>)}</div> : <EmptyState icon={BarChart3} title="No hay mercados sintéticos" description="El asistente te guía paso a paso para crear el primero." action={<Button onClick={() => setMarketDialog(true)}>Crear mercado</Button>} />}</section> : null}

          {tab === "events" ? <section><div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-semibold text-white">Biblioteca de eventos</h2><p className="mt-1 text-sm text-slate-500">Las plantillas oficiales se duplican; nunca se modifican directamente.</p></div><Button onClick={() => openEvent()}><Plus className="mr-2 h-4 w-4" />Crear evento</Button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{events.map((event) => <article key={event.id} className="flex flex-col rounded-3xl border border-white/8 bg-white/[0.025] p-5"><div className="flex justify-between gap-2"><StatusBadge status={event.event_kind} /><span className="text-xs text-slate-500">v{event.version}</span></div><h3 className="mt-4 font-semibold text-white">{event.name}</h3><p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-slate-400">{event.description}</p><div className="mt-4 flex items-center justify-between text-xs"><span className={event.direction === "positive" ? "text-emerald-300" : "text-rose-300"}>Impacto {(numberValue(event.impact_percent) * 100).toFixed(1)}%</span><span className="text-slate-500">{event.duration_periods} periodos</span></div><Button className="mt-4 w-full" variant="outline" onClick={() => openEvent(event)}><Copy className="mr-2 h-4 w-4" />{event.event_kind === "base" ? "Personalizar evento" : "Crear variante"}</Button></article>)}</div></section> : null}

          {tab === "scenarios" ? <section><div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-semibold text-white">Escenarios</h2><p className="mt-1 text-sm text-slate-500">Cronología, eventos y mercado listos para una ejecución reproducible.</p></div><Button disabled={!markets.length} onClick={() => setScenarioDialog(true)}><Plus className="mr-2 h-4 w-4" />Nuevo escenario</Button></div>{scenarios.length ? <div className="space-y-4">{scenarios.map((scenario) => <article key={scenario.id} className="rounded-3xl border border-white/8 bg-white/[0.025] p-5"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-start"><div><div className="flex items-center gap-3"><h3 className="text-lg font-semibold text-white">{scenario.name}</h3><StatusBadge status={scenario.status} /></div><p className="mt-2 max-w-3xl text-sm text-slate-400">{scenario.academic_objective}</p><div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500"><span>{scenario.market?.name}</span><span>•</span><span>{scenario.duration_periods} periodos</span><span>•</span><span>{scenario.timeline?.length || 0} eventos</span><span>•</span><span>Semilla {scenario.seed}</span></div></div><Button disabled={busy || activeSessions.length > 0} onClick={() => launch(scenario)}><Play className="mr-2 h-4 w-4" />Iniciar sesión</Button></div>{scenario.timeline?.length ? <div className="mt-5 flex gap-2 overflow-x-auto pb-1">{scenario.timeline.slice().sort((a,b) => a.activation_period - b.activation_period).map((item) => <div key={item.id} className="min-w-48 rounded-xl border border-white/8 bg-slate-950/30 px-3 py-2"><p className="text-[10px] uppercase tracking-wider text-blue-300">Periodo {item.activation_period}</p><p className="mt-1 truncate text-xs text-slate-300">{item.event?.headline || item.event?.name}</p></div>)}</div> : null}</article>)}</div> : <EmptyState icon={Layers3} title="No hay escenarios" description={markets.length ? "Combina uno de tus mercados con eventos y una cronología." : "Primero crea un mercado sintético."} action={markets.length ? <Button onClick={() => setScenarioDialog(true)}>Crear escenario</Button> : null} />}</section> : null}

          {tab === "sessions" ? <section><div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><h2 className="text-xl font-semibold text-white">Sesiones de simulación</h2><p className="mt-1 text-sm text-slate-500">Control, seguimiento y trazabilidad de la ejecución.</p></div>{sessions.length ? <SelectField className="w-64" value={selectedSessionId || ""} onChange={(id) => { setSelectedSessionId(id); void load(id); }}><option value="">Selecciona una sesión</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.name} · {statusLabels[session.state] || session.state}</option>)}</SelectField> : null}</div><TeacherSession session={payload.selectedSession} onControl={control} busy={busy} /></section> : null}
        </main>
      </div>

      <MarketWizard open={marketDialog} onClose={() => setMarketDialog(false)} saving={busy} onSubmit={(form) => mutate("create_market", form, "Mercado sintético creado", () => setMarketDialog(false))} />
      <EventDialog open={eventDialog} sourceEvent={eventSource} onClose={() => { setEventDialog(false); setEventSource(null); }} saving={busy} onSubmit={(event) => mutate("create_event", { event }, "Evento guardado", () => { setEventDialog(false); setEventSource(null); })} />
      <ScenarioDialog open={scenarioDialog} onClose={() => setScenarioDialog(false)} saving={busy} markets={markets} events={events} initialEventId={linkedEventId} onSubmit={(form) => mutate("create_scenario", form, "Escenario validado y guardado", () => setScenarioDialog(false))} />
    </div>
  );
};

export default FinancialLabPage;
