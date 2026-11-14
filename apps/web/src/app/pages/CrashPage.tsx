import {
  Component,
  useEffect,
  useMemo,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { OctagonAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRouteError } from "react-router";
import { CopyButton } from "@/components/common/CopyButton";
import { Button } from "@/components/ui/button";
import { traceIdOf } from "@/lib/api/errors";
import { reportWebError } from "@/lib/monitoring/sentry";
import { Brand } from "../shell/Brand";
import { useInShell } from "../shell/inShell";
import { StatusPage } from "./StatusPage";

/**
 * The crash page. It uses plain links, not the router's, so that it also works
 * when the router itself is what failed. Inside the shell (an error in one
 * page) the panel and the bar stay, so a person can go elsewhere at once; on
 * its own (the shell itself failed) it brings the mark and a `main` of its own.
 */
export function CrashView({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const inShell = useInShell();
  // An API error brings its own trace id. Otherwise make one to quote.
  const traceId = useMemo(
    () => traceIdOf(error) ?? `local-${crypto.randomUUID().slice(0, 8)}`,
    [error],
  );
  // Sent to Sentry only when a DSN is set (ADR 0022); otherwise this does nothing.
  useEffect(() => {
    reportWebError(error);
  }, [error]);
  const page = (
    <StatusPage
      icon={OctagonAlert}
      title={t("errors.crash.title")}
      intro={t("errors.crash.description")}
      actions={
        <>
          <Button
            onClick={() => {
              window.location.reload();
            }}
          >
            {t("errors.crash.reload")}
          </Button>
          <Button variant="outline" asChild>
            <a href="/">{t("errors.crash.home")}</a>
          </Button>
        </>
      }
      sectionTitle={t("errors.crash.sectionTitle")}
    >
      <p className="fs-14 flex flex-wrap items-center gap-x-2 text-muted-foreground">
        {t("errors.traceId")}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
          {traceId}
        </code>
        <CopyButton value={traceId} what={t("errors.traceId")} />
      </p>
      <p className="fs-14 text-muted-foreground">
        {t("errors.crash.reference")}
      </p>
    </StatusPage>
  );
  if (inShell) return page;
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto max-w-3xl p-6 outline-none"
    >
      <div className="mb-8">
        <Brand collapsed={false} />
      </div>
      {page}
    </main>
  );
}

/** The router's errorElement. */
export function RouteCrashPage() {
  return <CrashView error={useRouteError()} />;
}

interface BoundaryState {
  error: unknown;
  failed: boolean;
}

/** Catches what the router cannot: errors in the providers around it. */
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  BoundaryState
> {
  override state: BoundaryState = { error: null, failed: false };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error, failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("OrderPilot crashed", error, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.failed ? (
      <CrashView error={this.state.error} />
    ) : (
      this.props.children
    );
  }
}
