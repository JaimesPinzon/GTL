import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

import { useTradingContext } from "@/contexts/TradingContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { APP_HOME_PATH } from "@/lib/routes";

const Register = () => {
  const navigate = useNavigate();
  const { register: registerUser, loginWithGoogle } = useTradingContext();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "student",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (value) => {
    setFormData((prev) => ({ ...prev, role: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      toast({
        title: t("auth.register.incompleteFieldsTitle"),
        description: t("auth.register.incompleteFieldsDescription"),
        variant: "destructive",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: t("auth.register.passwordMismatchTitle"),
        description: t("auth.register.passwordMismatchDescription"),
        variant: "destructive",
      });
      return;
    }

    if (typeof registerUser !== "function") {
      toast({
        title: t("auth.register.errorTitle"),
        description: t("auth.register.errorDescription"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const result = await registerUser({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role,
    });
    setIsSubmitting(false);

    if (result.success && result.user) {
      if (result.user.role === "teacher") {
        toast({
          title: t("auth.register.teacherWelcomeTitle"),
          description: t("auth.register.teacherWelcomeDescription"),
          duration: 7000,
        });
      }

      navigate(result.requiresEmailConfirmation ? "/login" : APP_HOME_PATH);
    }
  };

  const handleGoogleRegister = async () => {
    if (typeof loginWithGoogle !== "function") {
      toast({
        title: t("auth.register.errorTitle"),
        description: t("auth.register.errorDescription"),
        variant: "destructive",
      });
      return;
    }

    setIsGoogleSubmitting(true);
    await loginWithGoogle();
    setIsGoogleSubmitting(false);
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
            <CardDescription>{t("auth.register.title")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("common.labels.fullName")}</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder={t("common.labels.fullName")}
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
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
                  <Label htmlFor="password">{t("common.labels.password")}</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t("common.labels.confirmPassword")}</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder={t("common.placeholders.password")}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">{t("common.labels.role")}</Label>
                  <Select onValueChange={handleRoleChange} defaultValue={formData.role}>
                    <SelectTrigger id="role">
                      <SelectValue placeholder={t("auth.register.rolePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">{t("auth.register.role.student")}</SelectItem>
                      <SelectItem value="teacher">{t("auth.register.role.teacher")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting || isGoogleSubmitting}>
                  {isSubmitting ? t("auth.register.submitting") : t("auth.register.submit")}
                </Button>

                <div className="flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">o</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleGoogleRegister}
                  disabled={isSubmitting || isGoogleSubmitting}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
                    <path
                      fill="#EA4335"
                      d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5 9.1-3.7 9.1-9c0-.6-.1-1-.2-1.3H12z"
                    />
                  </svg>
                  {isGoogleSubmitting
                    ? t("auth.register.redirectingToGoogle")
                    : t("auth.register.continueWithGoogle")}
                </Button>
              </div>
            </form>

            <div className="mt-4 text-center text-sm">
              <span className="text-muted-foreground">{t("auth.register.existingAccount")} </span>
              <a href="/login" className="text-primary hover:underline">
                {t("auth.register.loginLink")}
              </a>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col">
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {t("auth.register.termsNotice")}
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
};

export default Register;
