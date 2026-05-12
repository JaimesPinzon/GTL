import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Lightbulb, BookOpen, Brain, BarChart3, ShieldCheck, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

const sectionIcons = {
  basics: BookOpen,
  strategies: Zap,
  risk_management: ShieldCheck,
  psychology: Brain,
  technical_analysis: BarChart3,
};

const LearnPage = () => {
  const { t, i18n } = useTranslation();
  const learningSections = useMemo(() => t("learn.sections", { returnObjects: true }), [t, i18n.resolvedLanguage]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-4 md:p-6"
    >
      <Card className="glass-card mx-auto w-full shadow-xl">
        <CardHeader className="pb-4">
          <div className="mb-2 flex items-center">
            <Lightbulb className="mr-3 h-8 w-8 text-yellow-400" />
            <CardTitle className="text-3xl font-bold">{t("learn.page.title")}</CardTitle>
          </div>
          <CardDescription className="text-md text-muted-foreground">
            {t("learn.page.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={learningSections[0]?.id || "basics"} className="w-full">
            <TabsList className="mb-6 grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {learningSections.map((section) => {
                const Icon = sectionIcons[section.id] || BookOpen;
                return (
                  <TabsTrigger key={section.id} value={section.id} className="text-xs sm:text-sm">
                    <Icon className="mr-2 h-5 w-5" />
                    {section.shortLabel || section.title}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {learningSections.map((section) => {
              const Icon = sectionIcons[section.id] || BookOpen;
              return (
                <TabsContent key={section.id} value={section.id}>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                    <h2 className="mb-6 flex items-center text-2xl font-semibold text-primary">
                      <Icon className="mr-2 h-5 w-5" />
                      {section.title}
                    </h2>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      {section.content.map((item) => (
                        <Card key={item.title} className="bg-card/50 transition-shadow duration-300 hover:shadow-lg">
                          <CardHeader>
                            <CardTitle className="text-lg">{item.title}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <img
                              alt={item.imageAlt || item.title}
                              className="mb-4 h-40 w-full rounded-md object-cover shadow-sm"
                              src="https://images.unsplash.com/photo-1618044733300-9472054094ee"
                            />
                            <p className="text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </motion.div>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default LearnPage;
