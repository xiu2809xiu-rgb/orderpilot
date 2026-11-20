import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MaskedValue } from "@/components/parts/MaskedValue";
import { Button } from "@/components/ui/button";

/**
 * The file of a document: a link that opens the PDF in a new tab when the demo
 * set has one, and the plain words "No file in the demo set" when it has none.
 * Never a control that does nothing. A file that prints prices is not offered
 * to a role whose prices are masked: the masked mark with the server's reason
 * stands in its place, because the PDF would show what the page hides.
 */
export function DocumentFile({
  href,
  name,
  withheldReason = null,
}: {
  /** The demo PDF's address, or null when the demo set has no file for it. */
  href: string | null;
  /** What the link is called for a screen reader: the document and its number. */
  name: string;
  /** Set when the role may not read what the file holds: the reason, in words. */
  withheldReason?: string | null;
}) {
  const { t } = useTranslation("directions-orders");
  if (!href) {
    return (
      <p className="fs-14 text-muted-foreground">{t("documents.file.none")}</p>
    );
  }
  if (withheldReason !== null) {
    return <MaskedValue masked reason={withheldReason} />;
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
