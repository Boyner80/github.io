import { defineRouting } from "next-intl/routing";

/**
 * Armenian is the default locale: Armenia is Lav Auto's primary market
 * (see docs/ARCHITECTURE.md §1 and docs/LOCALIZATION.md). This only affects
 * the fallback used when a visitor's Accept-Language header doesn't match
 * any supported locale — content negotiation still tries the request's
 * actual language preference first.
 */
export const routing = defineRouting({
  locales: ["hy", "en", "ru"],
  defaultLocale: "hy",
});

export type AppLocale = (typeof routing.locales)[number];
