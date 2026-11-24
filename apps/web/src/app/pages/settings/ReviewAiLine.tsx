import { useTranslation } from "react-i18next";
import type { ReviewItem } from "@orderpilot/shared";
import { aiLineKey } from "./reviewAi";

/**
 * What the AI check did, for the reviewer: the verdict and the concerns when a
 * model looked, or why none did. It is text only, never markup, and the AI
 * decides nothing: the buttons beside it are the person's.
 */
export function ReviewAiLine({ ai }: { ai: ReviewItem["ai"] }) {
  const { t } = useTranslation("settings");
  const checked = ai.status === "CHECKED";
  return (
    <div className="flex flex-col gap-s1 text-muted-foreground">
      <p className="fs-14">{t(aiLineKey(ai))}</p>
      {checked && ai.concerns.length > 0 ? (
        <p className="fs-14">
          {t("pictures.ai.concerns", {
            list: ai.concerns
              .map((concern) => t(`pictures.ai.concern.${concern}`))
              .join(", "),
          })}
        </p>
      ) : null}
      {checked && ai.note ? (
        <p className="fs-14">{t("pictures.ai.note", { note: ai.note })}</p>
      ) : null}
    </div>
  );
}
