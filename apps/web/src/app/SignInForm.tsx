import type { Role, Session, TwoStepVerifyResponse } from "@orderpilot/shared";
import { ChevronDown } from "lucide-react";
import { lazy, Suspense, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/common/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { demoLogin, finishSignIn, login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { describeError } from "@/lib/errors";
import { DemoRoles } from "./signin/DemoRoles";
import { PasswordForm } from "./signin/PasswordForm";
import { RolesPlaceholder } from "./signin/RolesPlaceholder";
import { SignInFailure, type Failure } from "./signin/SignInFailure";
import { useAuthOptions } from "./signin/useAuthOptions";
import type { TwoStepFailure } from "./two-step/twoStepFailure";
import "./signin/preloadWords";

// The second step, its field and their styles load only when a password
// sign-in asks for one: the sign-in page's first load stays small.
const TwoStepStep = lazy(() =>
  import("./signin/TwoStepStep").then((m) => ({ default: m.TwoStepStep })),
);

interface SignInFormProps {
  /** Prefills the email, such as the person whose session just ended. */
  defaultEmail?: string;
  onSignedIn?: (session: Session) => void;
  /** Makes the field ids unique when the form is on screen twice. */
  idPrefix?: string;
}

/** Holds the field's place while the step's chunk arrives, so the card does not jump. */
function TwoStepFallback({ label }: { label: string }) {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">{label}</span>
      <Skeleton aria-hidden="true" className="h-7 w-2/5" />
      <Skeleton aria-hidden="true" className="h-14 w-full" />
    </div>
  );
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
  // The second step of a password sign-in is open. Everything else stays
  // mounted and is only hidden, so the email keeps its place for "Back".
  const [challenge, setChallenge] = useState(false);
  const [clearSignal, setClearSignal] = useState(0);
  const [focusSignal, setFocusSignal] = useState(0);

  function openChallenge() {
    setFailure(null);
    setClearSignal((n) => n + 1);
    setChallenge(true);
  }

  function closeChallenge(ended: TwoStepFailure | null) {
    setChallenge(false);
    setFocusSignal((n) => n + 1);
    if (ended) setFailure({ ...ended, from: "password" });
  }

  function verified(response: TwoStepVerifyResponse) {
    const session = finishSignIn(response.data);
    const { method, recoveryCodesLeft, lockedRecently } = response.meta;
    if (method === "recovery-code") {
      toast.done(
        recoveryCodesLeft === 0
          ? t("twoStep.recoveryUsedLast")
          : t("twoStep.recoveryUsed", { count: recoveryCodesLeft }),
      );
    }
    if (lockedRecently) toast.done(t("twoStep.recentLock"));
    onSignedIn?.(session);
  }

  async function run(action: () => Promise<Session>, role: Role | null) {
    setFailure(null);
    setBusy(true);
    setPending(role);
    try {
      // Await first: `a?.(await b)` skips the await when `a` is undefined.
      const session = await action();
      onSignedIn?.(session);
    } catch (error) {
      if (
        role === null &&
        error instanceof ApiError &&
        error.code === "TWO_STEP_REQUIRED"
      ) {
        openChallenge();
        return;
      }
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
      <div className="flex flex-col gap-3" hidden={challenge}>
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
              clearPasswordSignal={clearSignal}
              focusPasswordSignal={focusSignal}
              onSubmit={(values) => run(() => login(values), null)}
            />
          </div>
        </div>
      </div>
      {challenge ? (
        <Suspense fallback={<TwoStepFallback label={t("twoStep.loading")} />}>
          <TwoStepStep
            idPrefix={idPrefix}
            onVerified={verified}
            onEnded={closeChallenge}
            onBack={() => {
              closeChallenge(null);
            }}
          />
        </Suspense>
      ) : null}
      <p role="status" className="sr-only">
        {pending ? t("login.submitting") : ""}
      </p>
    </div>
  );
}
