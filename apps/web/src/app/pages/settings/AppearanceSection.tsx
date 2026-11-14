import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Section } from "@/components/parts/Section";
import { useThemeStore, type ThemePreference } from "@/lib/theme";

const THEMES: { value: ThemePreference; icon: LucideIcon }[] = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
];

/**
 * The theme: three choices in one group. The page changes as soon as one is
 * chosen, with the same opening circle as the bar's switch. Arrow keys move
 * the choice, as they do in any radio group, and Tab leaves the group.
 */
export function AppearanceSection() {
  const { t } = useTranslation();
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
    setPreference(next.value);
    group.current
      ?.querySelector<HTMLElement>(`[data-theme-choice="${next.value}"]`)
      ?.focus();
  }

  return (
    <Section
      title={t("settings.appearance")}
      intro={t("settings.appearanceHint")}
    >
      <div
        ref={group}
        role="radiogroup"
        aria-label={t("theme.label")}
        className="flex flex-wrap gap-3"
      >
        {THEMES.map(({ value, icon: Icon }, index) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={preference === value}
            tabIndex={preference === value ? 0 : -1}
            data-theme-choice={value}
            className="dx-choice"
            onClick={() => {
              setPreference(value);
            }}
            onKeyDown={(event) => {
              onKeyDown(event, index);
            }}
          >
            <Icon className="size-4" aria-hidden="true" />
            {t(`theme.${value}`)}
          </button>
        ))}
      </div>
    </Section>
  );
}
