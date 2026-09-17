import { fetchWithAuth, getAccessToken } from "@/lib/auth-api";
import { getAuthBackendUrl } from "@/lib/env";

export const fetchLearningBootstrap = async (language = "es") => {
  const payload = await fetchWithAuth(`/api/learning?scope=bootstrap&language=${encodeURIComponent(language)}`, { method: "GET", credentials: "omit" });
  return payload;
};

export const fetchLearningManagement = async () => {
  const payload = await fetchWithAuth("/api/learning?scope=management", { method: "GET", credentials: "omit" });
  return payload;
};

const learningAction = (action, body = {}) => fetchWithAuth("/api/learning", {
  method: "POST",
  credentials: "omit",
  body: { action, ...body },
});

export const startRemoteLearningCourse = (courseId, lessonId) =>
  learningAction("start_course", { courseId, lessonId });

export const completeRemoteLearningLesson = (courseId, lessonId, timeSpentSeconds = 0) =>
  learningAction("complete_lesson", { courseId, lessonId, timeSpentSeconds });

export const setRemoteLearningSaved = (contentId, saved, contentType = "course") =>
  learningAction("save_content", { contentId, saved, contentType });

export const saveRemoteLearningDraft = (draftKey, payload, entityType = "lesson") =>
  learningAction("save_draft", { draftKey, payload, entityType });

const parseResponse = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || "Request failed.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
};

export const uploadLearningResource = async (file, lessonId) => {
  const token = await getAccessToken();
  const formData = new FormData();
  formData.append("file", file);
  if (lessonId) formData.append("lessonId", lessonId);
  const response = await fetch(getAuthBackendUrl("/api/learning/resources"), {
    method: "POST",
    credentials: "omit",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return parseResponse(response);
};

export const fetchLearningResources = async () => {
  const payload = await fetchWithAuth("/api/learning/resources", { method: "GET", credentials: "omit" });
  return payload.resources || [];
};

export const getLearningResourceUrl = async (resourceId) => {
  const payload = await fetchWithAuth(`/api/learning/resources?resourceId=${encodeURIComponent(resourceId)}`, { method: "GET", credentials: "omit" });
  return payload.signedUrl;
};

export const deleteLearningResource = (resourceId) =>
  fetchWithAuth(`/api/learning/resources?resourceId=${encodeURIComponent(resourceId)}`, { method: "DELETE", credentials: "omit" });
