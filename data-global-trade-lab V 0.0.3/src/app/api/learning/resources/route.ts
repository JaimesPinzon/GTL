import { NextRequest } from "next/server";

import { authJson, authOptionsResponse, withAuthErrors } from "@/modules/auth";
import { AuthHttpError } from "@/modules/auth/errors";
import { deleteLearningResource, listLearningResources, signLearningResource, uploadLearningResource } from "@/modules/learning/repository";
import { learningActor, learningText } from "@/app/api/learning/_shared";

export const runtime = "nodejs";
export const OPTIONS = authOptionsResponse;

export async function GET(request: NextRequest) {
  return withAuthErrors(request, async () => {
    const user = await learningActor(request);
    const resourceId = request.nextUrl.searchParams.get("resourceId");
    if (resourceId) {
      return authJson(request, { ok: true, ...(await signLearningResource(user.id, learningText(resourceId, "resourceId", 80))) });
    }
    return authJson(request, { ok: true, resources: await listLearningResources(user.id) });
  });
}

export async function POST(request: NextRequest) {
  return withAuthErrors(request, async () => {
    const user = await learningActor(request);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new AuthHttpError(400, "Selecciona un archivo válido.");
    const lessonId = formData.get("lessonId");
    const resource = await uploadLearningResource(user.id, file, lessonId ? learningText(lessonId, "lessonId", 120) : null);
    return authJson(request, { ok: true, resource }, 201);
  });
}

export async function DELETE(request: NextRequest) {
  return withAuthErrors(request, async () => {
    const user = await learningActor(request);
    const resourceId = learningText(request.nextUrl.searchParams.get("resourceId"), "resourceId", 80);
    return authJson(request, { ok: true, ...(await deleteLearningResource(user.id, resourceId)) });
  });
}
