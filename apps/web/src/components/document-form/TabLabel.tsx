import { useTranslation } from "react-i18next";

/**
 * A tab's name with the count of what needs attention. No badge at zero, so a
 * tab with nothing to do looks calm; the count is also read out in words.
 */
export function TabLabel({ name, count }: { name: string; count: number }) {
  const { t } = useTranslation("document-form");
  return (
    <>
      <span>{name}</span>
      {count > 0 ? (
        <>
          <span aria-hidden="true" className="df-tab-count numeral">
            {count}
          </span>{" "}
          <span className="sr-only">{t("tabs.attention", { count })}</span>
        </>
      ) : null}
    </>
  );
}
