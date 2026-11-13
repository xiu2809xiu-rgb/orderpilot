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
import { useSessionStore } from "@/stores/session";

/**
 * The two ways in: New order, the one primary button of the screen, and Upload
 * a PO beside it. Each is shown only to a role that holds its permission. New
 * order opens the app's own order form. Upload a PO opens the upload screen,
 * and says why it does nothing for as long as that screen is not built.
 */
export function OrdersActions() {
  const { t } = useTranslation("directions-orders");
  const permissions = useSessionStore((state) => state.session?.permissions);
  const mayCreate = permissions?.includes("orders.create") ?? false;
  const mayUpload = permissions?.includes("documents.upload") ?? false;
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
      {mayUpload ? (
        isBuilt("upload") ? (
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
        )
      ) : null}
    </>
  );
}
