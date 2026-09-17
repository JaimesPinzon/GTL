import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/app/utils/supabase/admin";
import { AuthHttpError } from "@/modules/auth/errors";

type Locale = "es" | "en";
// Supabase's ungenerated client is intentionally dynamic in this repository.
// Keep the boundary explicit while the project does not yet ship generated DB types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const RESOURCE_BUCKET = "learning-resources";
const MAX_RESOURCE_BYTES = 50 * 1024 * 1024;
const ALLOWED_RESOURCE_MIME_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm",
  "audio/mpeg", "audio/mp4", "application/pdf", "text/plain", "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const courseVisuals: Record<string, { icon: string; accent: string; rating: number; students: number; isNew: boolean }> = {
  "market-foundations": { icon: "Landmark", accent: "from-sky-500/25 via-blue-500/10 to-transparent", rating: 4.9, students: 1840, isNew: false },
  "technical-analysis": { icon: "LineChart", accent: "from-violet-500/25 via-indigo-500/10 to-transparent", rating: 4.8, students: 1240, isNew: false },
  "risk-management": { icon: "ShieldCheck", accent: "from-emerald-500/25 via-teal-500/10 to-transparent", rating: 4.9, students: 960, isNew: false },
  "investment-intro": { icon: "TrendingUp", accent: "from-amber-500/25 via-orange-500/10 to-transparent", rating: 4.7, students: 780, isNew: true },
  "fundamental-analysis": { icon: "SearchCheck", accent: "from-cyan-500/25 via-sky-500/10 to-transparent", rating: 4.8, students: 640, isNew: false },
  "portfolio-construction": { icon: "PieChart", accent: "from-fuchsia-500/25 via-purple-500/10 to-transparent", rating: 4.8, students: 520, isNew: true },
  "macro-markets": { icon: "Globe2", accent: "from-rose-500/25 via-pink-500/10 to-transparent", rating: 4.7, students: 410, isNew: true },
  "decision-psychology": { icon: "Brain", accent: "from-blue-500/25 via-cyan-500/10 to-transparent", rating: 4.9, students: 890, isNew: false },
};

const localeOf = (language: unknown): Locale => String(language || "es").toLowerCase().startsWith("en") ? "en" : "es";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const localize = (value: unknown, locale: Locale): any => {
  if (Array.isArray(value)) return value.map((item) => localize(item, locale));
  if (!value || typeof value !== "object") return value;
  const record = value as Row;
  if (Object.prototype.hasOwnProperty.call(record, "es") || Object.prototype.hasOwnProperty.call(record, "en")) {
    return record[locale] ?? record.es ?? record.en ?? "";
  }
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, localize(item, locale)]));
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const throwIfError = (result: { error: any }) => {
  if (result.error) throw result.error;
  return result;
};

export async function getLearningProfile(userId: string) {
  const result = await supabaseAdmin.from("profiles").select("user_id,role,name,email").eq("user_id", userId).maybeSingle();
  throwIfError(result);
  if (!result.data) throw new AuthHttpError(403, "El perfil del usuario no está disponible.");
  return result.data as Row;
}

export async function requireLearningStaff(userId: string) {
  const profile = await getLearningProfile(userId);
  if (!["teacher", "admin"].includes(String(profile.role || "").toLowerCase())) {
    throw new AuthHttpError(403, "Esta operación requiere permisos de docente o administrador.");
  }
  return profile;
}

