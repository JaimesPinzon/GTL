import React, { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BookOpen,
  Building2,
  GraduationCap,
  History,
  Layers3,
  Medal,
  Save,
  School,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTradingContext } from "@/contexts/TradingContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

const createAccountForm = (user) => ({
  institution: user?.institution || "",
  studentCode: user?.studentCode || "",
  academicProgram: user?.academicProgram || "",
  semesterLevel: user?.semesterLevel || "",
  mainTeacher: user?.mainTeacher || "",
});

const InfoCard = ({ icon: Icon, label, value, hint }) => (
  <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      <span>{label}</span>
    </div>
    <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
    {hint ? <p className="settings-context-help mt-1 text-xs text-muted-foreground">{hint}</p> : null}
  </div>
);

const AccountSettingsSection = () => {
  const { t } = useTranslation();
  const { user, rooms = [], activeRoom, updateUser } = useTradingContext();
  const { toast } = useToast();

  const roleLabels = useMemo(
    () => ({
      student: t("auth.register.role.student"),
      teacher: t("auth.register.role.teacher"),
      admin: t("accountSettings.roles.admin"),
      member: t("accountSettings.roles.member"),
      user: t("accountSettings.roles.user"),
    }),
    [t]
  );

  const [form, setForm] = useState(() => createAccountForm(user));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm(createAccountForm(user));
    setIsEditing(false);
  }, [user]);

  const enrolledRooms = useMemo(() => rooms.filter(Boolean), [rooms]);
  const roomHistory = useMemo(() => rooms.filter((room) => room.id !== activeRoom?.id), [rooms, activeRoom?.id]);

  const certificates = useMemo(() => {
    const role = roleLabels[user?.role] || roleLabels.member;
    const items = [
      t("accountSettings.certificates.activeRole", { role }),
      user?.verified ? t("accountSettings.certificates.verified") : t("accountSettings.certificates.pendingVerification"),
    ];

    if ((user?.transactions || []).length >= 1) {
      items.push(t("accountSettings.certificates.firstActivity"));
    }

    return items;
  }, [roleLabels, t, user?.role, user?.verified, user?.transactions]);

  const activitySummary = useMemo(
    () => ({
      rooms: enrolledRooms.length,
      positions: (user?.positions || []).length,
      transactions: (user?.transactions || []).length,
    }),
    [enrolledRooms.length, user?.positions, user?.transactions]
  );

  const handleField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleCancel = () => {
    setForm(createAccountForm(user));
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      await updateUser({
        institution: form.institution.trim(),
        studentCode: form.studentCode.trim(),
        academicProgram: form.academicProgram.trim(),
        semesterLevel: form.semesterLevel.trim(),
        mainTeacher: form.mainTeacher.trim(),
      });

      setIsEditing(false);
      toast({
        title: t("accountSettings.toasts.savedTitle"),
        description: t("accountSettings.toasts.savedDescription"),
      });
    } catch (error) {
      console.error(error);
      toast({
        title: t("accountSettings.toasts.errorTitle"),
        description: t("accountSettings.toasts.errorDescription"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 xl:grid-cols-[1.05fr_1.95fr]">
      <Card className="glass-card overflow-hidden rounded-[28px] border-border/60">
        <CardHeader className="border-b border-border/50 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <School className="h-6 w-6" />
            </span>
            {t("accountSettings.pageTitle")}
          </CardTitle>
          <CardDescription className="settings-context-help">{t("accountSettings.pageDescription")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          <InfoCard icon={UserCog} label={t("accountSettings.labels.currentRole")} value={roleLabels[user?.role] || roleLabels.user} />
          <InfoCard
            icon={Users}
            label={t("accountSettings.labels.activeRoom")}
            value={activeRoom?.name || t("accountSettings.values.noActiveRoom")}
            hint={activeRoom?.accessCode ? t("accountSettings.hints.activeRoomCode", { code: activeRoom.accessCode }) : t("accountSettings.hints.noSelectedRoom")}
          />
          <InfoCard
            icon={Layers3}
            label={t("accountSettings.labels.enrolledRooms")}
            value={t("accountSettings.values.roomCount", { count: enrolledRooms.length })}
          />
          <InfoCard
            icon={BookOpen}
            label={t("accountSettings.labels.activity")}
            value={t("accountSettings.values.activitySummary", { transactions: activitySummary.transactions, positions: activitySummary.positions })}
            hint={t("accountSettings.hints.activitySummary")}
          />
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader className="border-b border-border/50">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <CardTitle className="text-2xl">{t("accountSettings.sections.institutional.title")}</CardTitle>
                <CardDescription className="settings-context-help">{t("accountSettings.sections.institutional.description")}</CardDescription>
              </div>

              <div className="flex flex-wrap gap-3">
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)}>{t("common.actions.edit")}</Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={handleCancel}>
                      <X className="mr-2 h-4 w-4" />
                      {t("common.actions.cancel")}
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                      <Save className="mr-2 h-4 w-4" />
                      {isSaving ? t("classes.common.saving") : t("settings.profile.saveAction")}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
            <InfoCard
              icon={Building2}
              label={t("accountSettings.labels.institution")}
              value={
                isEditing ? (
                  <Input value={form.institution} onChange={(event) => handleField("institution", event.target.value)} placeholder={t("accountSettings.labels.institution")} />
                ) : (
                  form.institution || t("accountSettings.values.noInstitution")
                )
              }
            />
            <InfoCard
              icon={BadgeCheck}
              label={t("accountSettings.labels.studentCode")}
              value={
                isEditing ? (
                  <Input value={form.studentCode} onChange={(event) => handleField("studentCode", event.target.value)} placeholder={t("accountSettings.labels.studentCode")} />
                ) : (
                  form.studentCode || t("accountSettings.values.noStudentCode")
                )
              }
            />
            <InfoCard
              icon={GraduationCap}
              label={t("accountSettings.labels.program")}
              value={
                isEditing ? (
                  <Input value={form.academicProgram} onChange={(event) => handleField("academicProgram", event.target.value)} placeholder={t("accountSettings.labels.program")} />
                ) : (
                  form.academicProgram || t("accountSettings.values.noProgram")
                )
              }
            />
            <InfoCard
              icon={Layers3}
              label={t("accountSettings.labels.level")}
              value={
                isEditing ? (
                  <Input value={form.semesterLevel} onChange={(event) => handleField("semesterLevel", event.target.value)} placeholder={t("accountSettings.labels.level")} />
                ) : (
                  form.semesterLevel || t("accountSettings.values.noLevel")
                )
              }
            />
            <InfoCard
              icon={Users}
              label={t("accountSettings.labels.mainTeacher")}
              value={
                isEditing ? (
                  <Input value={form.mainTeacher} onChange={(event) => handleField("mainTeacher", event.target.value)} placeholder={t("accountSettings.labels.mainTeacher")} />
                ) : (
                  form.mainTeacher || t("accountSettings.values.unassigned")
                )
              }
              hint={t("accountSettings.hints.mainTeacher")}
            />
            <InfoCard
              icon={UserCog}
              label={t("accountSettings.labels.systemRole")}
              value={roleLabels[user?.role] || roleLabels.user}
              hint={t("accountSettings.hints.systemRole")}
            />
          </CardContent>
        </Card>

        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("accountSettings.sections.rooms.title")}</CardTitle>
            <CardDescription className="settings-context-help">{t("accountSettings.sections.rooms.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("accountSettings.labels.enrolledRooms")}</p>
              </div>
              {enrolledRooms.length > 0 ? (
                enrolledRooms.map((room) => (
                  <div key={room.id} className="rounded-2xl border border-border/70 bg-background/50 p-4">
                    <p className="text-sm font-semibold">{room.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {room.membershipRole === "teacher" ? roleLabels.teacher : roleLabels.student} | {room.state}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  {t("accountSettings.values.noRooms")}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("accountSettings.labels.roomHistory")}</p>
              </div>
              {roomHistory.length > 0 ? (
                roomHistory.map((room) => (
                  <div key={room.id} className="rounded-2xl border border-border/70 bg-background/50 p-4">
                    <p className="text-sm font-semibold">{room.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {room.membershipRole === "teacher" ? roleLabels.teacher : roleLabels.student} | {room.state}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  {t("accountSettings.values.emptyRoomHistory")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("accountSettings.sections.progress.title")}</CardTitle>
            <CardDescription className="settings-context-help">{t("accountSettings.sections.progress.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <InfoCard icon={Medal} label={t("accountSettings.labels.certificates")} value={certificates.join(" | ")} />
            <InfoCard
              icon={BookOpen}
              label={t("accountSettings.labels.progress")}
              value={t("accountSettings.values.progressSummary", { rooms: activitySummary.rooms, transactions: activitySummary.transactions, positions: activitySummary.positions })}
              hint={t("accountSettings.hints.progressSummary")}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AccountSettingsSection;

