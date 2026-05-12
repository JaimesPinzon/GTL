import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  CheckCircle2,
  ClipboardCopy,
  DoorOpen,
  History,
  PlusSquare,
  School,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTradingContext } from "@/contexts/TradingContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

const summaryCardClass = "rounded-2xl border border-border/70 bg-background/50 p-4";

const badgeClassForState = (state) => {
  if (state === "active") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  if (state === "closed") return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  return "border-slate-500/20 bg-slate-500/10 text-slate-300";
};

const RoomsSettingsSection = () => {
  const { t } = useTranslation();
  const {
    user,
    rooms = [],
    activeRoom,
    activeRoomId,
    roomState,
    selectRoom,
    getRoomHistory,
    joinRoomWithCode,
    createRoomForUser,
    leaveCurrentUserRoom,
    updateManagedRoomState,
  } = useTradingContext();
  const { toast } = useToast();
  const [joinCode, setJoinCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [roomHistory, setRoomHistory] = useState([]);
  const [createForm, setCreateForm] = useState({ name: "", description: "" });

  const roleLabel = (role) => t(`settings.rooms.roleLabels.${role || "member"}`);
  const stateLabel = (state) => t(`settings.rooms.stateLabels.${state || "archived"}`);
  const formatRoomDate = (value) => {
    if (!value) return t("settings.rooms.labels.noDate");
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : t("settings.rooms.labels.noDate");
  };

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      if (!user?.id || !getRoomHistory) {
        setRoomHistory(roomState?.history || []);
        return;
      }

      setIsHistoryLoading(true);
      try {
        const nextHistory = await getRoomHistory();
        if (isMounted) setRoomHistory(nextHistory);
      } catch {
        if (isMounted) setRoomHistory(roomState?.history || []);
      } finally {
        if (isMounted) setIsHistoryLoading(false);
      }
    };

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, [getRoomHistory, roomState?.history, user?.id]);

  const ownedRooms = useMemo(
    () => rooms.filter((room) => room.createdBy === user?.id || room.membershipRole === "teacher"),
    [rooms, user?.id]
  );

  const historicalRooms = useMemo(() => {
    const currentIds = new Set(rooms.map((room) => room.id));
    return roomHistory.filter(
      (room) =>
        !currentIds.has(room.id) ||
        room.membershipState !== "active" ||
        room.state === "closed" ||
        room.state === "archived"
    );
  }, [roomHistory, rooms]);

  const handleCopy = async (value, successMessage) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: t("settings.rooms.toasts.copied"), description: successMessage });
    } catch {
      toast({
        title: t("settings.rooms.toasts.copyFailedTitle"),
        description: t("settings.rooms.toasts.copyFailedDescription"),
        variant: "destructive",
      });
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) {
      toast({
        title: t("settings.rooms.toasts.codeRequiredTitle"),
        description: t("settings.rooms.toasts.codeRequiredDescription"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const joinedRoom = await joinRoomWithCode(joinCode);
      setJoinCode("");
      toast({
        title: t("settings.rooms.toasts.joinedTitle"),
        description: t("settings.rooms.toasts.joinedDescription", { room: joinedRoom.name }),
      });
    } catch (error) {
      toast({
        title: t("settings.rooms.toasts.joinFailedTitle"),
        description: error instanceof Error ? error.message : t("settings.rooms.toasts.genericRetry"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!createForm.name.trim()) {
      toast({
        title: t("settings.rooms.toasts.nameRequiredTitle"),
        description: t("settings.rooms.toasts.nameRequiredDescription"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const newRoom = await createRoomForUser({
        name: createForm.name,
        description: createForm.description,
      });
      setCreateForm({ name: "", description: "" });
      toast({
        title: t("settings.rooms.toasts.createdTitle"),
        description: t("settings.rooms.toasts.createdDescription", {
          room: newRoom.name,
          code: newRoom.accessCode,
        }),
      });
    } catch (error) {
      toast({
        title: t("settings.rooms.toasts.createFailedTitle"),
        description: error instanceof Error ? error.message : t("settings.rooms.toasts.createFailedDescription"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeaveRoom = async (room) => {
    setIsSubmitting(true);
    try {
      await leaveCurrentUserRoom(room);
      toast({
        title: t("settings.rooms.toasts.leftTitle"),
        description: t("settings.rooms.toasts.leftDescription", { room: room.name }),
      });
    } catch (error) {
      toast({
        title: t("settings.rooms.toasts.leaveFailedTitle"),
        description: error instanceof Error ? error.message : t("settings.rooms.toasts.genericRetry"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoomStateChange = async (roomId, nextState) => {
    setIsSubmitting(true);
    try {
      await updateManagedRoomState(roomId, nextState);
      toast({
        title: t("settings.rooms.toasts.stateUpdatedTitle"),
        description: t("settings.rooms.toasts.stateUpdatedDescription", { state: stateLabel(nextState) }),
      });
    } catch (error) {
      toast({
        title: t("settings.rooms.toasts.stateFailedTitle"),
        description: error instanceof Error ? error.message : t("settings.rooms.toasts.genericRetry"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInviteStudents = async (room) => {
    const inviteMessage = `GTL - ${room.name} - ${room.accessCode}`;
    await handleCopy(inviteMessage, t("settings.rooms.toasts.inviteReady"));
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 xl:grid-cols-[1.05fr_1.95fr]">
      <Card className="glass-card overflow-hidden rounded-[28px] border-border/60">
        <CardHeader className="border-b border-border/50 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
          <CardTitle className="flex items-center gap-3 text-2xl">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <School className="h-6 w-6" />
            </span>
            {t("settings.rooms.title")}
          </CardTitle>
          <CardDescription>{t("settings.rooms.description")}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-6">
          <div className={summaryCardClass}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("settings.rooms.activeRoom")}</p>
            <p className="mt-2 text-sm font-medium text-foreground">{activeRoom?.name || t("settings.rooms.noActiveRoom")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeRoom?.accessCode
                ? t("settings.rooms.currentCode", { code: activeRoom.accessCode })
                : t("settings.rooms.selectRoomHint")}
            </p>
          </div>

          <div className={summaryCardClass}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("settings.rooms.membershipSummary")}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-2xl font-semibold text-foreground">{rooms.length}</p>
                <p className="text-xs text-muted-foreground">{t("settings.rooms.activeRooms")}</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{historicalRooms.length}</p>
                <p className="text-xs text-muted-foreground">{t("settings.rooms.historyRooms")}</p>
              </div>
            </div>
          </div>

          <div className={summaryCardClass}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("settings.rooms.mainRole")}</p>
            <p className="mt-2 text-sm font-medium text-foreground">{roleLabel(user?.role || "user")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {user?.role === "teacher" ? t("settings.rooms.teacherRoleDescription") : t("settings.rooms.studentRoleDescription")}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.rooms.quickActionsTitle")}</CardTitle>
            <CardDescription>{t("settings.rooms.quickActionsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-[28px] border border-border/60 bg-background/50 p-5">
              <div className="flex items-center gap-2">
                <DoorOpen className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("settings.rooms.joinTitle")}</p>
              </div>
              <Input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder={t("settings.rooms.joinPlaceholder")} className="h-11 rounded-2xl" />
              <Button className="w-full" onClick={handleJoinRoom} disabled={isSubmitting}>
                {isSubmitting ? t("settings.rooms.joinSubmitting") : t("settings.rooms.joinSubmit")}
              </Button>
            </div>

            {user?.role === "teacher" ? (
              <div className="space-y-4 rounded-[28px] border border-border/60 bg-background/50 p-5">
                <div className="flex items-center gap-2">
                  <PlusSquare className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">{t("settings.rooms.createTitle")}</p>
                </div>
                <Input value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} placeholder={t("settings.rooms.createNamePlaceholder")} className="h-11 rounded-2xl" />
                <Textarea value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} rows={4} placeholder={t("settings.rooms.createDescriptionPlaceholder")} className="rounded-2xl" />
                <Button className="w-full" onClick={handleCreateRoom} disabled={isSubmitting}>
                  {isSubmitting ? t("settings.rooms.createSubmitting") : t("settings.rooms.createSubmit")}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.rooms.roomsListTitle")}</CardTitle>
            <CardDescription>{t("settings.rooms.roomsListDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {rooms.length > 0 ? (
              rooms.map((room) => {
                const isOwnedByTeacher = room.createdBy === user?.id || room.membershipRole === "teacher";
                const canLeaveRoom = !isOwnedByTeacher;

                return (
                  <div key={room.id} className={`rounded-[28px] border p-5 transition ${activeRoomId === room.id ? "border-primary/35 bg-primary/5" : "border-border/70 bg-background/50"}`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-foreground">{room.name}</p>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${badgeClassForState(room.state)}`}>{stateLabel(room.state)}</span>
                          <span className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                            {roleLabel(room.membershipRole || "member")}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{room.description || t("settings.rooms.labels.noDescription")}</p>
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <span>{t("settings.rooms.labels.code")}: {room.accessCode || t("settings.rooms.labels.noCode")}</span>
                          <span>{t("settings.rooms.labels.joinedAt")}: {formatRoomDate(room.joinedAt || room.createdAt)}</span>
                          <span>{t("settings.rooms.labels.state")}: {stateLabel(room.state)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button variant={activeRoomId === room.id ? "default" : "outline"} onClick={() => selectRoom(room.id)}>
                          <ArrowRightLeft className="mr-2 h-4 w-4" />
                          {activeRoomId === room.id ? t("settings.rooms.activeBadge") : t("settings.rooms.enter")}
                        </Button>
                        <Button variant="outline" onClick={() => handleCopy(room.accessCode || "", t("settings.rooms.toasts.accessCopied"))}>
                          <ClipboardCopy className="mr-2 h-4 w-4" />
                          {t("settings.rooms.copyCode")}
                        </Button>
                        {isOwnedByTeacher ? (
                          <Button variant="outline" onClick={() => handleInviteStudents(room)}>
                            <Send className="mr-2 h-4 w-4" />
                            {t("settings.rooms.inviteStudents")}
                          </Button>
                        ) : null}
                        {canLeaveRoom ? (
                          <Button variant="outline" onClick={() => handleLeaveRoom(room)} disabled={isSubmitting}>
                            <DoorOpen className="mr-2 h-4 w-4" />
                            {t("settings.rooms.leaveRoom")}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {isOwnedByTeacher ? (
                      <div className="mt-4 rounded-2xl border border-border/60 bg-background/60 p-4">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-primary" />
                          <p className="text-sm font-semibold">{t("settings.rooms.manageOwnedRoom")}</p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {["active", "closed", "archived"].map((stateOption) => (
                            <Button key={stateOption} variant={room.state === stateOption ? "default" : "outline"} onClick={() => handleRoomStateChange(room.id, stateOption)} disabled={isSubmitting}>
                              {stateLabel(stateOption)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">{t("settings.rooms.noRooms")}</div>
            )}
          </CardContent>
        </Card>

        {user?.role === "teacher" ? (
          <Card className="glass-card rounded-[28px] border-border/60">
            <CardHeader>
              <CardTitle className="text-xl">{t("settings.rooms.teacherRoomsTitle")}</CardTitle>
              <CardDescription>{t("settings.rooms.teacherRoomsDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {ownedRooms.length > 0 ? (
                ownedRooms.map((room) => (
                  <div key={room.id} className="rounded-2xl border border-border/70 bg-background/50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-foreground">{room.name}</p>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${badgeClassForState(room.state)}`}>{stateLabel(room.state)}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("settings.rooms.labels.code")}: <span className="font-medium text-foreground">{room.accessCode}</span>
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => handleCopy(room.accessCode || "", t("settings.rooms.toasts.teacherAccessCopied"))}>
                        <ClipboardCopy className="mr-2 h-4 w-4" />
                        {t("settings.rooms.copyAccess")}
                      </Button>
                      <Button variant="outline" onClick={() => handleInviteStudents(room)}>
                        <Users className="mr-2 h-4 w-4" />
                        {t("settings.rooms.invite")}
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">{t("settings.rooms.noTeacherRooms")}</div>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.rooms.historyTitle")}</CardTitle>
            <CardDescription>{t("settings.rooms.historyDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isHistoryLoading ? (
              <div className="rounded-2xl border border-border/70 bg-background/50 p-5 text-sm text-muted-foreground">{t("settings.rooms.historyLoading")}</div>
            ) : historicalRooms.length > 0 ? (
              historicalRooms.map((room) => (
                <div key={`history-${room.id}`} className="rounded-2xl border border-border/70 bg-background/50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    <p className="font-medium text-foreground">{room.name}</p>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${badgeClassForState(room.state)}`}>{stateLabel(room.state)}</span>
                    <span className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{roleLabel(room.membershipRole || "member")}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{room.description || t("settings.rooms.labels.noDescription")}</p>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>{t("settings.rooms.labels.joinedAt")}: {formatRoomDate(room.joinedAt || room.createdAt)}</span>
                    <span>{t("settings.rooms.labels.lastChange")}: {formatRoomDate(room.leftAt || room.updatedAt)}</span>
                    <span>{t("settings.rooms.labels.membership")}: {room.membershipState || t("settings.rooms.labels.historical")}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">{t("settings.rooms.noHistory")}</div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card rounded-[28px] border-border/60">
          <CardHeader>
            <CardTitle className="text-xl">{t("settings.rooms.notesTitle")}</CardTitle>
            <CardDescription>{t("settings.rooms.notesDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className={summaryCardClass}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("settings.rooms.availableTitle")}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t("settings.rooms.availableDescription")}</p>
            </div>
            <div className={summaryCardClass}>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t("settings.rooms.teacherBaseTitle")}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{t("settings.rooms.teacherBaseDescription")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RoomsSettingsSection;