const queryPublishedCatalog = async () => {
  const [categoriesResult, coursesResult, pathsResult] = await Promise.all([
    supabaseAdmin.from("learning_categories").select("*").eq("is_active", true).order("position"),
    supabaseAdmin.from("learning_courses").select("*").eq("status", "published").order("published_at", { ascending: false }),
    supabaseAdmin.from("learning_paths").select("*").eq("status", "published").order("published_at", { ascending: false }),
  ]);
  throwIfError(categoriesResult); throwIfError(coursesResult); throwIfError(pathsResult);

  const courses = (coursesResult.data || []) as Row[];
  const courseIds = courses.map((row) => row.id);
  const modulesResult = courseIds.length
    ? await supabaseAdmin.from("learning_course_modules").select("*").in("course_id", courseIds).eq("status", "published").order("position")
    : { data: [], error: null };
  throwIfError(modulesResult);
  const modules = (modulesResult.data || []) as Row[];
  const moduleIds = modules.map((row) => row.id);
  const lessonsResult = moduleIds.length
    ? await supabaseAdmin.from("learning_lessons").select("*").in("module_id", moduleIds).eq("status", "published").order("position")
    : { data: [], error: null };
  throwIfError(lessonsResult);
  const lessons = (lessonsResult.data || []) as Row[];
  const lessonIds = lessons.map((row) => row.id);
  const blocksResult = lessonIds.length
    ? await supabaseAdmin.from("learning_lesson_blocks").select("*").in("lesson_id", lessonIds).order("position")
    : { data: [], error: null };
  throwIfError(blocksResult);
  const pathIds = ((pathsResult.data || []) as Row[]).map((row) => row.id);
  const pathItemsResult = pathIds.length
    ? await supabaseAdmin.from("learning_path_items").select("*").in("path_id", pathIds).order("position")
    : { data: [], error: null };
  throwIfError(pathItemsResult);

  return {
    categories: (categoriesResult.data || []) as Row[],
    courses,
    modules,
    lessons,
    blocks: (blocksResult.data || []) as Row[],
    paths: (pathsResult.data || []) as Row[],
    pathItems: (pathItemsResult.data || []) as Row[],
  };
};

const mapCatalog = (raw: Awaited<ReturnType<typeof queryPublishedCatalog>>, locale: Locale) => {
  const categoriesById = new Map(raw.categories.map((row) => [row.id, row]));
  const blocksByLesson = new Map<string, Row[]>();
  raw.blocks.forEach((row) => blocksByLesson.set(row.lesson_id, [...(blocksByLesson.get(row.lesson_id) || []), row]));
  const lessonsByModule = new Map<string, Row[]>();
  raw.lessons.forEach((row) => lessonsByModule.set(row.module_id, [...(lessonsByModule.get(row.module_id) || []), row]));
  const modulesByCourse = new Map<string, Row[]>();
  raw.modules.forEach((row) => modulesByCourse.set(row.course_id, [...(modulesByCourse.get(row.course_id) || []), row]));
  const courseKeyById = new Map(raw.courses.map((row) => [row.id, row.external_key]));
  const pathItemsByPath = new Map<string, Row[]>();
  raw.pathItems.forEach((row) => pathItemsByPath.set(row.path_id, [...(pathItemsByPath.get(row.path_id) || []), row]));

  const categories = raw.categories.map((row) => ({
    id: row.slug,
    databaseId: row.id,
    label: localize(row.name, locale),
    description: localize(row.description, locale),
    icon: row.icon,
  }));

  const courses = raw.courses.map((row) => {
    const visual = courseVisuals[row.external_key] || { icon: "BookOpen", accent: "from-blue-500/20 to-transparent", rating: 0, students: 0, isNew: false };
    return {
      id: row.external_key,
      databaseId: row.id,
      slug: row.slug,
      title: localize(row.title, locale),
      shortTitle: localize(row.short_title, locale) || localize(row.title, locale),
      description: localize(row.description, locale),
      outcomes: localize(row.outcomes, locale),
      category: categoriesById.get(row.category_id)?.slug || "markets",
      level: row.difficulty,
      durationMinutes: Number(row.estimated_duration_minutes || 0),
      type: "course",
      featured: Boolean(row.is_featured),
      isNew: visual.isNew,
      rating: visual.rating,
      students: visual.students,
      icon: visual.icon,
      accent: visual.accent,
      modules: (modulesByCourse.get(row.id) || []).map((module) => ({
        id: module.external_key,
        databaseId: module.id,
        title: localize(module.title, locale),
        description: localize(module.description, locale),
        lessons: (lessonsByModule.get(module.id) || []).map((lesson) => ({
          id: lesson.external_key,
          databaseId: lesson.id,
          slug: lesson.slug,
          title: localize(lesson.title, locale),
          description: localize(lesson.description, locale),
          duration: Number(lesson.estimated_duration_minutes || 0),
          type: lesson.lesson_type,
          blocks: (blocksByLesson.get(lesson.id) || []).map((block) => ({
            id: block.id,
            type: block.block_type,
            ...localize(block.content, locale),
            settings: localize(block.settings, locale),
          })),
        })),
      })),
    };
  });

  const paths = raw.paths.map((row) => ({
    id: row.external_key,
    databaseId: row.id,
    slug: row.slug,
    title: localize(row.title, locale),
    description: localize(row.description, locale),
    level: row.difficulty,
    durationMinutes: Number(row.estimated_duration_minutes || 0),
    certificate: Boolean(row.offers_certificate),
    icon: row.icon,
    courseIds: (pathItemsByPath.get(row.id) || []).map((item) => courseKeyById.get(item.course_id)).filter(Boolean),
  }));

  return { categories, courses, paths };
};

