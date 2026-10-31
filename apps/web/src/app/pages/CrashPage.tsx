import { Component, useMemo, type ErrorInfo, type ReactNode } from "react";
import { OctagonAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRouteError } from "react-router";
import { Button } from "@/components/ui/button";
import { traceIdOf } from "@/lib/api/errors";
import { StatePanel } from "@/components/common/StatePanel";

/**
 * The crash page. It uses plain links, not the router's, so that it also works
 * when the router itself is what failed.
 */
export function CrashView({ error }: { error: unknown }) {
  const { t } = useTranslation();
  // An API error brings its own trace id. Otherwise make one to quote.
  const traceId = useMemo(
    () => traceIdOf(error) ?? `local-${crypto.randomUUID().slice(0, 8)}`,
    [error],
  );
  return (
    <main id="main" className="p-s3">
      <StatePanel
        icon={OctagonAlert}
        title={t("errors.crash.title")}
        description={t("errors.crash.description")}
        traceLabel={t("errors.traceId")}
        traceId={traceId}
      >
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
      </StatePanel>
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
