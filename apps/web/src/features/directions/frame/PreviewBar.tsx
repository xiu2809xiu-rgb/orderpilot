import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useThemeStore } from "@/lib/theme";
import { DIRECTIONS, screenPath, type Direction } from "../directions";
import { SCREENS, type ScreenId } from "../screens";
import { Segmented } from "./Segmented";
import { useIsDark } from "./useIsDark";

/**
 * The preview's own bar: the tag, and the switches for direction, scheme and
 * screen. It is neutral on purpose, so it is never mistaken for product UI.
 */
export function PreviewBar({
  direction,
  screen,
}: {
  direction: Direction;
  screen: ScreenId;
}) {
  const { t } = useTranslation("directions");
  const navigate = useNavigate();
  const setPreference = useThemeStore((state) => state.setPreference);
  const dark = useIsDark();

  return (
    <div
      role="region"
      aria-label={t("preview.bar")}
      className="dx-chrome flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 sm:min-h-10"
    >
      <span className="fs-13 font-semibold">{t("preview.tag")}</span>
      <span className="dx-chrome-muted fs-13 hidden lg:inline">
        {t("preview.note")}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
        <Segmented
          label={t("preview.direction")}
          value={direction}
          options={DIRECTIONS.map((id) => ({
            id,
            label: t(`directions.${id}`),
            to: screenPath(id, screen),
          }))}
        />
        <Segmented
          label={t("preview.scheme")}
          value={dark ? "dark" : "light"}
          options={[
            { id: "light", label: t("preview.light"), icon: Sun },
            { id: "dark", label: t("preview.dark"), icon: Moon },
          ]}
          onSelect={(id) => {
            setPreference(id === "dark" ? "dark" : "light");
          }}
        />
        {/* A list of one is not a choice: it appears once a second screen is built. */}
        {SCREENS.length > 1 ? (
          <label className="flex items-center gap-2">
            <span className="dx-chrome-muted fs-13">{t("preview.screen")}</span>
            <select
              value={screen}
              onChange={(event) => {
                void navigate(screenPath(direction, event.target.value));
              }}
              className="dx-chrome-group fs-13 rounded-[5px] px-2 py-1 font-medium"
            >
              {SCREENS.map(({ id }) => (
                <option key={id} value={id}>
                  {t(`screens.${id}.title`)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </div>
  );
}
