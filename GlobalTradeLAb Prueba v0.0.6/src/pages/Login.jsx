import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

import { useTradingContext } from "@/contexts/TradingContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { APP_HOME_PATH } from "@/lib/routes";

const Login = () => {
  const navigate = useNavigate();
  const { login: loginUser } = useTradingContext();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.email || !formData.password) {
      toast({
        title: t("auth.login.incompleteFieldsTitle"),
        description: t("auth.login.incompleteFieldsDescription"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    if (typeof loginUser !== "function") {
      toast({
        title: t("auth.login.errorTitle"),
        description: t("auth.login.genericError"),
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    const result = await loginUser({
      email: formData.email,
      password: formData.password,
    });

    if (result.success) {
      navigate(APP_HOME_PATH);
    }

    setIsSubmitting(false);
  };

  return (
    <div className="gradient-bg flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="glass-card border-none">
          <CardHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center">
              <h1 className="text-3xl font-bold">
                <span className="text-primary">GlobalTrade</span>
                <span className="text-primary/70">Lab</span>
              </h1>
            </div>
            <CardDescription>{t("auth.login.title")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("common.labels.email")}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder={t("common.placeholders.email")}
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t("common.labels.password")}</Label>
                    <a href="#" className="text-sm text-primary hover:underline">
                      {t("auth.login.forgotPassword")}
                    </a>
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder={t("common.placeholders.password")}
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? t("auth.login.submitting") : t("auth.login.submit")}
                </Button>
              </div>
            </form>

            <div className="mt-4 text-center text-sm">
              <span className="text-muted-foreground">{t("auth.login.noAccount")} </span>
              <a href="/register" className="text-primary hover:underline">
                {t("common.actions.register")}
              </a>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col">
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {t("auth.login.termsNotice")}
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
};

export default Login;
