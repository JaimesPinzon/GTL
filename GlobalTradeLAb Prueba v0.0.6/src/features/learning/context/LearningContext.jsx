import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useTradingContext } from "@/contexts/TradingContext";
import { flattenCourseLessons } from "@/features/learning/data/learningCatalog";
import {
  completeRemoteLearningLesson,
  fetchLearningBootstrap,
  saveRemoteLearningDraft,
  setRemoteLearningSaved,
  startRemoteLearningCourse,
} from "@/lib/learning-api";

const LearningContext = createContext(null);

const buildInitialState = () => ({
  courses: {
    "technical-analysis": {
      progress: 42,
      completedLessonIds: ["introduccion", "precio", "volumen", "tendencias"],
      lastLessonId: "soportes",
      lastActivity: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      startedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    },
    "risk-management": {
      progress: 68,
      completedLessonIds: ["incertidumbre", "regla-uno", "stop-loss", "tamano-posicion"],
      lastLessonId: "riesgo-rentabilidad",
      lastActivity: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      startedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
  savedIds: ["fundamental-analysis", "macro-markets"],
  history: [
    { courseId: "risk-management", lessonId: "tamano-posicion", at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
    { courseId: "technical-analysis", lessonId: "tendencias", at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
  ],
  quizAttempts: [
    { courseId: "technical-analysis", lessonId: "rsi", score: null, status: "pending" },
    { courseId: "investment-intro", lessonId: "perfil", score: 86, status: "complete" },
  ],
  drafts: {},
});

const readState = (key) => {
  if (typeof window === "undefined") return buildInitialState();
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? { ...buildInitialState(), ...JSON.parse(stored) } : buildInitialState();
  } catch {
    return buildInitialState();
  }
};

export const LearningProvider = ({ children, catalog: fallbackCatalog, language = "es" }) => {
  const { user } = useTradingContext();
  const storageKey = `gtl.learning.${user?.id || "guest"}`;
  const [catalog, setCatalog] = useState(fallbackCatalog);
  const [state, setState] = useState(() => readState(storageKey));
  const [backendStatus, setBackendStatus] = useState("loading");

  useEffect(() => {
    setState(readState(storageKey));
  }, [storageKey]);

  useEffect(() => {
    let active = true;
    setCatalog(fallbackCatalog);
    setBackendStatus("loading");
    fetchLearningBootstrap(language)
      .then((payload) => {
        if (!active || !payload?.catalog) return;
        setCatalog(payload.catalog);
        setState({
          courses: payload.userState?.courses || {},
          savedIds: payload.userState?.savedIds || [],
          history: payload.userState?.history || [],
          quizAttempts: payload.userState?.quizAttempts || [],
          drafts: payload.userState?.drafts || {},
        });
        setBackendStatus("ready");
      })
      .catch((error) => {
        if (!active) return;
        console.warn("Learning backend unavailable; using the local cache.", error);
        setBackendStatus("fallback");
      });
    return () => { active = false; };
  }, [fallbackCatalog, language, storageKey]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    }
  }, [state, storageKey]);

  const startCourse = useCallback((courseId, lessonId) => {
    const course = catalog.courses.find((item) => item.id === courseId);
    const lesson = course ? flattenCourseLessons(course).find((item) => item.id === lessonId) : null;
    setState((current) => {
      const existing = current.courses[courseId];
      const nextCourse = {
        progress: existing?.progress || 0,
        completedLessonIds: existing?.completedLessonIds || [],
        startedAt: existing?.startedAt || new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        lastLessonId: lessonId || existing?.lastLessonId || null,
      };
      return {
        ...current,
        courses: { ...current.courses, [courseId]: nextCourse },
        history: lessonId
          ? [{ courseId, lessonId, at: new Date().toISOString() }, ...current.history].slice(0, 30)
          : current.history,
      };
    });
    return startRemoteLearningCourse(course?.databaseId || courseId, lesson?.databaseId || lessonId).catch((error) => {
      console.warn("Could not persist learning course progress.", error);
      return null;
    });
  }, [catalog.courses]);

  const completeLesson = useCallback((courseId, lessonId) => {
    const course = catalog.courses.find((item) => item.id === courseId);
    if (!course) return;
    const allLessons = flattenCourseLessons(course);
    const lesson = allLessons.find((item) => item.id === lessonId);

    setState((current) => {
      const existing = current.courses[courseId] || { completedLessonIds: [] };
      const completedLessonIds = Array.from(new Set([...(existing.completedLessonIds || []), lessonId]));
      const progress = Math.round((completedLessonIds.length / Math.max(allLessons.length, 1)) * 100);
      return {
        ...current,
        courses: {
          ...current.courses,
          [courseId]: {
            ...existing,
            completedLessonIds,
            progress,
            lastLessonId: lessonId,
            lastActivity: new Date().toISOString(),
            startedAt: existing.startedAt || new Date().toISOString(),
          },
        },
        history: [{ courseId, lessonId, at: new Date().toISOString() }, ...current.history].slice(0, 30),
      };
    });
    return completeRemoteLearningLesson(course.databaseId || courseId, lesson?.databaseId || lessonId).then((payload) => {
      const persistedProgress = payload?.data?.progress;
      if (persistedProgress == null) return payload;
      setState((current) => ({
        ...current,
        courses: {
          ...current.courses,
          [courseId]: { ...current.courses[courseId], progress: persistedProgress },
        },
      }));
      return payload;
    }).catch((error) => {
      console.warn("Could not persist completed lesson.", error);
      return null;
    });
  }, [catalog.courses]);

  const toggleSaved = useCallback((contentId) => {
    const saved = !state.savedIds.includes(contentId);
    const course = catalog.courses.find((item) => item.id === contentId);
    setState((current) => ({
      ...current,
      savedIds: saved ? [...current.savedIds, contentId] : current.savedIds.filter((id) => id !== contentId),
    }));
    return setRemoteLearningSaved(course?.databaseId || contentId, saved).catch((error) => {
      console.warn("Could not persist saved learning content.", error);
      return null;
    });
  }, [catalog.courses, state.savedIds]);

  const saveDraft = useCallback((draftId, draft) => {
    setState((current) => ({
      ...current,
      drafts: {
        ...current.drafts,
        [draftId]: { ...draft, updatedAt: new Date().toISOString() },
      },
    }));
    const inferredType = String(draftId || "").replace(/^new-/, "").split("-")[0];
    const entityType = ["course", "module", "lesson", "path", "quiz", "resource"].includes(inferredType) ? inferredType : "lesson";
    return saveRemoteLearningDraft(draftId, draft, entityType).catch((error) => {
      console.warn("Could not persist the learning draft.", error);
      return null;
    });
  }, []);

  const value = useMemo(() => ({
    state,
    catalog,
    backendStatus,
    startCourse,
    completeLesson,
    toggleSaved,
    saveDraft,
    isSaved: (contentId) => state.savedIds.includes(contentId),
    getCourseState: (courseId) => state.courses[courseId] || null,
    getCourseProgress: (courseId) => state.courses[courseId]?.progress || 0,
  }), [backendStatus, catalog, completeLesson, saveDraft, startCourse, state, toggleSaved]);

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
};

export const useLearning = () => {
  const value = useContext(LearningContext);
  if (!value) throw new Error("useLearning must be used within LearningProvider");
  return value;
};
