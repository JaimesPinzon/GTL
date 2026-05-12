import React from "react";
import { useTradingContext } from "@/contexts/TradingContext";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { HelpCircle, LifeBuoy, Mail, UserCheck, Copy } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "react-i18next";

const HelpPage = () => {
  const { t } = useTranslation();
  const { user, activeRoom, roomMembers } = useTradingContext();
  const { toast } = useToast();
  const developerEmail = "globaltradelab.edu@gmail.com";

  const teacherEmail =
    user?.role === "student"
      ? roomMembers.find((member) => member.roleInRoom === "teacher")?.profile?.email || null
      : null;

  const copyToClipboard = (text, typeLabel) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: t("help.copySuccessTitle"),
        description: t("help.copySuccessDescription", { type: typeLabel }),
      });
    }).catch(() => {
      toast({
        title: t("help.copyErrorTitle"),
        description: t("help.copyErrorDescription", { type: typeLabel }),
        variant: "destructive",
      });
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-4 md:p-8"
    >
      <Card className="glass-card mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <LifeBuoy className="mr-3 h-7 w-7 text-primary" />
            {t("help.title")}
          </CardTitle>
          <CardDescription>{t("help.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {user?.role === "student" && teacherEmail ? (
            <div className="rounded-lg border border-border bg-background/50 p-6">
              <h3 className="mb-2 flex items-center text-lg font-semibold">
                <UserCheck className="mr-2 h-5 w-5 text-primary/80" />
                {t("help.teacherContactTitle")}
              </h3>
              <p className="mb-3 text-sm text-muted-foreground">
                {activeRoom?.name
                  ? t("help.teacherContactRoomDescription", { room: activeRoom.name })
                  : t("help.teacherContactDescription")}
              </p>
              <div className="flex items-center justify-between rounded-md bg-secondary/50 p-3">
                <span className="text-sm font-medium">{teacherEmail}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(teacherEmail, t("help.teacherEmailLabel"))}
                  aria-label={t("help.copyTeacherEmailAriaLabel")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-background/50 p-6">
            <h3 className="mb-2 flex items-center text-lg font-semibold">
              <Mail className="mr-2 h-5 w-5 text-primary/80" />
              {t("help.supportTitle")}
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">{t("help.supportDescription")}</p>
            <div className="flex items-center justify-between rounded-md bg-secondary/50 p-3">
              <span className="text-sm font-medium">{developerEmail}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(developerEmail, t("help.supportEmailLabel"))}
                aria-label={t("help.copySupportEmailAriaLabel")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background/50 p-6">
            <h3 className="mb-2 flex items-center text-lg font-semibold">
              <HelpCircle className="mr-2 h-5 w-5 text-primary/80" />
              {t("help.faqTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">{t("help.faqDescription")}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default HelpPage;
