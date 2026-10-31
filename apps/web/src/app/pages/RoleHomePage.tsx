import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { cuesFor, featureNamespaces, featuresFor } from "@/features/nav";
import { useSessionStore } from "@/stores/session";
import { PageHeader } from "@/components/common/PageHeader";

/**
 * Each role lands here: tiles ("cues") with counts, then lists. There is no
 * data yet, so a tile shows a dash and "Planned" and links to its area. Counts
 * are never invented.
 */
export function RoleHomePage() {
  const { t } = useTranslation(["common", ...featureNamespaces]);
  const session = useSessionStore((state) => state.session);
  if (!session) return null;

  const { role, displayName } = session.user;
  const cues = cuesFor(role, featuresFor(session));

  return (
    <div className="space-y-s4">
      <PageHeader
        title={t("home.welcome", { name: displayName })}
        description={t("home.roleHome", { role: t(`roles.${role}`) })}
      />

      <section aria-labelledby="home-glance" className="space-y-s2">
        <div className="space-y-1">
          <h2 id="home-glance" className="text-lg font-semibold">
            {t("home.atAGlance")}
          </h2>
          <p className="text-muted-foreground">{t("home.atAGlanceHint")}</p>
        </div>
        {cues.length === 0 ? (
          <p className="text-muted-foreground">{t("home.noCues")}</p>
        ) : (
          <ul className="grid gap-s2 sm:grid-cols-2 xl:grid-cols-3">
            {cues.map(({ feature, cue }) => (
              <li key={`${feature.id}.${cue.id}`}>
                <Link
                  to={`/${feature.path}`}
                  className="group flex h-full flex-col gap-3 rounded-xl bg-card p-s3 shadow-card transition-shadow hover:shadow-pop"
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-medium">
                    {t(`cues.${cue.id}`, { ns: feature.namespace })}
                    <ChevronRight
                      className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="flex items-end justify-between gap-2">
                    <span
                      data-numeric
                      className="text-3xl font-semibold tracking-tight text-muted-foreground"
                    >
                      <span aria-hidden="true">{t("home.noValue")}</span>
                      <span className="sr-only">{t("home.noCount")}</span>
                    </span>
                    <Badge variant="outline">{t("planned.badge")}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="home-lists" className="space-y-s2">
        <h2 id="home-lists" className="text-lg font-semibold">
          {t("home.lists")}
        </h2>
        <div className="rounded-xl border border-dashed p-s4 text-center">
          <p className="font-medium">{t("home.listsEmptyTitle")}</p>
          <p className="measure mx-auto mt-1 text-muted-foreground">
            {t("home.listsEmptyHint")}
          </p>
        </div>
      </section>
    </div>
  );
}
