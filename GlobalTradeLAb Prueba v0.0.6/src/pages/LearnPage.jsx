import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";

import LearningShell from "@/features/learning/components/LearningShell";
import { LearningProvider } from "@/features/learning/context/LearningContext";
import { getLearningCatalog } from "@/features/learning/data/learningCatalog";
import LearningHomePage from "@/features/learning/pages/LearningHomePage";
import LearningExplorePage from "@/features/learning/pages/LearningExplorePage";
import LearningPathsPage from "@/features/learning/pages/LearningPathsPage";
import LearningCoursePage from "@/features/learning/pages/LearningCoursePage";
import LearningLessonPage from "@/features/learning/pages/LearningLessonPage";
import MyLearningPage from "@/features/learning/pages/MyLearningPage";
import LearningManagementPage from "@/features/learning/pages/LearningManagementPage";

const LearnPage = () => {
  const { i18n } = useTranslation();
  const catalog = getLearningCatalog(i18n.resolvedLanguage);

  return (
    <LearningProvider catalog={catalog} language={i18n.resolvedLanguage}>
      <Routes>
        <Route element={<LearningShell />}>
          <Route index element={<LearningHomePage />} />
          <Route path="explore" element={<LearningExplorePage />} />
          <Route path="paths" element={<LearningPathsPage />} />
          <Route path="paths/:pathSlug" element={<LearningPathsPage />} />
          <Route path="course/:courseSlug" element={<LearningCoursePage />} />
          <Route path="course/:courseSlug/:moduleSlug/:lessonSlug" element={<LearningLessonPage />} />
          <Route path="my-learning" element={<MyLearningPage />} />
          <Route path="saved" element={<Navigate to="../my-learning" replace />} />
          <Route path="history" element={<Navigate to="../my-learning" replace />} />
          <Route path="manage" element={<LearningManagementPage />} />
          <Route path="manage/editor/:editorId" element={<LearningManagementPage />} />
          <Route path="*" element={<Navigate to="/app/learn" replace />} />
        </Route>
      </Routes>
    </LearningProvider>
  );
};

export default LearnPage;
