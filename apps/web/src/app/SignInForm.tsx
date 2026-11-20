import type { Role, Session } from "@orderpilot/shared";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { demoLogin, login } from "@/lib/api/auth";
import { describeError } from "@/lib/errors";
import { DemoRoles } from "./signin/DemoRoles";
import { PasswordForm } from "./signin/PasswordForm";
import { RolesPlaceholder } from "./signin/RolesPlaceholder";
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
 * With demo mode on, the six teams lead and the email form waits behind
 * "Sign in with email" (open from the start when the email is known, such as
 * after a session ended). While that is still unknown, a placeholder of the
 * roles' size holds their place and the form is not drawn. With demo mode
 * off, or when the options cannot be loaded, the form is simply there. The
 * form stays mounted through all of it, hidden when closed, so what a person
 * is typing keeps its place and its focus when the roles arrive.
 */
export function SignInForm({
  defaultEmail = "",
  onSignedIn,
  idPrefix = "signin",
}: SignInFormProps) {
  // describeError reads the common error texts; the form's own words are in signin.
  const { t: tCommon } = useTranslation();
  const { t } = useTranslation("signin");
  const [failure, setFailure] = useState<
    (Failure & { from: "role" | "password" }) | null
  >(null);
  // Anyone who has already put a hand to the form keeps it open.
  const [emailOpen, setEmailOpen] = useState(defaultEmail !== "");
  const formId = useId();
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
      setFailure({
        ...describeError(error, tCommon),
        from: role ? "role" : "password",
      });
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  const demo = options.data?.demoMode ? options.data : null;
  // Until the options answer, the form is not drawn: with demo mode on it
  // would show and then fold away. If demo mode is off, or the request failed,
  // it is there as before. A person already in it (an expired session) keeps it.
  const formShown = emailOpen || (!options.isPending && demo === null);
  // A failed password is drawn at the form's button; a failed role click is
  // drawn under the roles, so it is seen whichever part is open.
  const inForm = failure?.from === "password" && formShown;
  const failureNode = failure ? <SignInFailure failure={failure} /> : null;

  return (
    <div className="flex flex-col gap-3">
      {options.isPending ? <RolesPlaceholder /> : null}
      {demo ? (
        <DemoRoles
          roles={demo.demoRoles}
          headingId={`${idPrefix}-demo`}
          disabled={busy}
          pending={pending}
          onPick={(role) => {
            void run(() => demoLogin(role), role);
          }}
        />
      ) : null}
      {failure && !inForm ? failureNode : null}
      {options.isError ? (
        <p className="fs-14 text-muted-foreground">
          {t("login.optionsFailed")}
        </p>
      ) : null}
      <div className="flex flex-col gap-3">
        {demo ? (
          <button
            type="button"
            aria-expanded={formShown}
            aria-controls={formId}
            onClick={() => {
              setEmailOpen(!formShown);
            }}
            className="signin-toggle"
          >
            <ChevronDown
              aria-hidden="true"
              className={cn("size-4", formShown && "rotate-180")}
            />
            {t("login.emailToggle")}
          </button>
        ) : options.isPending ? (
          // Holds the toggle's room, so the card keeps its height when it arrives.
          <Skeleton aria-hidden="true" className="h-9 w-40" />
        ) : null}
        <div
          id={formId}
          hidden={!formShown}
          onFocusCapture={() => {
            setEmailOpen(true);
          }}
        >
          <PasswordForm
            defaultEmail={defaultEmail}
            idPrefix={idPrefix}
            busy={busy}
            alert={inForm ? failureNode : null}
            onEdit={() => {
              setFailure(null);
            }}
            onSubmit={(values) => run(() => login(values), null)}
          />
        </div>
      </div>
      <p role="status" className="sr-only">
        {pending ? t("login.submitting") : ""}
      </p>
    </div>
  );
}
