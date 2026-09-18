import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import OverlayPanel from "@/components/OverlayPanel";
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  GripVertical,
  HelpCircle,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Star,
  Trash2,
  X,
} from "lucide-react";

const CATEGORIES = ["favorites", "all", "trend", "momentum", "volatility", "volume"];

const INDICATOR_CATALOG = [
  { id: "ema", shortName: "EMA", nameKey: "ema", descriptionKey: "emaDescription", category: "trend", enabled: true, terms: "ema media movil exponential average trend tendencia" },
  { id: "macd", shortName: "MACD", nameKey: "macd", descriptionKey: "macdDescription", category: "momentum", enabled: true, terms: "macd convergencia divergencia momentum moving average" },
  { id: "bollinger", shortName: "BB", nameKey: "bollinger", descriptionKey: "bollingerDescription", category: "volatility", enabled: false, terms: "bollinger bandas volatilidad bands" },
  { id: "rsi", shortName: "RSI", nameKey: "rsi", descriptionKey: "rsiDescription", category: "momentum", enabled: false, terms: "rsi fuerza relativa momentum relative strength" },
  { id: "volume", shortName: "OBV", nameKey: "volume", descriptionKey: "volumeDescription", category: "volume", enabled: false, terms: "obv balance volumen volume" },
];

const cloneInstance = (instance) => JSON.parse(JSON.stringify(instance));

