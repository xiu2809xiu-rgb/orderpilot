import { FilePlus2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { UPLOAD_PATH, useUploadEntry } from "@/app/shell/demoParts";
import { usePrimaryAction } from "@/components/common/primaryAction";
import { Button } from "@/components/ui/button";
import { hasPermission, useSessionStore } from "@/stores/session";

/**
 * The two ways in: New order, the one primary button of the page, and Upload
 * a PO beside it. Each shows only to a role that may use it. New order opens
 * the order form; Upload a PO opens the upload and review page. The N key
 * runs New order, so it is declared as the page's primary action.
 */
export function OrdersActions() {
  const { t } = useTranslation("directions-orders");
  const session = useSessionStore((state) => state.session);
  const mayCreate = hasPermission(session, "orders.create");
  const mayUpload = useUploadEntry();
  const navigate = useNavigate();
  const label = t("actions.newOrder");
  usePrimaryAction(
    mayCreate
      ? {
          label,
          icon: FilePlus2,
          onRun: () => {
            void navigate("/orders/new");
          },
        }
      : undefined,
  );
  return (
    <>
      {mayCreate ? (
        <Button asChild className="pointer-coarse:h-11">
          <Link to="/orders/new">
            <FilePlus2 aria-hidden="true" />
            {label}
          </Link>
        </Button>
      ) : null}
      {mayUpload ? (
        <Button asChild variant="outline" className="pointer-coarse:h-11">
          <Link to={UPLOAD_PATH}>
            <Upload aria-hidden="true" />
            {t("actions.upload")}
          </Link>
        </Button>
      ) : null}
    </>
  );
}
