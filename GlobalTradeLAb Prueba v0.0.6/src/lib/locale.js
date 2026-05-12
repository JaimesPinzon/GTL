import i18n from "@/Languages/i18n";

export const DEFAULT_LOCALE = "es-CO";

export const resolveLocale = (preferences = {}) => {
  return preferences?.numberFormat || i18n.resolvedLanguage || i18n.language || DEFAULT_LOCALE;
};

export const formatDateTimeByLocale = (
  value,
  preferences = {},
  options = { dateStyle: "medium", timeStyle: "short" },
) => {
  if (!value) {
    return i18n.t("common.states.noRecord");
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return i18n.t("common.date.invalid");
  }

  return new Intl.DateTimeFormat(resolveLocale(preferences), options).format(date);
};
