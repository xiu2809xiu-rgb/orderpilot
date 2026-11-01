import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import {
  DemoBadge,
  PageHeader,
  SectionCardSkeleton,
} from "@/components/common";
import { formatLongDay } from "@/lib/format";
import { hasPermission, useSessionStore } from "@/stores/session";
import { HomeFlows } from "./home/HomeFlows";
import { HomeTiles } from "./home/HomeTiles";
import { NeedsYou } from "./home/NeedsYou";
import { QuickActions } from "./home/QuickActions";

const KpiTrends = lazy(() => import("@/features/insights/KpiTrends"));

/**
 * The first page each role sees: real counts, the work waiting for them with a
 * button that does it, and where every order stands. Each block loads on its
 * own, so one failure never takes the page down.
 */
export function RoleHomePage() {
  const { t } = useTranslation(["home", "common"]);
  const session = useSessionStore((state) => state.session);
  if (!session) return null;

  const { role, displayName } = session.user;
  const roleName = t(`roles.${role}`, { ns: "common" });
  return (
    <div className="space-y-s3">
      <PageHeader
        title={t("welcome", { name: displayName })}
        description={t("context", {
          role: roleName,
          date: formatLongDay(new Date()),
        })}
        meta={<DemoBadge kind="synthetic" />}
      />
      <HomeTiles session={session} />
      <div className="grid grid-cols-1 gap-s3 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0">
          <NeedsYou session={session} />
        </div>
        <QuickActions session={session} />
      </div>
      {role === "MANAGEMENT" && hasPermission(session, "insights.read") ? (
        <Suspense fallback={<SectionCardSkeleton lines={4} />}>
          <KpiTrends />
        </Suspense>
      ) : null}
      {hasPermission(session, "tracker.read") ? <HomeFlows /> : null}
    </div>
  );
}
