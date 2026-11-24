import { useTranslation } from "react-i18next";

/** The line under the code field that says all six digits are needed. */
export function ShortCodeNote({ id }: { id: string }) {
  const { t } = useTranslation("signin");
  return (
    <p id={id} role="status" className="fs-14 text-destructive">
      {t("twoStep.field.short")}
    </p>
  );
}
