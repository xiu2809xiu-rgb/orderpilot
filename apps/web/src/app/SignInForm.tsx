import type { Role, Session } from "@orderpilot/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { demoLogin, login } from "@/lib/api/auth";
import { describeError } from "@/lib/errors";
import { DemoRoles } from "./signin/DemoRoles";
import { PasswordForm } from "./signin/PasswordForm";
import { SignInFailure, type Failure } from "./signin/SignInFailure";
import { useAuthOptions } from "./signin/useAuthOptions";
import "./signin/preloadWords";

interface SignInFormProps {
  /** Prefills the email, such as the person whose session just ended. */
  defaultEmail?: string;
  onSignedIn?: (session: Session) => void;
  /** Makes the field ids unique when the form is on screen twice. */
  idPrefix?: string;
}

/**
 * Email and password first, then the demo roles when the API says demo mode
 * is on. The form never moves when the roles arrive below it, so what a person
 * is typing keeps its place and its focus.
 */
export function SignInForm({
  defaultEmail = "",
  onSignedIn,
  idPrefix = "signin",
}: SignInFormProps) {
  // describeError reads the common error texts; the form's own words are in signin.
  const { t: tCommon } = useTranslation();
  const { t } = useTranslation("signin");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Role | null>(null);
  const options = useAuthOptions();

  async function run(action: () => Promise<Session>, role: Role | null) {
    setFailure(null);
    setBusy(true);
    setPending(role);
    try {
      // Await first: `a?.(await b)` skips the await when `a` is undefined.
      const session = await action();
      onSignedIn?.(session);
    } catch (error) {
      setFailure(describeError(error, tCommon));
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  const demo = options.data?.demoMode ? options.data : null;

  return (
    <div className="flex flex-col gap-5">
      <PasswordForm
        defaultEmail={defaultEmail}
        idPrefix={idPrefix}
        busy={busy}
        alert={failure ? <SignInFailure failure={failure} /> : null}
        onSubmit={(values) => run(() => login(values), null)}
      />
      {options.isError ? (
        <p className="fs-14 text-muted-foreground">
          {t("login.optionsFailed")}
        </p>
      ) : null}
      {options.isPending ? (
        // The roles are on their way: keep their room so nothing jumps.
        <div
          aria-hidden="true"
          className="flex flex-col gap-3 border-t border-border pt-5"
        >
          <Skeleton className="h-10 w-3/5" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 9 }, (_, index) => (
              <Skeleton key={index} className="h-14" />
            ))}
          </div>
        </div>
      ) : null}
      {demo ? (
        <div className="flex flex-col gap-4 border-t border-border pt-5">
          <DemoRoles
            roles={demo.demoRoles}
            headingId={`${idPrefix}-demo`}
            disabled={busy}
            pending={pending}
            onPick={(role) => {
              void run(() => demoLogin(role), role);
            }}
          />
        </div>
      ) : null}
      <p role="status" className="sr-only">
        {pending ? t("login.submitting") : ""}
      </p>
    </div>
  );
}
