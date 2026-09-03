import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarClock, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useTradingContext } from "@/contexts/TradingContext";
import { useClassContext } from "@/features/classes/context/ClassContext";
import { getDefaultRoomBalanceForCurrency, ROOM_CURRENCY_OPTIONS, ROOM_MARKET_OPTIONS } from "@/lib/room-options";
import { APP_HOME_PATH, buildClassHomeRoute } from "@/lib/routes";

const ROOM_STATE_OPTIONS = [
  { value: "active", label: "Activa" },
  { value: "closed", label: "Cerrada" },
  { value: "archived", label: "Archivada" },
];

const getTodayIsoDate = () => new Date().toISOString().slice(0, 10);
const gtlDateInputClass = "gtl-date-input h-11 rounded-2xl border-white/10 bg-[#0b1220] pr-10 text-slate-100";
const gtlCalendarButtonClass = "absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-white/10 hover:text-slate-200";
const gtlCheckboxClass = "gtl-checkbox h-4 w-4 rounded-md border border-white/30 bg-[#0b1220] text-primary accent-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-0";

const openNativeDatePicker = (inputElement) => {
  if (!inputElement) {
    return;
  }

  try {
    if (typeof inputElement.showPicker === "function") {
      inputElement.showPicker();
      return;
    }
  } catch (error) {
    console.warn("showPicker unavailable", error);
  }

  inputElement.focus();
  inputElement.click();
};