const IndicatorEditor = ({ instance, onApply, onBack, onReset }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => cloneInstance(instance));

  useEffect(() => setDraft(cloneInstance(instance)), [instance]);

  const updateParameter = (field, value) => {
    setDraft((current) => ({
      ...current,
      parameters: { ...current.parameters, [field]: Math.max(1, Number.parseInt(value, 10) || 1) },
    }));
  };

  const updateStyle = (field, value) => {
    setDraft((current) => ({ ...current, style: { ...current.style, [field]: value } }));
  };

  const apply = () => {
    if (draft.id === "macd") {
      const shortPeriod = Math.max(1, draft.parameters.shortPeriod);
      const longPeriod = Math.max(shortPeriod + 1, draft.parameters.longPeriod);
      const signalPeriod = Math.max(1, draft.parameters.signalPeriod);
      onApply(draft.id, {
        parameters: { shortPeriod, longPeriod, signalPeriod },
        style: draft.style,
      });
    } else {
      onApply(draft.id, { parameters: draft.parameters, style: draft.style });
    }
    onBack();
  };

  const colorField = (label, field) => (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-sm text-zinc-300">
      <span>{label}</span>
      <input
        type="color"
        value={draft.style[field]}
        onChange={(event) => updateStyle(field, event.target.value)}
        className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
      />
    </label>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <button type="button" onClick={onBack} className="rounded-lg p-2 text-zinc-400 hover:bg-white/10 hover:text-white" aria-label={t("common.actions.back")}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t("priceChart.indicators.settings")}</p>
          <h3 className="text-lg font-semibold text-white">{instance.name}</h3>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <section>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{t("priceChart.indicators.parameters")}</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {draft.id === "ema" ? (
              <>
                <label className="space-y-1.5 text-sm text-zinc-300">
                  <span>{t("priceChart.indicators.period")}</span>
                  <input type="number" min="1" max="500" value={draft.parameters.period} onChange={(event) => updateParameter("period", event.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-white outline-none focus:border-primary/70" />
                </label>
                <label className="space-y-1.5 text-sm text-zinc-300">
                  <span>{t("priceChart.indicators.source")}</span>
                  <select value="close" disabled className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-zinc-300">
                    <option value="close">{t("priceChart.indicators.close")}</option>
                  </select>
                </label>
              </>
            ) : (
              <>
                <label className="space-y-1.5 text-sm text-zinc-300"><span>{t("priceChart.indicators.fastPeriod")}</span><input type="number" min="1" max="200" value={draft.parameters.shortPeriod} onChange={(event) => updateParameter("shortPeriod", event.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-white outline-none focus:border-primary/70" /></label>
                <label className="space-y-1.5 text-sm text-zinc-300"><span>{t("priceChart.indicators.slowPeriod")}</span><input type="number" min="2" max="500" value={draft.parameters.longPeriod} onChange={(event) => updateParameter("longPeriod", event.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-white outline-none focus:border-primary/70" /></label>
                <label className="space-y-1.5 text-sm text-zinc-300"><span>{t("priceChart.indicators.signalPeriod")}</span><input type="number" min="1" max="200" value={draft.parameters.signalPeriod} onChange={(event) => updateParameter("signalPeriod", event.target.value)} className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-white outline-none focus:border-primary/70" /></label>
              </>
            )}
          </div>
        </section>

        <div className="my-5 h-px bg-white/10" />

        <section>
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{t("priceChart.indicators.appearance")}</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {draft.id === "ema" ? colorField(t("priceChart.indicators.lineColor"), "color") : (
              <>
                {colorField(t("priceChart.indicators.macdLine"), "macdColor")}
                {colorField(t("priceChart.indicators.signalLine"), "signalColor")}
                {colorField(t("priceChart.indicators.positiveHistogram"), "positiveColor")}
                {colorField(t("priceChart.indicators.negativeHistogram"), "negativeColor")}
              </>
            )}
            <label className="space-y-1.5 text-sm text-zinc-300">
              <span>{t("priceChart.indicators.lineWidth")}</span>
              <select value={draft.style.lineWidth} onChange={(event) => updateStyle("lineWidth", Number(event.target.value))} className="h-10 w-full rounded-xl border border-white/10 bg-[#181a1b] px-3 text-white">
                {[1, 2, 3, 4].map((width) => <option key={width} value={width}>{width} px</option>)}
              </select>
            </label>
          </div>
        </section>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
        <button type="button" onClick={() => { onReset(instance.id); onBack(); }} className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-zinc-400 hover:bg-white/10 hover:text-white"><RotateCcw className="h-4 w-4" />{t("priceChart.indicators.reset")}</button>
        <button type="button" onClick={apply} className="h-10 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">{t("priceChart.indicators.apply")}</button>
      </div>
    </div>
  );
};

const IndicatorsOverlay = ({
  activeInstances,
  favorites,
  initialEditingId,
  instances,
  maxActiveIndicators,
  onAdd,
  onClose,
  onRemove,
  onReorder,
  onReset,
  onToggleFavorite,
  onToggleVisibility,
  onUpdate,
  open,
}) => {
  const { t } = useTranslation();
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [draggedId, setDraggedId] = useState(null);

  useEffect(() => {
    if (open && initialEditingId) setEditingId(initialEditingId);
    if (!open) setEditingId(null);
  }, [initialEditingId, open]);

  const filteredIndicators = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return INDICATOR_CATALOG.filter((indicator) => {
      if (category === "favorites" && !favorites.includes(indicator.id)) return false;
      if (!["all", "favorites"].includes(category) && indicator.category !== category) return false;
      if (!normalizedQuery) return true;
      const searchable = `${indicator.shortName} ${t(`priceChart.indicators.${indicator.nameKey}`)} ${t(`priceChart.indicators.${indicator.descriptionKey}`)} ${indicator.terms}`.toLocaleLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [category, favorites, query, t]);

  const editingInstance = instances.find((instance) => instance.id === editingId);

  return (
    <OverlayPanel
      open={open}
      onClose={onClose}
      className="mx-auto mt-auto flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#111315] text-white shadow-[0_32px_90px_rgba(0,0,0,0.6)] sm:mt-10 sm:max-h-[calc(100vh-5rem)] sm:rounded-[28px]"
      backdropClassName="flex"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold sm:text-2xl">{t("priceChart.indicators.title")}</h2>
            <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{t("priceChart.indicators.activeCount", { count: activeInstances.length })}</span>
          </div>
          <p className="mt-1 hidden text-sm text-zinc-400 sm:block">{t("priceChart.indicators.description")}</p>
        </div>
        <button type="button" className="rounded-xl p-2 text-zinc-400 hover:bg-white/10 hover:text-white" onClick={onClose} aria-label={t("common.actions.close")}><X className="h-5 w-5" /></button>
      </div>

      {editingInstance ? (
        <IndicatorEditor instance={editingInstance} onApply={onUpdate} onBack={() => setEditingId(null)} onReset={onReset} />
      ) : (
        <>
          <div className="px-5 py-4 sm:px-6">
            <label className="flex h-11 items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 focus-within:border-primary/60">
              <Search className="h-4 w-4 text-zinc-500" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("priceChart.indicators.searchPlaceholder")} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600" />
              {query ? <button type="button" onClick={() => setQuery("")} className="text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button> : null}
            </label>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 border-y border-white/10 sm:grid-cols-[180px_minmax(0,1fr)]">
            <nav className="flex gap-1 overflow-x-auto border-b border-white/10 p-3 sm:block sm:overflow-visible sm:border-b-0 sm:border-r">
              {CATEGORIES.map((item) => (
                <button key={item} type="button" onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm transition sm:mb-1 sm:w-full ${category === item ? "bg-primary/15 font-semibold text-primary" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}>
                  {item === "favorites" ? <Star className="mr-2 inline h-3.5 w-3.5" /> : null}{t(`priceChart.indicators.categories.${item}`)}
                </button>
              ))}
            </nav>

            <div className="min-h-[220px] overflow-y-auto p-3 sm:max-h-[330px]">
              {filteredIndicators.length ? filteredIndicators.map((indicator) => {
                const instance = instances.find((item) => item.id === indicator.id);
                const isActive = Boolean(instance?.active);
                const isFavorite = favorites.includes(indicator.id);
                return (
                  <div key={indicator.id} className="group flex items-center gap-3 rounded-2xl border border-transparent px-3 py-3 transition hover:border-white/10 hover:bg-white/[0.035]">
                    <div className="flex h-10 w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-xs font-bold text-zinc-200">{indicator.shortName}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">{t(`priceChart.indicators.${indicator.nameKey}`)}</p>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">{t(`priceChart.indicators.${indicator.descriptionKey}`)}</p>
                    </div>
                    <button type="button" onClick={() => onToggleFavorite(indicator.id)} className={`rounded-lg p-2 hover:bg-white/10 ${isFavorite ? "text-amber-400" : "text-zinc-600 hover:text-zinc-300"}`} aria-label={t("priceChart.indicators.favorite")}><Star className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} /></button>
                    <button type="button" title={t(`priceChart.indicators.${indicator.descriptionKey}`)} className="hidden rounded-lg p-2 text-zinc-600 hover:bg-white/10 hover:text-zinc-300 sm:block"><HelpCircle className="h-4 w-4" /></button>
                    {indicator.enabled ? (
                      <button type="button" disabled={isActive || activeInstances.length >= maxActiveIndicators} onClick={() => onAdd(indicator.id)} className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${isActive ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-400" : "border-white/10 bg-white/[0.04] text-zinc-300 hover:border-primary/50 hover:bg-primary/10 hover:text-primary disabled:opacity-40"}`} aria-label={t("priceChart.indicators.add")}>
                        {isActive ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </button>
                    ) : <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-400">{t("priceChart.indicators.comingSoon")}</span>}
                  </div>
                );
              }) : <div className="flex h-full min-h-[180px] items-center justify-center text-sm text-zinc-500">{t("priceChart.indicators.noResults")}</div>}
            </div>
          </div>

          <section className="shrink-0 px-5 py-4 sm:px-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{t("priceChart.indicators.applied")}</h3>
              <span className="text-xs text-zinc-600">{activeInstances.length}/{maxActiveIndicators}</span>
            </div>
            {activeInstances.length ? (
              <div className="grid max-h-[170px] gap-2 overflow-y-auto sm:grid-cols-2">
                {activeInstances.map((instance) => (
                  <div
                    key={instance.id}
                    draggable
                    onDragStart={() => setDraggedId(instance.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => { onReorder(draggedId, instance.id); setDraggedId(null); }}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-2.5 py-2"
                  >
                    <GripVertical className="h-4 w-4 cursor-grab text-zinc-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-100">{instance.name}</p>
                      <p className="truncate text-[11px] text-zinc-500">{instance.id === "ema" ? t("priceChart.indicators.emaSummary", { period: instance.parameters.period }) : t("priceChart.indicators.macdSummary", instance.parameters)}</p>
                    </div>
                    <button type="button" onClick={() => onToggleVisibility(instance.id)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white" title={instance.visible ? t("priceChart.indicators.hide") : t("priceChart.indicators.show")}>{instance.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
                    <button type="button" onClick={() => setEditingId(instance.id)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white" title={t("priceChart.indicators.settings")}><Settings className="h-4 w-4" /></button>
                    <button type="button" onClick={() => onRemove(instance.id)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400" title={t("priceChart.indicators.remove")}><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-4 text-center">
                <p className="text-sm font-medium text-zinc-300">{t("priceChart.indicators.emptyTitle")}</p>
                <p className="mt-1 text-xs text-zinc-600">{t("priceChart.indicators.emptyDescription")}</p>
              </div>
            )}
          </section>
        </>
      )}
    </OverlayPanel>
  );
};

export default IndicatorsOverlay;
