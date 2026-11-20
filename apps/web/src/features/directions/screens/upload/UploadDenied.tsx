import { useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { startAsNewRole } from "@/app/shell/roleSwitch";
import { EmptyState } from "@/components/parts/EmptyState";
import { PageHeader } from "@/components/parts/PageHeader";
import { Button } from "@/components/ui/button";
import { demoLogin } from "@/lib/api/auth";
import { useSessionStore } from "@/stores/session";

/**
 * What a role that may not upload documents is shown. In a demo session the
 * way to a role that may is one press, the same sign-in the Demo role menu
 * makes, so the page then opens for Support without a trip Home. Outside a
 * demo session there is no such sign-in, so the sentence stands alone.
 */
export function UploadDenied() {
  const { t } = useTranslation("directions-intake");
  const queryClient = useQueryClient();
  const demo = useSessionStore((state) => state.session?.demo ?? false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function switchToSupport() {
    setBusy(true);
    setFailed(false);
    try {
      await demoLogin("SUPPORT");
      // Another role sees other data: nothing of the old role may stay on screen.
      await startAsNewRole(queryClient);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <div className="dx-sheet">
      <PageHeader title={t("title")} />
      <div className="dx-card">
        <EmptyState
          icon={Lock}
          title={t("denied.title")}
          description={t(
            demo ? "denied.demoDescription" : "denied.description",
          )}
          action={
            demo ? (
              <>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void switchToSupport();
                  }}
                >
                  {t("denied.switch")}
                </Button>
                {failed ? (
                  <p role="alert" className="fs-14 text-destructive">
                    {t("denied.failed")}
                  </p>
                ) : null}
              </>
            ) : null
          }
        />
      </div>
    </div>
  );
}
