import { useTranslation } from "react-i18next";
import { toast } from "@/components/common/toast";
import { formMessage } from "@/components/form";

/**
 * Tells the person how an action or a save failed, in the server's own words
 * and with the trace id to quote, as the forms of the kit do. One toast, so a
 * failure never ends in silence or in a generic line.
 */
export function useReportFailure(): (error: unknown) => void {
  const { t } = useTranslation("document-form");
  return (error) => {
    const { message, traceId } = formMessage(error);
    toast.failed(message, {
      ...(traceId ? { description: t("failureTrace", { traceId }) } : {}),
    });
  };
}
