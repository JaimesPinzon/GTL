import React, { useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useTradingContext } from "@/contexts/TradingContext";
import { useClassContext } from "@/features/classes/context/ClassContext";
import { buildClassHomeRoute } from "@/lib/routes";

const ROOM_STATE_OPTIONS = [
  { value: "active", label: "Activa" },
  { value: "inactive", label: "Inactiva" },
  { value: "deleted", label: "Eliminada" },
];

const EditClassPage = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, updateManagedRoomDetails } = useTradingContext();
  const { activeClass } = useClassContext();
  const [form, setForm] = useState({
    name: "",
    description: "",
    state: "active",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!activeClass) {
      return;
    }

    setForm({
      name: activeClass.name || "",
      description: activeClass.description || "",
      state: ["active", "inactive", "deleted"].includes(activeClass.state) ? activeClass.state : "active",
    });
  }, [activeClass]);

  const handleSave = async () => {
    if (!activeClass?.id) {
      return;
    }

    setIsSubmitting(true);

    try {
      await updateManagedRoomDetails({
        roomId: activeClass.id,
        name: form.name,
        description: form.description,
        state: form.state,
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

  return (
    <div className="scrollbar-dashboard h-full overflow-y-auto overflow-x-hidden">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{t("classes.edit.eyebrow")}</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">{activeClass?.name || t("classes.edit.title")}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">{t("classes.edit.description")}</p>
          </div>

          <Button variant="ghost" className="rounded-2xl" onClick={() => navigate(buildClassHomeRoute(activeClass?.id || ""))}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("classes.edit.back")}
          </Button>
        </div>

        <Card className="glass-card overflow-hidden">
          <CardHeader className="border-b border-white/8 bg-white/[0.02]">
            <CardTitle className="text-2xl">{t("classes.edit.formTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
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
                rows={6}
                value={form.description}
                onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
                className="rounded-2xl border-white/10 bg-[#0b1220] text-slate-100 placeholder:text-slate-500"
              />
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

            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-400">
              {user?.role === "teacher" ? t("classes.edit.teacherNote") : t("classes.edit.studentNote")}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => navigate(buildClassHomeRoute(activeClass?.id || ""))}>
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
    </div>
  );
};

export default EditClassPage;
