import { Suspense, lazy } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useThemeStore, type ThemePreference } from "@/lib/theme";
import { useSessionStore } from "@/stores/session";
import { PageHeader } from "@/components/common/PageHeader";
import { ServiceChecksCard } from "./ServiceChecksCard";

// A separate chunk with the tracker, so the entry bundle does not grow.
const AnalyticsSettingsCard = lazy(
  () => import("@/features/monitoring/AnalyticsSettingsCard"),
);

const THEMES: { value: ThemePreference; icon: LucideIcon }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];

export function SettingsPage() {
  const { t } = useTranslation();
  const session = useSessionStore((state) => state.session);
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);

  return (
    <div className="space-y-s4">
      <PageHeader
        title={t("settings.title")}
        description={t("settings.description")}
      />

      <div className="grid max-w-3xl gap-s3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("settings.appearance")}
            </CardTitle>
            <p className="text-muted-foreground">
              {t("settings.appearanceHint")}
            </p>
          </CardHeader>
          <CardContent>
            <div
              role="radiogroup"
              aria-label={t("theme.label")}
              className="grid max-w-md grid-cols-3 gap-2"
            >
              {THEMES.map(({ value, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={preference === value}
                  onClick={() => {
                    setPreference(value);
                  }}
                  className={cn(
                    "flex h-10 items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors",
                    preference === value
                      ? "border-primary bg-accent text-accent-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {t(`theme.${value}`)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("settings.language")}
            </CardTitle>
            <p className="text-muted-foreground">
              {t("settings.languageHint")}
            </p>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">{t("settings.languageEnglish")}</Badge>
          </CardContent>
        </Card>

        <Suspense fallback={null}>
          <AnalyticsSettingsCard />
        </Suspense>

        <ServiceChecksCard />

        {session ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("settings.account")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-s2">
              <dl className="grid grid-cols-[8rem_1fr] gap-y-2">
                <dt className="text-muted-foreground">{t("settings.name")}</dt>
                <dd>{session.user.displayName}</dd>
                <dt className="text-muted-foreground">{t("settings.email")}</dt>
                <dd>{session.user.email}</dd>
                <dt className="text-muted-foreground">{t("settings.role")}</dt>
                <dd>{t(`roles.${session.user.role}`)}</dd>
              </dl>
              <div className="space-y-2">
                <h2 className="text-sm font-medium">{t("settings.access")}</h2>
                {session.permissions.length === 0 ? (
                  <p className="text-muted-foreground">
                    {t("settings.accessNone")}
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {session.permissions.map((permission) => (
                      <li key={permission}>
                        <Badge variant="secondary" className="font-mono">
                          {permission}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
