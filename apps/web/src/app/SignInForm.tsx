import type { Session } from "@orderpilot/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { demoLogin, login } from "@/lib/api/auth";
import { describeError } from "@/lib/errors";
import { DemoRoles } from "./signin/DemoRoles";
import { PasswordForm } from "./signin/PasswordForm";
import { useAuthOptions } from "./signin/useAuthOptions";

interface SignInFormProps {
  /** Prefills the email, such as the person whose session just ended. */
  defaultEmail?: string;
  onSignedIn?: (session: Session) => void;
  /** Makes the field ids unique when the form is on screen twice. */
  idPrefix?: string;
  /**
   * Puts the demo roles first and the password form second, for the sign-in
   * page. Without demo mode there is no difference.
   */
  demoFirst?: boolean;
}

interface Failure {
  message: string;
  traceId: string | undefined;
}

/** Email and password, plus the demo roles when the API says demo mode is on. */
export function SignInForm({
  defaultEmail = "",
  onSignedIn,
  idPrefix = "signin",
  demoFirst = false,
}: SignInFormProps) {
  const { t } = useTranslation();
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const options = useAuthOptions();

  async function run(action: () => Promise<Session>) {
    setFailure(null);
    setBusy(true);
    try {
      // Await first: `a?.(await b)` skips the await when `a` is undefined.
      const session = await action();
      onSignedIn?.(session);
    } catch (error) {
      setFailure(describeError(error, t));
    } finally {
      setBusy(false);
    }
  }

  const demo = options.data?.demoMode ? options.data : null;
  const alert = failure ? (
    <div role="alert" className="text-sm text-destructive">
      <p>{failure.message}</p>
      {failure.traceId ? (
        <p className="text-xs text-muted-foreground">
          {t("errors.traceId")}:{" "}
          <code className="font-mono">{failure.traceId}</code>
        </p>
      ) : null}
    </div>
  ) : null;

  const roles = demo ? (
    <DemoRoles
      key="roles"
      roles={demo.demoRoles}
      headingId={`${idPrefix}-demo`}
      disabled={busy}
      onPick={(role) => {
        void run(() => demoLogin(role));
      }}
    />
  ) : null;
  const star = demoFirst && roles !== null;

  // Keyed, so the form keeps what was typed when the demo roles arrive above it.
  const form = (
    <PasswordForm
      key="form"
      defaultEmail={defaultEmail}
      idPrefix={idPrefix}
      busy={busy}
      secondary={star}
      alert={star ? null : alert}
      onSubmit={(values) => run(() => login(values))}
    />
  );

  if (demoFirst && (star || options.isPending)) {
    return (
      <div className="space-y-s3">
        {star ? (
          roles
        ) : (
          <div key="roles" aria-hidden="true" className="space-y-s2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-[8.5rem] w-full" />
          </div>
        )}
        {alert ? <div key="alert">{alert}</div> : null}
        <div
          key="divider"
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <Separator className="flex-1" />
          <span>{t("login.orEmail")}</span>
          <Separator className="flex-1" />
        </div>
        {form}
      </div>
    );
  }

  return (
    <div className="space-y-s3">
      {form}
      {options.isError ? (
        <p key="failed" className="text-xs text-muted-foreground">
          {t("login.optionsFailed")}
        </p>
      ) : null}
      {roles ? (
        <div key="roles-wrap" className="space-y-s3">
          <Separator />
          {roles}
        </div>
      ) : null}
    </div>
  );
}
