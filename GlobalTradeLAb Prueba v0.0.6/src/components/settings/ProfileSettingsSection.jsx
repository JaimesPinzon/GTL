import React, { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  Camera,
  CreditCard,
  Globe,
  Mail,
  MapPin,
  PencilLine,
  Save,
  User,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Countries } from "@/components/Data/CountryData";
import { useTradingContext } from "@/contexts/TradingContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { formatDateTimeByLocale } from "@/lib/locale";

const createProfileForm = (user) => ({
  avatar: user?.avatar || "",
  alias: user?.alias || "",
  username: user?.username || "",
  name: user?.name || "",
  lastName: user?.lastName || "",
  dob: user?.dob || "",
  email: user?.email || "",
  phone: user?.phone || "",
  country: user?.country || "",
  region: user?.region || "",
  city: user?.city || "",
  address: user?.address || "",
  gender: user?.gender || "",
  bio: user?.bio || "",
  tradingExperience: user?.tradingExperience || "",
  documentId: user?.documentId || "",
});

const ProfileField = ({ label, icon: Icon, children, hint }) => (
  <div className="space-y-2 rounded-2xl border border-border/70 bg-background/50 p-4">
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      <span>{label}</span>
    </div>
    {children}
    {hint ? <p className="settings-context-help text-xs text-muted-foreground">{hint}</p> : null}
  </div>
);

const ReadonlyMeta = ({ label, value }) => (
  <div className="rounded-2xl border border-border/70 bg-background/50 p-4">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
    <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
  </div>
);

