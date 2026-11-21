import { useTranslation } from "react-i18next";
import { RouteSkeleton } from "./shell/skeletons/RouteSkeleton";
import { useInShell } from "./shell/inShell";

/**
 * Shown while the app asks who is signed in, and while a page chunk loads.
 * Below the signed-in shell it is the shape of the page that is coming; outside
 * it, a mark on the ground, which is the body's own, so nothing jumps when the
 * shell arrives.
 */
export function Splash() {
  const { t } = useTranslation();
  if (useInShell()) return <RouteSkeleton />;
  return (
    <div className="boot-splash" role="status">
      <svg viewBox="0 0 32 32" width="40" height="40" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="currentColor" />
        <path
          d="M9 10.5 16 7l7 3.5v8L16 22l-7-3.5z"
          fill="none"
          stroke="var(--primary-foreground)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      <span className="sr-only">{t("shell.loading")}</span>
    </div>
  );
}
