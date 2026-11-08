import { useTranslation } from "react-i18next";
import { toast } from "@/components/common/toast";
import { printForm } from "./printForm";
import type { DocumentPrint } from "./types";

const WHEN = new Intl.DateTimeFormat("en-SG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Singapore",
});

/** The bar's Print: the screen's spec plus the status, in the print frame. */
export function usePrintAction(
  print: (() => DocumentPrint) | undefined,
  statusLabel: string,
): (() => void) | undefined {
  const { t, i18n } = useTranslation("document-form");
  const { t: tc } = useTranslation("components");
  if (!print) return undefined;
  return () => {
    // Built inside the try so a throw in the screen's builder ends in the
    // same toast as a failed print.
    void (async () => {
      const spec = print();
      await printForm(
        {
          ...spec,
          fields: [
            { label: t("footer.status"), value: statusLabel },
            ...spec.fields,
          ],
        },
        {
          note: t("print.note", {
            demo: tc("badges.synthetic"),
            when: WHEN.format(new Date()),
          }),
          lang: i18n.language,
        },
      );
    })().catch(() => {
      toast.failed(t("print.failed"));
    });
  };
}