const getUserLearningState = async (userId: string, raw: Awaited<ReturnType<typeof queryPublishedCatalog>>) => {
  const courseIds = raw.courses.map((row) => row.id);
  const lessonIds = raw.lessons.map((row) => row.id);
  const [progressResult, lessonProgressResult, savedResult, draftsResult] = await Promise.all([
    courseIds.length ? supabaseAdmin.from("learning_user_progress").select("*").eq("user_id", userId).in("course_id", courseIds) : Promise.resolve({ data: [], error: null }),
    lessonIds.length ? supabaseAdmin.from("learning_lesson_progress").select("*").eq("user_id", userId).in("lesson_id", lessonIds).order("updated_at", { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from("learning_saved_content").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabaseAdmin.from("learning_content_drafts").select("draft_key,payload,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(50),
  ]);
  throwIfError(progressResult); throwIfError(lessonProgressResult); throwIfError(savedResult); throwIfError(draftsResult);
  const courseById = new Map(raw.courses.map((row) => [row.id, row]));
  const lessonById = new Map(raw.lessons.map((row) => [row.id, row]));
  const moduleById = new Map(raw.modules.map((row) => [row.id, row]));
  const completedByCourse = new Map<string, string[]>();
  ((lessonProgressResult.data || []) as Row[]).filter((row) => row.status === "completed").forEach((row) => {
    const lesson = lessonById.get(row.lesson_id);
    const courseId = lesson ? moduleById.get(lesson.module_id)?.course_id : null;
    if (courseId && lesson) completedByCourse.set(courseId, [...(completedByCourse.get(courseId) || []), lesson.external_key]);
  });
  const courses = Object.fromEntries(((progressResult.data || []) as Row[]).map((row) => {
    const course = courseById.get(row.course_id);
    const lastLesson = row.last_lesson_id ? lessonById.get(row.last_lesson_id) : null;
    return [course?.external_key, {
      progress: Math.round(Number(row.progress_percent || 0)),
      completedLessonIds: completedByCourse.get(row.course_id) || [],
      lastLessonId: lastLesson?.external_key || null,
      lastActivity: row.last_activity_at,
      startedAt: row.started_at,
    }];
  }).filter(([key]) => Boolean(key)));
  const savedIds = ((savedResult.data || []) as Row[])
    .filter((row) => row.content_type === "course")
    .map((row) => courseById.get(row.content_id)?.external_key)
    .filter(Boolean);
  const history = ((lessonProgressResult.data || []) as Row[]).map((row) => {
    const lesson = lessonById.get(row.lesson_id);
    const courseId = lesson ? moduleById.get(lesson.module_id)?.course_id : null;
    return { courseId: courseById.get(courseId)?.external_key, lessonId: lesson?.external_key, at: row.updated_at };
  }).filter((row) => row.courseId && row.lessonId);
  const drafts = Object.fromEntries(((draftsResult.data || []) as Row[]).map((row) => [row.draft_key, row.payload]));
  return { courses, savedIds, history, quizAttempts: [], drafts };
};

export async function getLearningBootstrap(userId: string, language: unknown) {
  const locale = localeOf(language);
  const raw = await queryPublishedCatalog();
  const [catalog, userState] = await Promise.all([
    Promise.resolve(mapCatalog(raw, locale)),
    getUserLearningState(userId, raw),
  ]);
  return { catalog, userState, locale, source: "database" as const };
}

const resolveCourse = async (reference: string) => {
  const query = supabaseAdmin.from("learning_courses").select("id,external_key,slug");
  const result = /^[0-9a-f-]{36}$/i.test(reference) ? await query.eq("id", reference).maybeSingle() : await query.eq("external_key", reference).maybeSingle();
  throwIfError(result);
  if (!result.data) throw new AuthHttpError(404, "El curso no existe.");
  return result.data as Row;
};

const resolveLesson = async (reference: string) => {
  const query = supabaseAdmin.from("learning_lessons").select("id,external_key,module_id");
  const result = /^[0-9a-f-]{36}$/i.test(reference) ? await query.eq("id", reference).maybeSingle() : await query.eq("external_key", reference).maybeSingle();
  throwIfError(result);
  if (!result.data) throw new AuthHttpError(404, "La lección no existe.");
  return result.data as Row;
};

export async function startLearningCourse(userId: string, courseReference: string, lessonReference?: string | null) {
  const course = await resolveCourse(courseReference);
  const lesson = lessonReference ? await resolveLesson(lessonReference) : null;
  if (lesson) {
    const lessonModule = await supabaseAdmin.from("learning_course_modules").select("course_id").eq("id", lesson.module_id).maybeSingle();
    throwIfError(lessonModule);
    if (lessonModule.data?.course_id !== course.id) {
      throw new AuthHttpError(400, "La lección no pertenece al curso indicado.");
    }
  }
  const existing = await supabaseAdmin.from("learning_user_progress").select("*").eq("user_id", userId).eq("course_id", course.id).maybeSingle();
  throwIfError(existing);
  const now = new Date().toISOString();
  const result = await supabaseAdmin.from("learning_user_progress").upsert({
    user_id: userId,
    course_id: course.id,
    status: existing.data?.status || "in_progress",
    progress_percent: existing.data?.progress_percent || 0,
    time_spent_seconds: existing.data?.time_spent_seconds || 0,
    started_at: existing.data?.started_at || now,
    last_lesson_id: lesson?.id || existing.data?.last_lesson_id || null,
    last_activity_at: now,
  }, { onConflict: "user_id,course_id" }).select("*").single();
  throwIfError(result);
  return { courseId: course.external_key, lessonId: lesson?.external_key || null, progress: Number(result.data.progress_percent || 0) };
}

export async function completeLearningLesson(userId: string, courseReference: string, lessonReference: string, timeSpentSeconds = 0) {
  const [course, lesson] = await Promise.all([resolveCourse(courseReference), resolveLesson(lessonReference)]);
  const modules = await supabaseAdmin.from("learning_course_modules").select("id").eq("course_id", course.id);
  throwIfError(modules);
  const moduleIds = (modules.data || []).map((row) => row.id);
  const lessons = moduleIds.length ? await supabaseAdmin.from("learning_lessons").select("id").in("module_id", moduleIds).eq("status", "published") : { data: [], error: null };
  throwIfError(lessons);
  const validLessonIds = (lessons.data || []).map((row) => row.id);
  if (!validLessonIds.includes(lesson.id)) throw new AuthHttpError(400, "La lección no pertenece al curso indicado.");
  const now = new Date().toISOString();
  const existingLesson = await supabaseAdmin.from("learning_lesson_progress").select("time_spent_seconds,started_at,completed_at").eq("user_id", userId).eq("lesson_id", lesson.id).maybeSingle();
  throwIfError(existingLesson);
  const lessonResult = await supabaseAdmin.from("learning_lesson_progress").upsert({
    user_id: userId,
    lesson_id: lesson.id,
    status: "completed",
    time_spent_seconds: Number(existingLesson.data?.time_spent_seconds || 0) + Math.max(0, Math.trunc(timeSpentSeconds)),
    started_at: existingLesson.data?.started_at || now,
    completed_at: existingLesson.data?.completed_at || now,
  }, { onConflict: "user_id,lesson_id" });
  throwIfError(lessonResult);
  const completed = validLessonIds.length
    ? await supabaseAdmin.from("learning_lesson_progress").select("lesson_id").eq("user_id", userId).eq("status", "completed").in("lesson_id", validLessonIds)
    : { data: [], error: null };
  throwIfError(completed);
  const progress = Math.round(((completed.data || []).length / Math.max(validLessonIds.length, 1)) * 100);
  const existingCourse = await supabaseAdmin.from("learning_user_progress").select("started_at,time_spent_seconds").eq("user_id", userId).eq("course_id", course.id).maybeSingle();
  throwIfError(existingCourse);
  const courseResult = await supabaseAdmin.from("learning_user_progress").upsert({
    user_id: userId,
    course_id: course.id,
    status: progress >= 100 ? "completed" : "in_progress",
    progress_percent: progress,
    last_lesson_id: lesson.id,
    started_at: existingCourse.data?.started_at || now,
    completed_at: progress >= 100 ? now : null,
    last_activity_at: now,
    time_spent_seconds: Number(existingCourse.data?.time_spent_seconds || 0) + Math.max(0, Math.trunc(timeSpentSeconds)),
  }, { onConflict: "user_id,course_id" });
  throwIfError(courseResult);
  return { courseId: course.external_key, lessonId: lesson.external_key, progress };
}

export async function setLearningSaved(userId: string, contentType: string, reference: string, saved: boolean) {
  if (contentType !== "course") throw new AuthHttpError(400, "El tipo de contenido aún no admite favoritos.");
  const course = await resolveCourse(reference);
  const result = saved
    ? await supabaseAdmin.from("learning_saved_content").upsert({ user_id: userId, content_type: contentType, content_id: course.id }, { onConflict: "user_id,content_type,content_id" })
    : await supabaseAdmin.from("learning_saved_content").delete().eq("user_id", userId).eq("content_type", contentType).eq("content_id", course.id);
  throwIfError(result);
  return { contentType, contentId: course.external_key, saved };
}

export async function saveLearningDraft(userId: string, draftKey: string, entityType: string, payload: Row) {
  await requireLearningStaff(userId);
  if (!/^[a-z0-9][a-z0-9_-]{0,119}$/i.test(draftKey)) throw new AuthHttpError(400, "Identificador de borrador inválido.");
  if (!["course", "module", "lesson", "path", "quiz", "resource"].includes(entityType)) throw new AuthHttpError(400, "Tipo de borrador inválido.");
  const result = await supabaseAdmin.from("learning_content_drafts").upsert({
    user_id: userId, draft_key: draftKey, entity_type: entityType, payload, status: "draft",
  }, { onConflict: "user_id,draft_key" }).select("draft_key,payload,updated_at").single();
  throwIfError(result);
  return result.data;
}

export async function getLearningManagement(userId: string) {
  await requireLearningStaff(userId);
  const [courses, paths, lessons, learners, drafts, content] = await Promise.all([
    supabaseAdmin.from("learning_courses").select("id", { count: "exact", head: true }).eq("status", "published"),
    supabaseAdmin.from("learning_paths").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("learning_lessons").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("learning_user_progress").select("user_id", { count: "exact", head: true }),
    supabaseAdmin.from("learning_content_drafts").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("learning_courses").select("id,external_key,title,status,updated_at,author_id,category:learning_categories(name)").order("updated_at", { ascending: false }).limit(100),
  ]);
  [courses, paths, lessons, learners, drafts, content].forEach(throwIfError);
  return {
    stats: { publishedCourses: courses.count || 0, paths: paths.count || 0, lessons: lessons.count || 0, learners: learners.count || 0, drafts: drafts.count || 0 },
    content: content.data || [],
  };
}

const resourceKind = (mimeType: string) => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.includes("spreadsheet") || mimeType === "text/csv") return "spreadsheet";
  if (mimeType.includes("document") || mimeType === "text/plain") return "document";
  return "other";
};

const ensureLearningBucket = async () => {
  const current = await supabaseAdmin.storage.getBucket(RESOURCE_BUCKET);
  if (current.data) return;
  const created = await supabaseAdmin.storage.createBucket(RESOURCE_BUCKET, {
    public: false,
    fileSizeLimit: MAX_RESOURCE_BYTES,
    allowedMimeTypes: ALLOWED_RESOURCE_MIME_TYPES,
  });
  if (created.error && !String(created.error.message || "").toLowerCase().includes("already exists")) throw created.error;
};

export async function uploadLearningResource(userId: string, file: File, lessonReference?: string | null) {
  await requireLearningStaff(userId);
  if (!file || file.size <= 0) throw new AuthHttpError(400, "Selecciona un archivo válido.");
  if (file.size > MAX_RESOURCE_BYTES) throw new AuthHttpError(413, "El archivo supera el límite de 50 MB.");
  if (!ALLOWED_RESOURCE_MIME_TYPES.includes(file.type)) throw new AuthHttpError(415, "El tipo de archivo no está permitido.");
  const lesson = lessonReference ? await resolveLesson(lessonReference) : null;
  await ensureLearningBucket();
  const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "resource";
  const storagePath = `${userId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;
  const uploaded = await supabaseAdmin.storage.from(RESOURCE_BUCKET).upload(storagePath, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (uploaded.error) throw uploaded.error;
  const inserted = await supabaseAdmin.from("learning_resources").insert({
    lesson_id: lesson?.id || null, owner_id: userId, storage_bucket: RESOURCE_BUCKET, storage_path: storagePath,
    name: file.name, mime_type: file.type, size_bytes: file.size, kind: resourceKind(file.type), metadata: {},
  }).select("*").single();
  if (inserted.error) {
    await supabaseAdmin.storage.from(RESOURCE_BUCKET).remove([storagePath]);
    throw inserted.error;
  }
  const signed = await supabaseAdmin.storage.from(RESOURCE_BUCKET).createSignedUrl(storagePath, 3600);
  return { ...inserted.data, signedUrl: signed.data?.signedUrl || null };
}

export async function listLearningResources(userId: string) {
  await requireLearningStaff(userId);
  const result = await supabaseAdmin.from("learning_resources").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(100);
  throwIfError(result);
  return result.data || [];
}

export async function signLearningResource(userId: string, resourceId: string) {
  await getLearningProfile(userId);
  const result = await supabaseAdmin.from("learning_resources").select("*").eq("id", resourceId).eq("status", "active").maybeSingle();
  throwIfError(result);
  if (!result.data) throw new AuthHttpError(404, "El recurso no existe.");
  const signed = await supabaseAdmin.storage.from(result.data.storage_bucket).createSignedUrl(result.data.storage_path, 900);
  if (signed.error) throw signed.error;
  return { resource: result.data, signedUrl: signed.data.signedUrl, expiresIn: 900 };
}

export async function deleteLearningResource(userId: string, resourceId: string) {
  await requireLearningStaff(userId);
  const result = await supabaseAdmin.from("learning_resources").select("*").eq("id", resourceId).maybeSingle();
  throwIfError(result);
  if (!result.data) throw new AuthHttpError(404, "El recurso no existe.");
  const removed = await supabaseAdmin.storage.from(result.data.storage_bucket).remove([result.data.storage_path]);
  if (removed.error) throw removed.error;
  const deleted = await supabaseAdmin.from("learning_resources").delete().eq("id", resourceId);
  throwIfError(deleted);
  return { deleted: true };
}
