import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/lib/i18n/routing";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as AppLocale);

  return <HomePageContent />;
}

function HomePageContent() {
  const t = useTranslations("home");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-4 px-6">
      <div className="flex w-full items-center justify-between">
        <span className="text-sm font-medium text-neutral-500">
          {t("title")}
        </span>
        <LocaleSwitcher />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-lg text-neutral-600 dark:text-neutral-400">
        {t("tagline")}
      </p>
      <p className="text-sm text-neutral-500">{t("placeholder")}</p>
    </main>
  );
}
