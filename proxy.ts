import createMiddleware from "next-intl/middleware";
import { routing } from "@/lib/i18n/routing";

// Next.js 16 renamed the `middleware` file convention to `proxy` — this is
// still next-intl's standard locale-detection/redirect proxy underneath.
export default createMiddleware(routing);

export const config = {
  // Run on every path except API routes, Next.js internals, and files with
  // an extension (static assets).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
