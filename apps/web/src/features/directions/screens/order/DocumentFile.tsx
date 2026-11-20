import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

/**
 * The file of a document: a link that opens the PDF in a new tab when the demo
 * set has one, and the plain words "No file in the demo set" when it has none.
 * Never a control that does nothing.
 */
export function DocumentFile({
  href,
  name,
}: {
  /** The demo PDF's address, or null when the demo set has no file for it. */
  href: string | null;
  /** What the link is called for a screen reader: the document and its number. */
  name: string;
}) {
  const { t } = useTranslation("directions-orders");
  if (!href) {
    return (
      <p className="fs-14 text-muted-foreground">{t("documents.file.none")}</p>
    );
  }
  return (
    <Button asChild variant="outline" size="sm" className="pointer-coarse:h-11">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("documents.file.openLabel", { document: name })}
      >
        <ExternalLink aria-hidden="true" />
        {t("documents.file.open")}
      </a>
    </Button>
  );
}
