import { FlaskConical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/kit/FileDropzone";
import { ACCEPT, MAX_FILES, MAX_MB } from "./uploadRules";

interface DropZoneProps {
  onFiles: (files: readonly File[]) => void;
  onDemo: () => void;
}

/**
 * Where a document goes in: the kit's drop zone with this screen's words and
 * limits written inside the frame, and, for a person with no file to hand, the
 * demo purchase order beside the choose button.
 */
export function DropZone({ onFiles, onDemo }: DropZoneProps) {
  const { t } = useTranslation("directions-intake");
  return (
    <FileDropzone
      title={t("drop.title")}
      draggingTitle={t("drop.dragging")}
      hint={t("drop.limits", { size: MAX_MB, count: MAX_FILES })}
      chooseLabel={t("drop.choose")}
      inputLabel={t("drop.inputLabel")}
      accept={ACCEPT}
      onFiles={onFiles}
    >
      <span className="fs-14 text-muted-foreground">{t("drop.or")}</span>
      <Button
        type="button"
        variant="ghost"
        className="pointer-coarse:h-11"
        onClick={onDemo}
      >
        <FlaskConical aria-hidden="true" />
        {t("drop.demo")}
      </Button>
    </FileDropzone>
  );
}
