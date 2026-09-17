import { NextRequest } from "next/server";

import { authJson, authOptionsResponse, withAuthErrors } from "@/modules/auth";
import { AuthHttpError } from "@/modules/auth/errors";
import {
  completeLearningLesson,
  getLearningBootstrap,
  getLearningManagement,
  saveLearningDraft,
  setLearningSaved,
  startLearningCourse,
} from "@/modules/learning/repository";
import { learningActor, learningBody, learningText } from "@/app/api/learning/_shared";

export const runtime = "nodejs";
export const OPTIONS = authOptionsResponse;

export async function GET(request: NextRequest) {
  return withAuthErrors(request, async () => {
    const user = await learningActor(request);
    const scope = request.nextUrl.searchParams.get("scope") || "bootstrap";
    if (scope === "management") {
      return authJson(request, { ok: true, ...(await getLearningManagement(user.id)) });
    }
    if (scope !== "bootstrap") throw new AuthHttpError(400, "Alcance de consulta inválido.");
    const language = request.nextUrl.searchParams.get("language") || "es";
    return authJson(request, { ok: true, ...(await getLearningBootstrap(user.id, language)) });
  });
}

export async function POST(request: NextRequest) {
  return withAuthErrors(request, async () => {
    const user = await learningActor(request);
    const body = await learningBody(request);
    const action = learningText(body.action, "action", 40);

    if (action === "start_course") {
      const data = await startLearningCourse(
        user.id,
        learningText(body.courseId, "courseId", 120),
        body.lessonId ? learningText(body.lessonId, "lessonId", 120) : null
      );
      return authJson(request, { ok: true, data });
    }

    if (action === "complete_lesson") {
      const seconds = Number(body.timeSpentSeconds || 0);
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86400) throw new AuthHttpError(400, "El tiempo de estudio no es válido.");
      const data = await completeLearningLesson(
        user.id,
        learningText(body.courseId, "courseId", 120),
        learningText(body.lessonId, "lessonId", 120),
        seconds
      );
      return authJson(request, { ok: true, data });
    }

    if (action === "save_content") {
      const data = await setLearningSaved(
        user.id,
        learningText(body.contentType || "course", "contentType", 40),
        learningText(body.contentId, "contentId", 120),
        Boolean(body.saved)
      );
      return authJson(request, { ok: true, data });
    }

    if (action === "save_draft") {
      const payload = body.payload;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new AuthHttpError(400, "El contenido del borrador no es válido.");
      const serialized = JSON.stringify(payload);
      if (serialized.length > 500_000) throw new AuthHttpError(413, "El borrador supera el tamaño permitido.");
      const data = await saveLearningDraft(
        user.id,
        learningText(body.draftKey, "draftKey", 120),
        learningText(body.entityType || "lesson", "entityType", 40),
        payload as Record<string, unknown>
      );
      return authJson(request, { ok: true, data });
    }

    throw new AuthHttpError(400, "Acción de aprendizaje no reconocida.");
  });
}
