import { useTranslation } from "react-i18next";
import type { CodeFieldLabels } from "@/components/kit/code-field/CodeField";

/** The code field's words, from the sign-in namespace. The kit part calls no translation itself. */
export function useCodeFieldLabels(): CodeFieldLabels {
  const { t } = useTranslation("signin");
  return {
    group: t("twoStep.field.group"),
    input: t("twoStep.field.input"),
    hint: t("twoStep.field.hint"),
    verifying: t("twoStep.field.verifying"),
    verified: t("twoStep.field.verified"),
    statusVerifying: t("twoStep.field.statusVerifying"),
    statusVerified: t("twoStep.field.statusVerified"),
    statusWrong: t("twoStep.field.statusWrong"),
  };
}
