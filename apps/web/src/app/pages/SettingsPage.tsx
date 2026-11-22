import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { PermissionDenied } from "@/components/common";
import { PageHeader } from "@/components/parts/PageHeader";
import { useSessionStore } from "@/stores/session";
import { AccountPanel } from "./settings/AccountPanel";
import { AiPanel } from "./settings/AiPanel";
import { AppearancePanel } from "./settings/AppearancePanel";
import { ControlsPanel } from "./settings/ControlsPanel";
import { HealthPanel } from "./settings/HealthPanel";
import { PrivacyPanel } from "./settings/PrivacyPanel";
import type { SectionId } from "./settings/sections";
import { SettingsNav } from "./settings/SettingsNav";
import { ShortcutsPanel } from "./settings/ShortcutsPanel";
import { useSettingsSection } from "./settings/useSettingsSection";

const PANELS: Record<SectionId, ComponentType> = {
  account: AccountPanel,
  appearance: AppearancePanel,
  shortcuts: ShortcutsPanel,
  privacy: PrivacyPanel,
  ai: AiPanel,
  controls: ControlsPanel,
  health: HealthPanel,
};

/**
 * Settings, as in the products people already know: a list of sections down
 * the side and one section at a time beside it, each a card of rows. What the
 * role may not open is not listed, and a stale link to it says so instead of
 * landing somewhere else. Nothing here has a Save button: every choice is
 * kept on this device and applies at once, and the page says that.
 */
export function SettingsPage() {
  // The governance words are for the access card's fallback, loaded here so that
  // no card has to wait for them.
  const { t } = useTranslation(["common", "settings", "governance"]);
  const session = useSessionStore((state) => state.session);
  const section = useSettingsSection();
  const allowed = section.visible(session);
  const Panel = PANELS[section.id];
  return (
    <div className="max-w-[60rem]">
      <PageHeader title={t("common:settings.title")} showDate={false} />
      <div className="grid gap-s4 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-s6">
        <SettingsNav session={session} current={allowed ? section.id : null} />
        <div className="max-w-[44rem] min-w-0">
          {allowed ? (
            <>
              <p className="sr-only" role="status">
                {t("settings:nav.showing", {
                  section: t(`settings:nav.sections.${section.id}`),
                })}
              </p>
              <Panel />
            </>
          ) : (
            <PermissionDenied
              description={t("settings:nav.deniedDescription")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
