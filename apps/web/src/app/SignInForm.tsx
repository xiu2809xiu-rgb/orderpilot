import { zodResolver } from "@hookform/resolvers/zod";
import type { Role, Session } from "@orderpilot/shared";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { demoLogin, fetchAuthOptions, login } from "@/lib/api/auth";
import { describeError } from "@/lib/errors";
import { cn } from "@/lib/utils";

interface SignInFormProps {
  /** Prefills the email, such as the person whose session just ended. */
  defaultEmail?: string;
  onSignedIn?: (session: Session) => void;
  /** Makes the field ids unique when the form is on screen twice. */
  idPrefix?: string;
}

/** Email and password, plus the demo roles when the API says demo mode is on. */
export function SignInForm({
  defaultEmail = "",
  onSignedIn,
  idPrefix = "signin",
}: SignInFormProps) {
  const { t } = useTranslation();
  const [failure, setFailure] = useState<{
    message: string;
    traceId: string | undefined;
  } | null>(null);
  const options = useQuery({
    queryKey: ["auth", "options"],
    queryFn: fetchAuthOptions,
    staleTime: 5 * 60_000,
    retry: false,
  });

  // Messages are translated here, so the schema is built per language.
  const schema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .min(1, t("validation.required"))
          .pipe(z.email(t("validation.email"))),
        password: z.string().min(1, t("validation.required")),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: defaultEmail, password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function run(action: () => Promise<Session>) {
    setFailure(null);
    try {
      // Await first: `a?.(await b)` skips the await when `a` is undefined.
      const session = await action();
      onSignedIn?.(session);
    } catch (error) {
      setFailure(describeError(error, t));
    }
  }

  const demo = options.data?.demoMode ? options.data : null;

  return (
    <div className="space-y-s3">
      <form
        noValidate
        className="space-y-s2"
        onSubmit={(event) => {
          void form.handleSubmit((values) => run(() => login(values)))(event);
        }}
      >
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-email`}>{t("login.email")}</Label>
          <Input
            id={`${idPrefix}-email`}
            type="email"
            autoComplete="username"
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={
              errors.email ? `${idPrefix}-email-error` : undefined
            }
            {...form.register("email")}
          />
          {errors.email ? (
            <p
              id={`${idPrefix}-email-error`}
              className="text-xs text-destructive"
            >
              {errors.email.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-password`}>{t("login.password")}</Label>
          <Input
            id={`${idPrefix}-password`}
            type="password"
            autoComplete="current-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={
              errors.password ? `${idPrefix}-password-error` : undefined
            }
            {...form.register("password")}
          />
          {errors.password ? (
            <p
              id={`${idPrefix}-password-error`}
              className="text-xs text-destructive"
            >
              {errors.password.message}
            </p>
          ) : null}
        </div>
        {failure ? (
          <div role="alert" className="text-sm text-destructive">
            <p>{failure.message}</p>
            {failure.traceId ? (
              <p className="text-xs text-muted-foreground">
                {t("errors.traceId")}:{" "}
                <code className="font-mono">{failure.traceId}</code>
              </p>
            ) : null}
          </div>
        ) : null}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t("login.submitting") : t("login.submit")}
        </Button>
      </form>

      {options.isError ? (
        <p className="text-xs text-muted-foreground">
          {t("login.optionsFailed")}
        </p>
      ) : null}

      {demo ? (
        <section aria-labelledby={`${idPrefix}-demo`} className="space-y-s2">
          <Separator />
          <div className="space-y-1">
            <h2 id={`${idPrefix}-demo`} className="text-sm font-medium">
              {t("login.demoTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("login.demoHint")}
            </p>
          </div>
          <ul
            aria-label={t("login.demoRolesLabel")}
            className={cn("grid gap-2 sm:grid-cols-3")}
          >
            {demo.demoRoles.map(({ role, displayName }) => (
              <li key={role}>
                <DemoRoleButton
                  role={role}
                  displayName={displayName}
                  disabled={isSubmitting}
                  onPick={() => run(() => demoLogin(role))}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function DemoRoleButton({
  role,
  displayName,
  disabled,
  onPick,
}: {
  role: Role;
  displayName: string;
  disabled: boolean;
  onPick: () => Promise<void>;
}) {
  const { t } = useTranslation();
  return (
    <Button
      type="button"
      variant="outline"
      className="h-auto w-full flex-col items-start gap-0 px-3 py-2 text-left"
      disabled={disabled}
      onClick={() => {
        void onPick();
      }}
    >
      <span className="text-sm font-medium">{t(`roles.${role}`)}</span>
      <span className="text-xs font-normal text-muted-foreground">
        {displayName}
      </span>
    </Button>
  );
}
