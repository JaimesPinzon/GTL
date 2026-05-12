import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import OverlayPanel from "@/components/OverlayPanel";
import { Check, Palette, X } from "lucide-react";

const PALETTE = [
  "#ffffff", "#d4d4d8", "#a1a1aa", "#52525b", "#18181b",
  "#ff4d5a", "#ff8a00", "#facc15", "#65a30d", "#14b8a6",
  "#06b6d4", "#2563eb", "#7c3aed", "#a21caf", "#ec4899",
  "#fecdd3", "#fde68a", "#fef3c7", "#d9f99d", "#a7f3d0",
  "#99f6e4", "#bfdbfe", "#c4b5fd", "#e9d5ff", "#f5d0fe",
  "#fb7185", "#fdba74", "#fcd34d", "#86efac", "#5eead4",
  "#67e8f9", "#60a5fa", "#818cf8", "#c084fc", "#f472b6",
  "#be123c", "#ea580c", "#ca8a04", "#15803d", "#0f766e",
  "#0e7490", "#1d4ed8", "#5b21b6", "#7e22ce", "#be185d",
];

const ColorChip = ({ value, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative h-9 w-9 rounded-md border transition ${selected ? "border-primary" : "border-white/10"}`}
    style={{ backgroundColor: value }}
  >
    {selected ? <div className="absolute inset-0 rounded-md ring-2 ring-primary/80 ring-offset-2 ring-offset-[#161819]" /> : null}
  </button>
);

const ToggleRow = ({ label, checked, onToggle, positiveColor, negativeColor, onPositiveColor, onNegativeColor }) => (
  <div className="flex items-center justify-between gap-4">
    <label className="flex items-center gap-3 text-lg text-zinc-200">
      <input type="checkbox" checked={checked} onChange={onToggle} className="h-4 w-4 rounded border-white/20 bg-transparent" />
      {label}
    </label>

    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onPositiveColor}
        className="h-12 w-12 rounded-xl border border-white/10 shadow-inner"
        style={{ backgroundColor: positiveColor }}
      />
      <button
        type="button"
        onClick={onNegativeColor}
        className="h-12 w-12 rounded-xl border border-white/10 shadow-inner"
        style={{ backgroundColor: negativeColor }}
      />
    </div>
  </div>
);

const ChartAppearanceOverlay = ({
  open,
  onClose,
  appearance,
  onChange,
  onReset,
}) => {
  const { t } = useTranslation();
  const targetField = appearance.paletteTarget || "upColor";

  return (
    <OverlayPanel
      open={open}
      onClose={onClose}
      className="mx-auto mt-10 w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/10 bg-[#161819] text-white shadow-[0_32px_80px_rgba(0,0,0,0.45)]"
    >
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8">
              <Palette className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">{t("priceChart.appearance.title")}</h2>
              <p className="text-sm text-zinc-400">{t("priceChart.appearance.description")}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="text-zinc-300 hover:bg-white/10 hover:text-white" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="space-y-6 px-6 py-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChange("paletteTarget", "backgroundColor")}
            className="h-14 w-14 rounded-2xl border border-white/10"
            style={{ backgroundColor: appearance.backgroundColor }}
          />
          <button
            type="button"
            onClick={() => onChange("paletteTarget", "lineColor")}
            className="h-14 w-14 rounded-2xl border border-white/10"
            style={{ backgroundColor: appearance.lineColor }}
          />
        </div>

        <div className="grid grid-cols-10 gap-2">
          {PALETTE.map((color) => (
            <ColorChip
              key={color}
              value={color}
              selected={appearance[targetField] === color}
              onClick={() => onChange(targetField, color)}
            />
          ))}
        </div>

        <div className="space-y-4 border-t border-white/10 pt-5">
          <ToggleRow
            label={t("priceChart.appearance.body")}
            checked={appearance.bodyEnabled}
            onToggle={() => onChange("bodyEnabled", !appearance.bodyEnabled)}
            positiveColor={appearance.upColor}
            negativeColor={appearance.downColor}
            onPositiveColor={() => onChange("paletteTarget", "upColor")}
            onNegativeColor={() => onChange("paletteTarget", "downColor")}
          />

          <ToggleRow
            label={t("priceChart.appearance.borders")}
            checked={appearance.borderEnabled}
            onToggle={() => onChange("borderEnabled", !appearance.borderEnabled)}
            positiveColor={appearance.upColor}
            negativeColor={appearance.downColor}
            onPositiveColor={() => onChange("paletteTarget", "upColor")}
            onNegativeColor={() => onChange("paletteTarget", "downColor")}
          />

          <ToggleRow
            label={t("priceChart.appearance.wick")}
            checked={appearance.wickEnabled}
            onToggle={() => onChange("wickEnabled", !appearance.wickEnabled)}
            positiveColor={appearance.upColor}
            negativeColor={appearance.downColor}
            onPositiveColor={() => onChange("paletteTarget", "upColor")}
            onNegativeColor={() => onChange("paletteTarget", "downColor")}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-5">
        <Button variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10" onClick={onReset}>
          {t("common.actions.reset")}
        </Button>
        <Button className="bg-white text-[#161819] hover:bg-zinc-200" onClick={onClose}>
          {t("common.actions.done")}
        </Button>
      </div>
    </OverlayPanel>
  );
};

export default ChartAppearanceOverlay;
