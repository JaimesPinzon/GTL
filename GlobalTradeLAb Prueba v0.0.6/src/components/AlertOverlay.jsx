import React, { useMemo, useState } from "react";
import { BellPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTradingWorkspace } from "@/features/classes/hooks/useTradingWorkspace";
import OverlayPanel from "@/components/OverlayPanel";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "react-i18next";

const AlertOverlay = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { selectedSymbol, getCurrentPrice } = useTradingWorkspace();
  const { toast } = useToast();
  const currentPrice = getCurrentPrice(selectedSymbol);
  const [conditionType, setConditionType] = useState("price");
  const [operator, setOperator] = useState("cross");
  const [value, setValue] = useState(currentPrice ? currentPrice.toFixed(2) : "");
  const [activation, setActivation] = useState("once");

  const defaultMessage = useMemo(
    () =>
      t("alertOverlay.defaultMessage", {
        symbol: selectedSymbol,
        operator: operator === "cross" ? t("alertOverlay.operators.cross") : t("alertOverlay.operators.touch"),
        value: value || "--",
      }),
    [operator, selectedSymbol, t, value]
  );

  const handleCreate = () => {
    toast({
      title: t("alertOverlay.toast.title"),
      description: t("alertOverlay.toast.description", { symbol: selectedSymbol }),
    });
    onClose();
  };

  return (
    <OverlayPanel
      open={open}
      onClose={onClose}
      className="mx-auto mt-10 w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/10 bg-[#1a1b1d] text-white shadow-[0_32px_80px_rgba(0,0,0,0.45)]"
    >
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
              <BellPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">{t("alertOverlay.title", { symbol: selectedSymbol })}</h2>
              <p className="text-sm text-zinc-400">{t("alertOverlay.description")}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="text-zinc-300 hover:bg-white/10 hover:text-white" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="space-y-6 px-6 py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[140px_minmax(0,1fr)] md:items-center">
          <p className="text-sm text-zinc-400">{t("alertOverlay.labels.condition")}</p>
          <div className="space-y-3">
            <Select value={conditionType} onValueChange={setConditionType}>
              <SelectTrigger className="h-12 border-white/10 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price">{t("alertOverlay.conditions.price")}</SelectItem>
                <SelectItem value="change">{t("alertOverlay.conditions.change")}</SelectItem>
                <SelectItem value="volume">{t("alertOverlay.conditions.volume")}</SelectItem>
              </SelectContent>
            </Select>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
              <Select value={operator} onValueChange={setOperator}>
                <SelectTrigger className="h-12 border-white/10 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cross">{t("alertOverlay.operators.cross")}</SelectItem>
                  <SelectItem value="touch">{t("alertOverlay.operators.touch")}</SelectItem>
                  <SelectItem value="above">{t("alertOverlay.operators.above")}</SelectItem>
                  <SelectItem value="below">{t("alertOverlay.operators.below")}</SelectItem>
                </SelectContent>
              </Select>

              <Input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="h-12 border-white/10 bg-white/5 text-white"
                placeholder={t("alertOverlay.placeholders.value")}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-white/10 pt-5 text-sm md:grid-cols-[160px_minmax(0,1fr)]">
          <span className="text-zinc-400">{t("alertOverlay.labels.activation")}</span>
          <Select value={activation} onValueChange={setActivation}>
            <SelectTrigger className="h-11 border-white/10 bg-white/5 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="once">{t("alertOverlay.activation.once")}</SelectItem>
              <SelectItem value="always">{t("alertOverlay.activation.always")}</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-zinc-400">{t("alertOverlay.labels.expiration")}</span>
          <div className="flex h-11 items-center rounded-xl border border-white/10 bg-white/5 px-4 text-white">
            15 de abril de 2026, 05:26
          </div>

          <span className="text-zinc-400">{t("alertOverlay.labels.message")}</span>
          <div className="flex h-11 items-center rounded-xl border border-white/10 bg-white/5 px-4 text-white">
            {defaultMessage}
          </div>

          <span className="text-zinc-400">{t("alertOverlay.labels.notifications")}</span>
          <div className="flex h-11 items-center rounded-xl border border-white/10 bg-white/5 px-4 text-white">
            {t("alertOverlay.notificationChannels")}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-5">
        <Button variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10" onClick={onClose}>
          {t("common.actions.cancel")}
        </Button>
        <Button className="bg-white text-[#161819] hover:bg-zinc-200" onClick={handleCreate}>
          {t("alertOverlay.actions.create")}
        </Button>
      </div>
    </OverlayPanel>
  );
};

export default AlertOverlay;
