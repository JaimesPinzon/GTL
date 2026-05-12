import React, { useState } from "react";
import { Mail, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const ContactSection = () => {
  const { t } = useTranslation();
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const handleContactChange = (event) => {
    const { name, value } = event.target;
    setContactForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleContactSubmit = (event) => {
    event.preventDefault();

    const subject = encodeURIComponent(
      t("landing.contact.mail.subject", {
        name: contactForm.name || t("landing.contact.mail.defaultLeadName"),
      })
    );
    const body = encodeURIComponent(
      t("landing.contact.mail.body", {
        name: contactForm.name,
        email: contactForm.email,
        phone: contactForm.phone,
        message: contactForm.message,
      })
    );

    window.location.href = `mailto:globaltradelab.edu@gmail.com?subject=${subject}&body=${body}`;
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="landing-cta grid gap-8 rounded-[36px] px-6 py-8 sm:px-10 lg:grid-cols-[0.92fr_1.08fr] lg:px-12 lg:py-12">
        <div className="self-start">
          <p className="landing-section-label">{t("landing.contact.label")}</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
            {t("landing.contact.title")}
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-200">{t("landing.contact.description")}</p>

          <div className="mt-8 space-y-4">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-3 text-blue-200">
                <Mail className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-[0.2em]">{t("landing.contact.emailTitle")}</span>
              </div>
              <p className="mt-3 text-base text-white">globaltradelab.edu@gmail.com</p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center gap-3 text-blue-200">
                <Phone className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-[0.2em]">{t("landing.contact.supportTitle")}</span>
              </div>
              <p className="mt-3 text-base text-white">{t("landing.contact.supportDescription")}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleContactSubmit} className="grid gap-5 rounded-[32px] border border-white/10 bg-slate-950/55 p-6 shadow-[0_24px_60px_rgba(2,8,24,0.36)]">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-200">{t("landing.contact.form.fullNameLabel")}</Label>
              <Input id="name" name="name" value={contactForm.name} onChange={handleContactChange} placeholder={t("landing.contact.form.fullNamePlaceholder")} className="rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-slate-500" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">{t("common.labels.email")}</Label>
              <Input id="email" name="email" type="email" value={contactForm.email} onChange={handleContactChange} placeholder={t("common.placeholders.email")} className="rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-slate-500" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-slate-200">{t("landing.contact.form.phoneLabel")}</Label>
            <Input id="phone" name="phone" value={contactForm.phone} onChange={handleContactChange} placeholder={t("landing.contact.form.phonePlaceholder")} className="rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-slate-500" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message" className="text-slate-200">{t("landing.contact.form.messageLabel")}</Label>
            <Textarea id="message" name="message" value={contactForm.message} onChange={handleContactChange} placeholder={t("landing.contact.form.messagePlaceholder")} className="min-h-36 rounded-2xl border-white/10 bg-white/5 text-white placeholder:text-slate-500" required />
          </div>

          <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-slate-400">{t("landing.contact.form.helpText")}</p>
            <Button type="submit" size="lg" className="rounded-2xl bg-blue-500 px-7 text-base font-semibold text-white hover:bg-blue-400">
              {t("landing.contact.form.submit")}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
};
