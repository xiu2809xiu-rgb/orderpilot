import { useTranslation } from "react-i18next";
import { PixelToggle } from "@/components/kit/pixel-toggle/PixelToggle";
import { useThemeStore } from "@/lib/theme";
import { useIsDark } from "@/lib/useIsDark";

/**
 * The theme switch: on is the light theme (the sun), off is the dark one (the
 * moon). It shows the theme that is on the page, so under "system" it shows
 * what the device gives, and follows a change made in Settings, in the palette
 * or on the device without a sound and without choosing again. A person who
 * uses it chooses Light or Dark; "system" stays in Settings, Appearance, and
 * the new theme opens from the switch (setPreference reads the press).
 */
export function ThemeSwitch() {
  const { t } = useTranslation();
  const dark = useIsDark();
  const setPreference = useThemeStore((state) => state.setPreference);
  return (
    <PixelToggle
      checked={!dark}
      label={t("theme.switch")}
      onCheckedChange={(day) => {
        setPreference(day ? "light" : "dark");
      }}
    />
  );
}
