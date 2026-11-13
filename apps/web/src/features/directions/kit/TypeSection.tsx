import { useTranslation } from "react-i18next";
import { KitSection } from "./KitSection";

const SIZES = [
  [12, "fs-12"],
  [13, "fs-13"],
  [14, "fs-14"],
  [16, "fs-16"],
  [20, "fs-20"],
  [28, "fs-28"],
  [44, "fs-44"],
] as const;

export function TypeSection() {
  const { t } = useTranslation("directions-kit");
  return (
    <KitSection title={t("sections.type")} intro={t("type.intro")}>
      <ul>
        {SIZES.map(([size, cls]) => (
          <li
            key={size}
            className="flex items-baseline gap-4 border-b border-border py-1.5"
          >
            <span className="fs-12 numeral w-12 shrink-0 text-right text-muted-foreground">
              {t("type.size", { size })}
            </span>
            {size >= 28 ? (
              <span className={`${cls} numeral break-words`}>
                {t("type.figure")}
              </span>
            ) : (
              <span className={`${cls} truncate`}>{t("type.sample")}</span>
            )}
          </li>
        ))}
      </ul>
    </KitSection>
  );
}
