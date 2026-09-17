import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Users, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useTradingContext } from "@/contexts/TradingContext";
import { useClassContext } from "@/features/classes/context/ClassContext";
import {
  autoAssignRoomGroups,
  createRoomGroup,
  fetchRoomGroups,
  provisionRoomGroupPortfolios,
  upsertRoomGroupMember,
} from "@/lib/trading-db";

const ClassGroupsDialog = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { activeClass } = useClassContext() || {};
  const { roomMembers } = useTradingContext();
  const [payload, setPayload] = useState({ groups: [], isStaff: false });
  const [form, setForm] = useState({ name: "", description: "", maxMembers: "" });
  const [selectedByGroup, setSelectedByGroup] = useState({});
  const [busyAction, setBusyAction] = useState("");

  const students = useMemo(
    () => roomMembers.filter((member) => member.roleInRoom === "student"),
    [roomMembers]
  );

  const activeGroupByUserId = useMemo(() => {
    const lookup = {};
    payload.groups.forEach((group) => {
      (group.members || []).forEach((member) => {
        if (String(member.state).toLowerCase() === "active") lookup[member.user_id] = group.id;
      });
    });
    return lookup;
  }, [payload.groups]);

  const loadGroups = useCallback(async () => {
    if (!activeClass?.id) return;
    setBusyAction("loading");
    try {
      const result = await fetchRoomGroups(activeClass.id);
      setPayload({
        groups: Array.isArray(result?.groups) ? result.groups : [],
        isStaff: Boolean(result?.isStaff),
      });
    } catch (error) {
      toast({ title: t("classes.workspace.groups.loadError"), description: error.message, variant: "destructive" });
    } finally {
      setBusyAction("");
    }
  }, [activeClass?.id, t, toast]);

  useEffect(() => {
    if (open) void loadGroups();
  }, [loadGroups, open]);

  const runAction = async (key, action, successTitle) => {
    setBusyAction(key);
    try {
      await action();
      toast({ title: successTitle });
      await loadGroups();
    } catch (error) {
      toast({ title: t("classes.workspace.groups.actionError"), description: error.message, variant: "destructive" });
    } finally {
      setBusyAction("");
    }
  };

  const createGroup = () => {
    const name = form.name.trim();
    if (!name) {
      toast({ title: t("classes.workspace.groups.nameRequired"), variant: "destructive" });
      return;
    }

    void runAction(
      "create",
      async () => {
        await createRoomGroup({
          roomId: activeClass.id,
          name,
          description: form.description.trim(),
          maxMembers: form.maxMembers ? Number.parseInt(form.maxMembers, 10) : null,
        });
        setForm({ name: "", description: "", maxMembers: "" });
      },
      t("classes.workspace.groups.created")
    );
  };

  const assignStudent = (groupId) => {
    const userId = selectedByGroup[groupId];
    if (!userId) return;
    const previousGroupId = activeGroupByUserId[userId];

    void runAction(
      `assign:${groupId}`,
      async () => {
        if (previousGroupId && previousGroupId !== groupId) {
          await upsertRoomGroupMember({ roomId: activeClass.id, groupId: previousGroupId, userId, state: "removed", role: "member" });
        }
        await upsertRoomGroupMember({ roomId: activeClass.id, groupId, userId, state: "active", role: "member" });
        setSelectedByGroup((current) => ({ ...current, [groupId]: "" }));
      },
      t("classes.workspace.groups.studentAssigned")
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 px-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#101825] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)] md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t("classes.workspace.groups.eyebrow")}</p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-white">
              <Users className="h-6 w-6 text-primary" /> {t("classes.workspace.groups.title")}
            </h2>
            <p className="mt-2 text-sm text-slate-400">{t("classes.workspace.groups.description")}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("common.actions.close")}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
            <h3 className="font-semibold text-white">{t("classes.workspace.groups.newGroup")}</h3>
            <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder={t("classes.workspace.groups.namePlaceholder")} />
            <Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder={t("classes.workspace.groups.descriptionPlaceholder")} />
            <Input type="number" min="1" value={form.maxMembers} onChange={(event) => setForm((current) => ({ ...current, maxMembers: event.target.value }))} placeholder={t("classes.workspace.groups.maxMembersPlaceholder")} />
            <Button className="w-full" onClick={createGroup} disabled={Boolean(busyAction)}>
              {busyAction === "create" ? t("classes.workspace.groups.creating") : t("classes.workspace.groups.create")}
            </Button>
            <div className="border-t border-white/8 pt-3">
              <Button
                variant="outline"
                className="w-full"
                disabled={Boolean(busyAction) || payload.groups.length === 0}
                onClick={() => void runAction("auto", () => autoAssignRoomGroups({ roomId: activeClass.id }), t("classes.workspace.groups.autoAssigned"))}
              >
                {busyAction === "auto" ? t("classes.workspace.groups.assigning") : t("classes.workspace.groups.autoAssign")}
              </Button>
              <Button
                variant="outline"
                className="mt-2 w-full"
                disabled={Boolean(busyAction) || payload.groups.length === 0}
                onClick={() => void runAction("portfolios", () => provisionRoomGroupPortfolios({ roomId: activeClass.id, replaceExisting: true }), t("classes.workspace.groups.portfoliosReady"))}
              >
                {busyAction === "portfolios" ? t("classes.workspace.groups.preparing") : t("classes.workspace.groups.createPortfolios")}
              </Button>
            </div>
          </aside>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">{t("classes.workspace.groups.classGroups")}</h3>
              <Button variant="ghost" size="sm" onClick={() => void loadGroups()} disabled={Boolean(busyAction)}>{t("classes.workspace.groups.refresh")}</Button>
            </div>
            {payload.groups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                {t("classes.workspace.groups.empty")}
              </div>
            ) : (
              payload.groups.map((group) => {
                const members = (group.members || []).filter((member) => String(member.state).toLowerCase() === "active");
                return (
                  <article key={group.id} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-white">{group.name}</h4>
                        <p className="mt-1 text-xs text-slate-500">{t("classes.workspace.groups.memberCount", { count: members.length, maximum: group.max_members ? ` / ${group.max_members}` : "" })}</p>
                      </div>
                      {payload.isStaff ? (
                        <div className="flex min-w-[280px] flex-1 gap-2 sm:max-w-md">
                          <select
                            value={selectedByGroup[group.id] || ""}
                            onChange={(event) => setSelectedByGroup((current) => ({ ...current, [group.id]: event.target.value }))}
                            className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0b1220] px-3 text-sm text-slate-100"
                          >
                            <option value="">{t("classes.workspace.groups.selectStudent")}</option>
                            {students.map((student) => (
                              <option key={student.userId} value={student.userId}>
                                {student.profile?.name || student.profile?.email || student.userId}
                                {activeGroupByUserId[student.userId] === group.id ? " (en este grupo)" : ""}
                              </option>
                            ))}
                          </select>
                          <Button variant="outline" size="sm" onClick={() => assignStudent(group.id)} disabled={!selectedByGroup[group.id] || Boolean(busyAction)}>{t("classes.workspace.groups.assign")}</Button>
                        </div>
                      ) : null}
                    </div>
                    {group.description ? <p className="mt-3 text-sm text-slate-400">{group.description}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {members.length ? members.map((member) => (
                        <span key={member.id} className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.035] px-3 py-1.5 text-xs text-slate-300">
                          {member.profile?.name || member.profile?.email || member.user_id}
                          {payload.isStaff ? (
                            <button
                              type="button"
                              className="text-slate-500 hover:text-rose-300"
                              aria-label={t("classes.workspace.groups.remove")}
                              onClick={() => void runAction(`remove:${member.id}`, () => upsertRoomGroupMember({ roomId: activeClass.id, groupId: group.id, userId: member.user_id, state: "removed", role: "member" }), t("classes.workspace.groups.memberRemoved"))}
                            >
                              ×
                            </button>
                          ) : null}
                        </span>
                      )) : <span className="text-xs text-slate-500">{t("classes.workspace.groups.noMembers")}</span>}
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default ClassGroupsDialog;