const ProfileSettingsSection = () => {
  const { t } = useTranslation();
  const { user, updateUser, allUsers = [], preferencesState } = useTradingContext();
  const { toast } = useToast();
  const genderOptions = useMemo(
    () => [
      { value: "", label: t("settings.profile.placeholders.gender") },
      { value: "female", label: t("settings.profile.genderOptions.female") },
      { value: "male", label: t("settings.profile.genderOptions.male") },
      { value: "nonBinary", label: t("settings.profile.genderOptions.nonBinary") },
      { value: "preferNotToSay", label: t("settings.profile.genderOptions.preferNotToSay") },
    ],
    [t]
  );
  const experienceOptions = useMemo(
    () => [
      { value: "", label: t("settings.profile.placeholders.tradingExperience") },
      { value: "beginner", label: t("settings.profile.experienceOptions.beginner") },
      { value: "intermediate", label: t("settings.profile.experienceOptions.intermediate") },
      { value: "advanced", label: t("settings.profile.experienceOptions.advanced") },
      { value: "professional", label: t("settings.profile.experienceOptions.professional") },
    ],
    [t]
  );
  const [form, setForm] = useState(() => createProfileForm(user));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || "");

  useEffect(() => {
    const nextForm = createProfileForm(user);
    setForm(nextForm);
    setAvatarPreview(nextForm.avatar || "");
    setIsEditing(false);
  }, [user]);

  const normalizedUsername = form.username.trim().toLowerCase();
  const usernameTaken = useMemo(() => {
    if (!normalizedUsername) {
      return false;
    }

    return allUsers.some((candidate) => {
      if (candidate.id === user?.id) {
        return false;
      }

      return (candidate.username || "").trim().toLowerCase() === normalizedUsername;
    });
  }, [allUsers, normalizedUsername, user?.id]);

  const canSave = Boolean(form.email.trim()) && Boolean(form.username.trim()) && !usernameTaken && !isSaving;
  const avatarSource =
    avatarPreview ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      form.name || form.alias || form.email || t("settings.profile.emptyProfile")
    )}&background=0f172a&color=ffffff`;

  const handleFieldChange = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: t("settings.profile.toasts.largeImageTitle"),
        description: t("settings.profile.toasts.largeImageDescription"),
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setAvatarPreview(result);
      handleFieldChange("avatar", result);
    };
    reader.readAsDataURL(file);
  };

  const handleCancel = () => {
    const nextForm = createProfileForm(user);
    setForm(nextForm);
    setAvatarPreview(nextForm.avatar || "");
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!form.username.trim()) {
      toast({
        title: t("settings.profile.toasts.usernameRequiredTitle"),
        description: t("settings.profile.toasts.usernameRequiredDescription"),
        variant: "destructive",
      });
      return;
    }

    if (usernameTaken) {
      toast({
        title: t("settings.profile.toasts.usernameUnavailableTitle"),
        description: t("settings.profile.toasts.usernameUnavailableDescription"),
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      await updateUser({
        avatar: form.avatar,
        alias: form.alias.trim(),
        username: form.username.trim(),
        name: form.name.trim(),
        lastName: form.lastName.trim(),
        dob: form.dob,
        email: form.email.trim(),
        phone: form.phone.trim(),
        country: form.country,
        region: form.region.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
        gender: form.gender,
        bio: form.bio.trim(),
        tradingExperience: form.tradingExperience,
        documentId: form.documentId.trim(),
      });

      setIsEditing(false);
      toast({
        title: t("settings.profile.toasts.saveSuccessTitle"),
        description: t("settings.profile.toasts.saveSuccessDescription"),
      });
    } catch (error) {
      console.error(error);
      toast({
        title: t("settings.profile.toasts.saveErrorTitle"),
        description: t("settings.profile.toasts.saveErrorDescription"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 xl:grid-cols-[1.1fr_1.9fr]">
      <Card className="glass-card overflow-hidden rounded-[28px] border-border/60">
        <CardHeader className="border-b border-border/50 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <User className="h-6 w-6" />
            </span>
            {t("settings.profile.title")}
          </CardTitle>
          <CardDescription className="settings-context-help">{t("settings.profile.description")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="rounded-[28px] border border-border/60 bg-background/60 p-5">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="relative">
                <img
                  src={avatarSource}
                  alt={t("settings.profile.avatarPreviewLabel")}
                  className="h-28 w-28 rounded-[26px] object-cover ring-4 ring-primary/10"
                />
                <span className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background shadow-sm">
                  <Camera className="h-4 w-4 text-primary" />
                </span>
              </div>

              <div className="space-y-1">
                <p className="text-lg font-semibold">
                  {form.name || form.alias || t("settings.profile.emptyProfile")}
                </p>
                <p className="text-sm text-muted-foreground">
                  @{form.username || t("settings.profile.defaultUsername")}
                </p>
                <p className="text-xs text-muted-foreground">{form.email || t("settings.profile.noEmail")}</p>
              </div>

              {user?.verified ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500">
                  <BadgeCheck className="h-4 w-4" />
                  {t("settings.profile.verified")}
                </div>
              ) : null}
            </div>

            <div className="mt-5 space-y-3">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {t("settings.profile.avatarPreviewLabel")}
                </span>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  disabled={!isEditing}
                  className="cursor-pointer"
                />
              </label>
              <p className="settings-context-help text-xs text-muted-foreground">{t("settings.profile.avatarHelp")}</p>
            </div>
          </div>

          <div className="grid gap-3">
            <ReadonlyMeta label={t("common.labels.userId")} value={user?.id || t("common.states.noRecord")} />
            <ReadonlyMeta
              label={t("common.labels.registrationDate")}
              value={formatDateTimeByLocale(user?.createdAt, preferencesState)}
            />
            <ReadonlyMeta
              label={t("common.labels.lastLogin")}
              value={formatDateTimeByLocale(user?.lastLoginAt || user?.updatedAt, preferencesState)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card rounded-[28px] border-border/60">
        <CardHeader className="border-b border-border/50">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl">{t("settings.profile.infoTitle")}</CardTitle>
              <CardDescription className="settings-context-help">{t("settings.profile.infoDescription")}</CardDescription>
            </div>

            <div className="flex flex-wrap gap-3">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)}>
                  <PencilLine className="mr-2 h-4 w-4" />
                  {t("settings.profile.editAction")}
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={handleCancel}>
                    <X className="mr-2 h-4 w-4" />
                    {t("common.actions.cancel")}
                  </Button>
                  <Button onClick={handleSave} disabled={!canSave}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? t("settings.profile.saving") : t("settings.profile.saveAction")}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-8 pt-6">
          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{t("settings.profile.identityTitle")}</h3>
              <p className="settings-context-help text-sm text-muted-foreground">{t("settings.profile.identityDescription")}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ProfileField label={t("settings.profile.labels.alias")} icon={User}>
                <Input value={form.alias} onChange={(event) => handleFieldChange("alias", event.target.value)} disabled={!isEditing} placeholder={t("settings.profile.placeholders.alias")} />
              </ProfileField>

              <ProfileField
                label={t("settings.profile.labels.username")}
                icon={User}
                hint={usernameTaken ? t("settings.profile.hints.usernameTaken") : t("settings.profile.hints.usernameAvailable")}
              >
                <Input
                  value={form.username}
                  onChange={(event) => handleFieldChange("username", event.target.value)}
                  disabled={!isEditing}
                  placeholder={t("settings.profile.placeholders.username")}
                  className={usernameTaken ? "border-destructive focus-visible:ring-destructive" : ""}
                />
              </ProfileField>

              <ProfileField label={t("settings.profile.labels.firstName")} icon={User}>
                <Input value={form.name} onChange={(event) => handleFieldChange("name", event.target.value)} disabled={!isEditing} placeholder={t("settings.profile.placeholders.firstName")} />
              </ProfileField>

              <ProfileField label={t("settings.profile.labels.lastName")} icon={User}>
                <Input value={form.lastName} onChange={(event) => handleFieldChange("lastName", event.target.value)} disabled={!isEditing} placeholder={t("settings.profile.placeholders.lastName")} />
              </ProfileField>

              <ProfileField label={t("settings.profile.labels.birthDate")} icon={CalendarDays}>
                <Input type="date" value={form.dob} onChange={(event) => handleFieldChange("dob", event.target.value)} disabled={!isEditing} />
              </ProfileField>

              <ProfileField label={t("settings.profile.labels.gender")} icon={User}>
                <select
                  value={form.gender}
                  onChange={(event) => handleFieldChange("gender", event.target.value)}
                  disabled={!isEditing}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {genderOptions.map((option) => (
                    <option key={option.value || "empty"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </ProfileField>

              <ProfileField label={t("common.labels.email")} icon={Mail}>
                <Input type="email" value={form.email} onChange={(event) => handleFieldChange("email", event.target.value)} disabled={!isEditing} placeholder={t("settings.profile.placeholders.email")} />
              </ProfileField>

              <ProfileField label={t("settings.profile.labels.phone")} icon={Mail}>
                <Input value={form.phone} onChange={(event) => handleFieldChange("phone", event.target.value)} disabled={!isEditing} placeholder={t("settings.profile.placeholders.phone")} />
              </ProfileField>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{t("settings.profile.locationTitle")}</h3>
              <p className="settings-context-help text-sm text-muted-foreground">{t("settings.profile.locationDescription")}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ProfileField label={t("settings.profile.labels.country")} icon={Globe}>
                <select
                  value={form.country}
                  onChange={(event) => handleFieldChange("country", event.target.value)}
                  disabled={!isEditing}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">{t("settings.profile.placeholders.country")}</option>
                  {Countries.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </ProfileField>

              <ProfileField label={t("settings.profile.labels.city")} icon={MapPin}>
                <Input value={form.city} onChange={(event) => handleFieldChange("city", event.target.value)} disabled={!isEditing} placeholder={t("settings.profile.placeholders.city")} />
              </ProfileField>

              <ProfileField label={t("settings.profile.labels.region")} icon={MapPin}>
                <Input value={form.region} onChange={(event) => handleFieldChange("region", event.target.value)} disabled={!isEditing} placeholder={t("settings.profile.placeholders.region")} />
              </ProfileField>

              <ProfileField label={t("settings.profile.labels.address")} icon={MapPin}>
                <Input value={form.address} onChange={(event) => handleFieldChange("address", event.target.value)} disabled={!isEditing} placeholder={t("settings.profile.placeholders.address")} />
              </ProfileField>

              <div className="md:col-span-2">
                <ProfileField label={t("settings.profile.labels.bio")} icon={User} hint={t("settings.profile.hints.bio")}>
                  <Textarea value={form.bio} onChange={(event) => handleFieldChange("bio", event.target.value)} disabled={!isEditing} placeholder={t("settings.profile.placeholders.bio")} className="min-h-[120px]" />
                </ProfileField>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{t("settings.profile.tradingTitle")}</h3>
              <p className="settings-context-help text-sm text-muted-foreground">{t("settings.profile.tradingDescription")}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ProfileField label={t("settings.profile.labels.tradingExperience")} icon={Globe}>
                <select
                  value={form.tradingExperience}
                  onChange={(event) => handleFieldChange("tradingExperience", event.target.value)}
                  disabled={!isEditing}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {experienceOptions.map((option) => (
                    <option key={option.value || "empty"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </ProfileField>

              <ProfileField label={t("settings.profile.labels.documentId")} icon={CreditCard} hint={t("settings.profile.hints.documentId")}>
                <Input value={form.documentId} onChange={(event) => handleFieldChange("documentId", event.target.value)} disabled={!isEditing} placeholder={t("settings.profile.placeholders.documentId")} />
              </ProfileField>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileSettingsSection;

