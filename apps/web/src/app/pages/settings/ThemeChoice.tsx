import { useRef, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useThemeStore, type ThemePreference } from "@/lib/theme";
import { ThemeTile } from "./ThemeTile";

const THEMES: readonly ThemePreference[] = ["light", "dark", "system"];

/**
 * The theme: three tiles in one radio group. The page changes as soon as one
 * is chosen, with the same opening circle as the bar's switch. Arrow keys move
 * the choice, as they do in any radio group, and Tab leaves the group.
 */
export function ThemeChoice() {
  const { t } = useTranslation(["settings", "common"]);
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const group = useRef<HTMLDivElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = THEMES[(index + step + THEMES.length) % THEMES.length];
    if (!next) return;
    setPreference(next);
    group.current
      ?.querySelector<HTMLElement>(`[data-theme-choice="${next}"]`)
      ?.focus();
  }

  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={t("common:theme.label")}
      className="grid grid-cols-3 gap-s2"
    >
      {THEMES.map((theme, index) => (
        <ThemeTile
          key={theme}
          theme={theme}
          label={t(`appearance.theme.${theme}`)}
          checked={preference === theme}
          onChoose={() => {
            setPreference(theme);
          }}
          onKeyDown={(event) => {
            onKeyDown(event, index);
          }}
        />
      ))}
    </div>
  );
}