const EditClassPage = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, preferencesState, updateManagedRoomDetails, deleteManagedRoom } = useTradingContext();
  const { activeClass } = useClassContext();
  const startDateInputRef = useRef(null);
  const endDateInputRef = useRef(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    state: "active",
    defaultCurrency: "USD",
    defaultBalance: String(getDefaultRoomBalanceForCurrency("USD")),
    startDate: getTodayIsoDate(),
    endDate: "",
    allowRanking: true,
    allowGrades: true,
    portfolioVisibility: "teacher_only",
    allowedMarkets: [],
    coverImageUrl: "",
    balanceEdited: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);
  const showContextualHelpMessages = preferencesState?.contextualHelpMessages ?? true;

  useEffect(() => {
    if (!activeClass) {
      return;
    }

    setForm({
      name: activeClass.name || "",
      description: activeClass.description || "",
      state: ["active", "closed", "archived"].includes(activeClass.state) ? activeClass.state : "active",
      defaultCurrency: activeClass.defaultCurrency || "USD",
      defaultBalance: String(
        Number(activeClass.defaultBalance ?? getDefaultRoomBalanceForCurrency(activeClass.defaultCurrency || "USD"))
      ),
      startDate: activeClass.operationStartDate || activeClass.startDate || getTodayIsoDate(),
      endDate: activeClass.operationCloseDate || activeClass.endDate || "",
      allowRanking: activeClass.allowRanking ?? true,
      allowGrades: activeClass.allowGrades ?? true,
      portfolioVisibility: activeClass.portfolioVisibility || "teacher_only",
      allowedMarkets: Array.isArray(activeClass.allowedMarkets) ? activeClass.allowedMarkets : [],
      coverImageUrl: activeClass.coverImageUrl || "",
      balanceEdited: false,
    });
  }, [activeClass]);

  const handleCurrencyChange = (nextCurrency) => {
    setForm((previous) => {
      const previousDefault = getDefaultRoomBalanceForCurrency(previous.defaultCurrency);
      const nextDefault = getDefaultRoomBalanceForCurrency(nextCurrency);
      const numericBalance = Number(previous.defaultBalance);
      const shouldSyncBalance =
        !previous.balanceEdited || Number.isNaN(numericBalance) || numericBalance === previousDefault;

      return {
        ...previous,
        defaultCurrency: nextCurrency,
        defaultBalance: shouldSyncBalance ? String(nextDefault) : previous.defaultBalance,
      };
    });
  };

  const handleStartDateChange = (nextStartDate) => {
    setForm((previous) => ({
      ...previous,
      startDate: nextStartDate,
      endDate:
        previous.endDate && nextStartDate && previous.endDate < nextStartDate
          ? nextStartDate
          : previous.endDate,
    }));
  };

  const toggleMarket = (marketId) => {
    setForm((previous) => {
      const nextMarkets = previous.allowedMarkets.includes(marketId)
        ? previous.allowedMarkets.filter((entry) => entry !== marketId)
        : [...previous.allowedMarkets, marketId];

      return {
        ...previous,
        allowedMarkets: nextMarkets,
      };
    });
  };

  const handleCoverChange = (event) => {
    const file = event.target?.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({
        title: t("trading.form.invalidFileTypeTitle"),
        description: t("trading.form.invalidFileTypeDescription"),
        variant: "destructive",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: t("trading.form.fileTooLargeTitle"),
        description: t("trading.form.fileTooLargeDescription"),
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setForm((previous) => ({
        ...previous,
        coverImageUrl: result,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!activeClass?.id) {
      return;
    }

    if (!form.name.trim()) {
      toast({
        title: t("classes.toasts.roomNameRequiredTitle"),
        description: t("classes.toasts.roomNameRequiredDescription"),
        variant: "destructive",
      });
      return;
    }

    if (!String(form.defaultCurrency || "").trim()) {
      toast({
        title: t("classes.toasts.currencyRequiredTitle"),
        description: t("classes.toasts.currencyRequiredDescription"),
        variant: "destructive",
      });
      return;
    }

    const parsedBaseBalance = Number(form.defaultBalance);
    if (!Number.isFinite(parsedBaseBalance) || parsedBaseBalance <= 0) {
      toast({
        title: t("classes.toasts.baseBalanceInvalidTitle"),
        description: t("classes.toasts.baseBalanceInvalidDescription"),
        variant: "destructive",
      });
      return;
    }

    if (String(form.endDate || "").trim() && String(form.startDate || "").trim() && form.endDate < form.startDate) {
      toast({
        title: t("classes.toasts.invalidDateRangeTitle"),
        description: t("classes.toasts.invalidDateRangeDescription"),
        variant: "destructive",
      });
      return;
    }

    if (!Array.isArray(form.allowedMarkets) || form.allowedMarkets.length < 1) {
      toast({
        title: t("classes.toasts.marketRequiredTitle"),
        description: t("classes.toasts.marketRequiredDescription"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const operationStartDate = String(form.startDate || "").trim() || getTodayIsoDate();
      await updateManagedRoomDetails({
        roomId: activeClass.id,
        name: form.name,
        description: form.description,
        state: form.state,
        defaultBalance: parsedBaseBalance,
        defaultCurrency: form.defaultCurrency,
        startDate: operationStartDate,
        endDate: form.endDate,
        roomSettings: {
          allowRanking: Boolean(form.allowRanking),
          allowGrades: Boolean(form.allowGrades),
          portfolioVisibility: form.portfolioVisibility,
          allowedMarkets: form.allowedMarkets,
          coverImageUrl: form.coverImageUrl,
          operationStartDate,
          operationCloseDate: form.endDate || null,
        },
      });

      toast({
        title: t("classes.edit.toasts.updatedTitle"),
        description: t("classes.edit.toasts.updatedDescription"),
      });

      navigate(buildClassHomeRoute(activeClass.id));
    } catch (error) {
      toast({
        title: t("classes.edit.toasts.errorTitle"),
        description: error instanceof Error ? error.message : t("classes.toasts.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!activeClass?.id) {
      return;
    }

    setIsDeletingRoom(true);
    try {
      await deleteManagedRoom(activeClass.id);
      toast({
        title: t("classes.toasts.roomDeletedTitle"),
        description: t("classes.toasts.roomDeletedDescription", { name: activeClass.name || form.name }),
      });
      setIsDeleteConfirmOpen(false);
      navigate(APP_HOME_PATH);
    } catch (error) {
      toast({
        title: t("classes.toasts.roomDeleteErrorTitle"),
        description: error instanceof Error ? error.message : t("classes.toasts.tryAgain"),
        variant: "destructive",
      });
    } finally {
      setIsDeletingRoom(false);
    }
  };

  return (
    <div className="scrollbar-dashboard h-full overflow-y-auto overflow-x-hidden">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{t("classes.edit.eyebrow")}</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">{activeClass?.name || t("classes.edit.title")}</h1>
            {showContextualHelpMessages ? (
              <p className="mt-3 text-sm leading-6 text-slate-400">{t("classes.edit.description")}</p>
            ) : null}
          </div>

          <Button variant="ghost" className="rounded-2xl" onClick={() => navigate(APP_HOME_PATH)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("classes.edit.back")}
          </Button>
        </div>

        <Card className="glass-card overflow-hidden">
          <CardHeader className="border-b border-white/8 bg-white/[0.02]">
            <CardTitle className="text-2xl">{t("classes.edit.formTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="grid gap-5 lg:grid-cols-3">
              <div className="space-y-5 lg:col-span-2">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("classes.edit.fields.name")}</label>
                  <Input
                    value={form.name}
                    onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
                    className="h-11 rounded-2xl border-white/10 bg-[#0b1220] text-slate-100 placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("classes.edit.fields.description")}</label>
                  <Textarea
                    rows={5}
                    value={form.description}
                    onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
                    className="rounded-2xl border-white/10 bg-[#0b1220] text-slate-100 placeholder:text-slate-500"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.18em] text-slate-500">Moneda *</label>
                    <select
                      value={form.defaultCurrency}
                      onChange={(event) => handleCurrencyChange(event.target.value)}
                      disabled
                      className="h-11 w-full rounded-2xl border border-white/10 bg-[#0b1220] px-3 text-slate-100"
                    >
                      {ROOM_CURRENCY_OPTIONS.map((currency) => (
                        <option key={currency.code} value={currency.code}>
                          {currency.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500">La moneda queda fija al crear la sala.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.18em] text-slate-500">Saldo inicial *</label>
                    <Input
                      type="number"
                      min="1"
                      value={form.defaultBalance}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          defaultBalance: event.target.value,
                          balanceEdited: true,
                        }))
                      }
                      className="h-11 rounded-2xl border-white/10 bg-[#0b1220] text-slate-100"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.18em] text-slate-500">Fecha de inicio</label>
                    <div className="relative">
                      <Input
                        type="date"
                        ref={startDateInputRef}
                        value={form.startDate}
                        onChange={(event) => handleStartDateChange(event.target.value)}
                        className={gtlDateInputClass}
                      />
                      <button
                        type="button"
                        className={gtlCalendarButtonClass}
                        onClick={() => openNativeDatePicker(startDateInputRef.current)}
                        aria-label="Abrir calendario de fecha de inicio"
                      >
                        <CalendarClock className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.18em] text-slate-500">Fecha de cierre de operaciones (opcional)</label>
                    <div className="relative">
                      <Input
                        type="date"
                        ref={endDateInputRef}
                        value={form.endDate}
                        min={form.startDate || undefined}
                        onChange={(event) => setForm((previous) => ({ ...previous, endDate: event.target.value }))}
                        className={gtlDateInputClass}
                      />
                      <button
                        type="button"
                        className={gtlCalendarButtonClass}
                        onClick={() => openNativeDatePicker(endDateInputRef.current)}
                        aria-label="Abrir calendario de fecha de cierre"
                        >
                          <CalendarClock className="h-4 w-4" />
                        </button>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
                      onClick={() => setForm((previous) => ({ ...previous, endDate: "" }))}
                    >
                      Definir cierre indefinido
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.18em] text-slate-500">Mercados habilitados</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ROOM_MARKET_OPTIONS.map((market) => (
                      <label
                        key={market.id}
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
                      >
                        <input
                          type="checkbox"
                          className={gtlCheckboxClass}
                          checked={form.allowedMarkets.includes(market.id)}
                          onChange={() => toggleMarket(market.id)}
                        />
                        {market.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs uppercase tracking-[0.18em] text-slate-500">{t("classes.edit.fields.state")}</label>
                  <div className="grid gap-3 md:grid-cols-3">
                    {ROOM_STATE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setForm((previous) => ({ ...previous, state: option.value }))}
                        className={`rounded-2xl border px-4 py-4 text-left transition ${
                          form.state === option.value
                            ? "border-primary/35 bg-primary/12 text-primary"
                            : "border-white/10 bg-white/[0.03] text-slate-300"
                        }`}
                      >
                        <p className="font-medium">{option.label}</p>
                        <p className="mt-2 text-sm text-slate-400">{t(`classes.edit.states.${option.value}`)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 lg:col-span-1">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Otras preferencias</p>
                <div className="mt-4 space-y-3">
                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b1220]/70 px-3 py-2.5 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      className={gtlCheckboxClass}
                      checked={form.allowRanking}
                      onChange={(event) =>
                        setForm((previous) => ({ ...previous, allowRanking: event.target.checked }))
                      }
                    />
                    Permitir ranking
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b1220]/70 px-3 py-2.5 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      className={gtlCheckboxClass}
                      checked={form.allowGrades}
                      onChange={(event) =>
                        setForm((previous) => ({ ...previous, allowGrades: event.target.checked }))
                      }
                    />
                    Permitir calificaciones
                  </label>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.18em] text-slate-500">Visibilidad del portafolio</label>
                    <select
                      value={form.portfolioVisibility}
                      onChange={(event) =>
                        setForm((previous) => ({ ...previous, portfolioVisibility: event.target.value }))
                      }
                      className="h-11 w-full rounded-2xl border border-white/10 bg-[#0b1220] px-3 text-slate-100"
                    >
                      <option value="teacher_only">Solo docente</option>
                      <option value="public">Visible para estudiantes</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.18em] text-slate-500">Portada de la sala (opcional)</label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverChange}
                      className="h-11 rounded-2xl border-white/10 bg-[#0b1220] text-slate-100"
                    />
                    {form.coverImageUrl ? (
                      <img
                        src={form.coverImageUrl}
                        alt="Vista previa de portada"
                        className="h-24 w-full rounded-2xl border border-white/10 object-cover"
                      />
                    ) : null}
                  </div>
                </div>
              </aside>
            </div>

            {showContextualHelpMessages ? (
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-400">
                {user?.role === "teacher" ? t("classes.edit.teacherNote") : t("classes.edit.studentNote")}
              </div>
            ) : null}

            {user?.role === "teacher" ? (
              <div className="rounded-2xl border border-red-500/45 bg-red-950/20 p-4">
                <Button
                  type="button"
                  className="bg-red-600 text-white hover:bg-red-500"
                  onClick={() => setIsDeleteConfirmOpen(true)}
                >
                  {t("classes.actions.deleteClass")}
                </Button>
              </div>
            ) : null}

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => navigate(APP_HOME_PATH)}>
                {t("common.actions.cancel")}
              </Button>
              <Button onClick={handleSave} disabled={isSubmitting}>
                <Save className="mr-2 h-4 w-4" />
                {isSubmitting ? t("classes.common.saving") : t("classes.edit.save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {isDeleteConfirmOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/65 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[28px] border border-red-500/45 bg-[#1a1114] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <h3 className="mt-2 text-2xl font-semibold text-red-100">{t("classes.modals.deleteRoomTitle")}</h3>
            <p className="mt-3 text-sm font-medium text-red-200">
              {t("classes.modals.deleteRoomConfirmPrompt", { room: activeClass?.name || form.name })}
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setIsDeleteConfirmOpen(false)}
                disabled={isDeletingRoom}
                className="border border-red-500/30 text-red-100 hover:bg-red-500/15"
              >
                {t("common.actions.cancel")}
              </Button>
              <Button
                onClick={handleDeleteRoom}
                disabled={isDeletingRoom}
                className="bg-red-600 text-white hover:bg-red-500"
              >
                {isDeletingRoom ? t("classes.common.saving") : t("classes.modals.deleteRoomConfirm")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default EditClassPage;
