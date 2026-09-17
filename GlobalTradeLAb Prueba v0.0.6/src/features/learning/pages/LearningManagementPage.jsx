import React, { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, Eye, FilePlus2, GitBranch, Layers3, MoreHorizontal, Plus, Route, Save, Send, Users, X } from "lucide-react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useLearning } from "@/features/learning/context/LearningContext";
import { MetricCard, SectionHeading } from "@/features/learning/components/LearningUi";
import { fetchLearningManagement, uploadLearningResource } from "@/lib/learning-api";

const LearningManagementPage = () => {
  const { copy, catalog, canManage } = useOutletContext();
  const { editorId } = useParams();
  const { state, saveDraft } = useLearning();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [remoteManagement, setRemoteManagement] = useState(null);

  useEffect(() => {
    if (!canManage || editorId) return undefined;
    let active = true;
    fetchLearningManagement().then((payload) => {
      if (active) setRemoteManagement(payload);
    }).catch(() => {});
    return () => { active = false; };
  }, [canManage, editorId]);

  if (!canManage) return <div className="rounded-[24px] border border-amber-500/25 bg-amber-500/10 p-7 text-sm text-amber-600">{copy.management.restricted}</div>;

  if (editorId) return <LessonEditor copy={copy} catalog={catalog} draft={state.drafts[editorId]} editorId={editorId} saveDraft={saveDraft} />;

  const lessonCount = catalog.courses.reduce((sum, course) => sum + course.modules.reduce((moduleSum, module) => moduleSum + module.lessons.length, 0), 0);
  const stats = remoteManagement?.stats;
  const rows = [
    ...catalog.courses.slice(0, 5).map((course, index) => ({ id: course.id, title: course.title, type: copy.types.course, category: catalog.categories.find((item) => item.id === course.category)?.label, status: index === 3 ? copy.management.review : copy.management.published, author: copy.common.official, updated: index < 2 ? copy.management.today : copy.management.yesterday })),
    { id: "draft-risk", title: catalog.courses.find((course) => course.id === "risk-management")?.shortTitle, type: copy.types.lesson, category: catalog.categories.find((item) => item.id === "risk")?.label, status: copy.management.draft, author: copy.common.official, updated: copy.management.today },
  ];

  const createOptions = [
    { id: "course", label: copy.types.course, icon: BookOpen },
    { id: "module", label: copy.common.module, icon: Layers3 },
    { id: "lesson", label: copy.types.lesson, icon: FilePlus2 },
    { id: "path", label: copy.management.route, icon: Route },
    { id: "assessment", label: copy.types.assessment, icon: GitBranch },
    { id: "resource", label: copy.management.resource, icon: Save },
  ];

  return (
    <div className="pb-10">
      <SectionHeading eyebrow={copy.management.eyebrow} title={copy.management.title} description={copy.management.description} action={<Button type="button" className="rounded-xl" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />{copy.management.createContent}</Button>} />
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><MetricCard label={copy.management.publishedCourses} value={stats?.publishedCourses ?? catalog.courses.length} icon={<BookOpen className="h-4 w-4" />} /><MetricCard label={copy.management.drafts} value={stats?.drafts ?? Object.keys(state.drafts).length} icon={<FilePlus2 className="h-4 w-4" />} /><MetricCard label={copy.management.paths} value={stats?.paths ?? catalog.paths.length} icon={<Route className="h-4 w-4" />} /><MetricCard label={copy.management.lessons} value={stats?.lessons ?? lessonCount} icon={<Layers3 className="h-4 w-4" />} /><MetricCard label={copy.management.learners} value={stats?.learners ?? 0} icon={<Users className="h-4 w-4" />} /></div>
      <section className="mt-10"><div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-2xl font-semibold">{copy.management.contentPanel}</h2><div className="flex gap-2"><Button type="button" variant="outline" className="rounded-xl" onClick={() => navigate("/app/learn/manage/editor/new-course")}>{copy.management.createCourse}</Button><Button type="button" variant="outline" className="rounded-xl" onClick={() => navigate("/app/learn/manage/editor/new-path")}>{copy.management.createPath}</Button></div></div><div className="mt-5 overflow-x-auto rounded-[22px] border border-border/70 bg-card/35"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-b border-border/70 bg-muted/35 text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-5 py-4 font-semibold">{copy.management.content}</th><th className="px-5 py-4 font-semibold">{copy.management.type}</th><th className="px-5 py-4 font-semibold">{copy.management.category}</th><th className="px-5 py-4 font-semibold">{copy.management.status}</th><th className="px-5 py-4 font-semibold">{copy.management.author}</th><th className="px-5 py-4 font-semibold">{copy.management.updated}</th><th className="px-5 py-4 font-semibold">{copy.management.actions}</th></tr></thead><tbody className="divide-y divide-border/60">{rows.map((row) => <tr key={row.id} className="transition hover:bg-primary/5"><td className="px-5 py-4 font-medium">{row.title}</td><td className="px-5 py-4 text-muted-foreground">{row.type}</td><td className="px-5 py-4 text-muted-foreground">{row.category}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === copy.management.published ? "bg-emerald-500/10 text-emerald-500" : row.status === copy.management.review ? "bg-amber-500/10 text-amber-500" : "bg-muted text-muted-foreground"}`}>{row.status}</span></td><td className="px-5 py-4 text-muted-foreground">{row.author}</td><td className="px-5 py-4 text-muted-foreground">{row.updated}</td><td className="px-5 py-4"><Button asChild variant="ghost" size="icon"><Link to={`/app/learn/manage/editor/${row.id}`} aria-label={copy.actions.edit} title={copy.actions.edit}><MoreHorizontal className="h-4 w-4" /></Link></Button></td></tr>)}</tbody></table></div></section>

      {createOpen ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true"><div className="w-full max-w-xl rounded-[26px] border border-border bg-card p-6 shadow-2xl"><div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold">{copy.management.whatCreate}</h2><Button type="button" variant="ghost" size="icon" onClick={() => setCreateOpen(false)} aria-label={copy.actions.close}><X className="h-4 w-4" /></Button></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{createOptions.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => navigate(`/app/learn/manage/editor/new-${id}`)} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/50 p-4 text-left text-sm font-medium transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"><span className="rounded-xl bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></span>{label}</button>)}</div></div></div> : null}
    </div>
  );
};

const LessonEditor = ({ copy, catalog, draft, editorId, saveDraft }) => {
  const [form, setForm] = useState(() => draft || { title: "", description: "", category: "technical", level: "beginner", duration: 20, blocks: [{ id: "block-1", type: "text", content: "" }] });
  const [saveStatus, setSaveStatus] = useState(copy.management.savedNow);
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInputRef = useRef(null);
  const blockOptions = Object.entries(copy.management.blocks);

  useEffect(() => {
    setSaveStatus(copy.management.autoSaving);
    const timer = window.setTimeout(() => { saveDraft(editorId, form); setSaveStatus(copy.management.savedNow); }, 650);
    return () => window.clearTimeout(timer);
  }, [copy.management.autoSaving, copy.management.savedNow, editorId, form, saveDraft]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const updateBlock = (id, content) => update("blocks", form.blocks.map((block) => block.id === id ? { ...block, content } : block));
  const moveBlock = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= form.blocks.length) return;
    const blocks = [...form.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    update("blocks", blocks);
  };
  const addBlock = (type) => { update("blocks", [...form.blocks, { id: `block-${Date.now()}`, type, content: "" }]); setBlockMenuOpen(false); };
  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadStatus(copy.management.uploading);
    try {
      await uploadLearningResource(file);
      setUploadStatus(copy.management.uploadSuccess);
    } catch {
      setUploadStatus(copy.management.uploadError);
    } finally {
      event.target.value = "";
    }
  };
  const inputClass = "mt-2 h-11 w-full rounded-xl border border-border/80 bg-background px-3 text-sm outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10";

  return (
    <div className="pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4"><Button asChild variant="ghost" className="-ml-3"><Link to="/app/learn/manage"><ArrowLeft className="mr-2 h-4 w-4" />{copy.actions.back}</Link></Button><div className="flex flex-wrap items-center gap-2"><span className="mr-2 text-xs text-muted-foreground">{saveStatus}</span><Button type="button" variant="outline" className="rounded-xl"><Save className="mr-2 h-4 w-4" />{copy.actions.saveDraft}</Button><Button type="button" variant="outline" className="rounded-xl"><Eye className="mr-2 h-4 w-4" />{copy.actions.preview}</Button><Button type="button" className="rounded-xl"><Send className="mr-2 h-4 w-4" />{copy.actions.publish}</Button></div></div>
      <SectionHeading className="mt-7" eyebrow={copy.management.eyebrow} title={copy.management.editorTitle} />
      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-[24px] border border-border/70 bg-card/35 p-5 md:p-7"><label className="block text-sm font-medium">{copy.management.lessonTitle}<input className={inputClass} value={form.title} onChange={(event) => update("title", event.target.value)} /></label><label className="mt-5 block text-sm font-medium">{copy.management.lessonDescription}<textarea className="mt-2 min-h-28 w-full rounded-xl border border-border/80 bg-background p-3 text-sm outline-none transition focus:border-primary/60 focus:ring-4 focus:ring-primary/10" value={form.description} onChange={(event) => update("description", event.target.value)} /></label><div className="mt-7 flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">{copy.management.contentBlocks}</h2><div className="relative"><Button type="button" variant="outline" className="rounded-xl" onClick={() => setBlockMenuOpen((value) => !value)}><Plus className="mr-2 h-4 w-4" />{copy.management.addBlock}</Button>{blockMenuOpen ? <div className="absolute right-0 top-12 z-20 grid w-64 grid-cols-2 gap-1 rounded-2xl border border-border bg-popover p-2 shadow-2xl">{blockOptions.map(([type, label]) => <button key={type} type="button" onClick={() => addBlock(type)} className="rounded-xl px-3 py-2 text-left text-xs transition hover:bg-accent">{label}</button>)}</div> : null}</div></div><div className="mt-5 space-y-3">{form.blocks.map((block, index) => <article key={block.id} className="rounded-2xl border border-border/70 bg-background/60 p-4"><div className="flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-wider text-primary">{copy.management.blocks[block.type]}</span><div className="flex"><Button type="button" variant="ghost" size="icon" onClick={() => moveBlock(index, -1)} disabled={index === 0}><ArrowUp className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" onClick={() => moveBlock(index, 1)} disabled={index === form.blocks.length - 1}><ArrowDown className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" onClick={() => update("blocks", form.blocks.filter((item) => item.id !== block.id))}><X className="h-4 w-4" /></Button></div></div><textarea className="mt-3 min-h-24 w-full resize-y rounded-xl border border-border/70 bg-card/40 p-3 text-sm outline-none focus:border-primary/60" value={block.content} onChange={(event) => updateBlock(block.id, event.target.value)} /></article>)}</div></section>
        <aside className="space-y-5 rounded-[24px] border border-border/70 bg-card/35 p-5 xl:sticky xl:top-28 xl:self-start"><label className="block text-sm font-medium">{copy.management.category}<select className={inputClass} value={form.category} onChange={(event) => update("category", event.target.value)}>{catalog.categories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="block text-sm font-medium">{copy.explore.level}<select className={inputClass} value={form.level} onChange={(event) => update("level", event.target.value)}>{["beginner", "intermediate", "advanced"].map((level) => <option key={level} value={level}>{copy.levels[level]}</option>)}</select></label><label className="block text-sm font-medium">{copy.management.estimatedDuration}<input type="number" min="1" className={inputClass} value={form.duration} onChange={(event) => update("duration", Number(event.target.value))} /></label><div><p className="text-sm font-medium">{copy.management.cover}</p><input ref={fileInputRef} type="file" className="sr-only" accept="image/*,video/mp4,video/webm,audio/*,application/pdf,text/plain,text/csv,.docx,.xlsx" onChange={handleUpload} /><Button type="button" variant="outline" className="mt-2 w-full rounded-xl" onClick={() => fileInputRef.current?.click()}><Plus className="mr-2 h-4 w-4" />{copy.management.upload}</Button>{uploadStatus ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{uploadStatus}</p> : null}</div></aside>
      </div>
    </div>
  );
};

export default LearningManagementPage;
