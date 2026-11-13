import { FilePlus2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { screenPath } from "../../screens";
import { isBuilt } from "../../screens";
import { useHomeAccess } from "./homeAccess";

/**
 * The two buttons of the home screen: New order, the one primary button, and
 * Upload a document, which opens the upload screen. New order opens the app's
 * own order form, and only for a role that may create orders. Upload says why
 * it does nothing while its screen is not built.
 */
export function HomeActions() {
  const { t } = useTranslation("directions-home");
  const mayCreate = useHomeAccess().create;
  const upload = (
    <>
      <Upload aria-hidden="true" />
      {t("actions.upload")}
    </>
  );
  return (
    <>
      {mayCreate ? (
        <Button asChild className="pointer-coarse:h-11">
          <Link to="/orders/new">
            <FilePlus2 aria-hidden="true" />
            {t("actions.newOrder")}
          </Link>
        </Button>
      ) : null}
      {isBuilt("upload") ? (
        <Button asChild variant="outline" className="pointer-coarse:h-11">
          <Link to={screenPath("upload")}>{upload}</Link>
        </Button>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="cursor-default pointer-coarse:h-11"
              aria-disabled="true"
            >
              {upload}
            </Button>
          </TooltipTrigger>
          <TooltipContent className="fs-14">
            {t("actions.uploadUnavailable")}
          </TooltipContent>
        </Tooltip>
      )}
    </>
  );
}
