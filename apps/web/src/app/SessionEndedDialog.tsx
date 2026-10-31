import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSessionStore } from "@/stores/session";
import { SignInForm } from "./SignInForm";

/**
 * When a session ends, this sits over the page instead of replacing it. The
 * page stays mounted, so a half-filled form is still there after the sign-in.
 */
export function SessionEndedDialog() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const open = useSessionStore((state) => state.status === "expired");
  const email = useSessionStore((state) => state.session?.user.email);

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
        }}
        onInteractOutside={(event) => {
          event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("sessionEnded.title")}</DialogTitle>
          <DialogDescription>{t("sessionEnded.description")}</DialogDescription>
        </DialogHeader>
        <SignInForm
          idPrefix="expired"
          defaultEmail={email}
          onSignedIn={() => {
            // Whatever failed with a 401 is fetched again.
            void queryClient.invalidateQueries();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
