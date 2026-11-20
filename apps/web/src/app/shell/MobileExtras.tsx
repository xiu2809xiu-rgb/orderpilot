import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { ThemeSwitch } from "./ThemeSwitch";
import { UPLOAD_PATH, useUploadEntry } from "./demoParts";

/**
 * What a narrow top bar has no room for: Upload and the theme. They sit at the
 * foot of the menu, with the words the bar gives them, so a phone loses
 * nothing a wide screen has.
 */
export function MobileExtras({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation();
  const mayUpload = useUploadEntry();
  return (
    <div
      role="group"
      aria-label={t("shell.extras")}
      className="dx-sheet-extras flex shrink-0 items-center gap-2 border-t border-sidebar-border px-4 py-2"
    >
      {mayUpload ? (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="fs-14 h-(--bar-ctl) flex-1"
        >
          <Link to={UPLOAD_PATH} onClick={onNavigate}>
            <Upload aria-hidden="true" />
            {t("shell.upload")}
          </Link>
        </Button>
      ) : (
        <span className="flex-1" />
      )}
      <ThemeSwitch />
    </div>
  );
}
