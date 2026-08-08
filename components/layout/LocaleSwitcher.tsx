"use client";

import { useLocale, useTranslations } from "next-intl";
import { routing, type AppLocale } from "@/lib/i18n/routing";
import { usePathname, useRouter } from "@/lib/i18n/navigation";

const LOCALE_LABELS: Record<AppLocale, string> = {
  hy: "Հայերեն",
  en: "English",
  ru: "Русский",
};

export function LocaleSwitcher() {
  const t = useTranslations("localeSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="sr-only">{t("label")}</span>
      <select
        value={locale}
        onChange={(event) => {
          router.replace(pathname, { locale: event.target.value as AppLocale });
        }}
        className="rounded border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700"
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc}>
            {LOCALE_LABELS[loc]}
          </option>
        ))}
      </select>
    </label>
  );
}
