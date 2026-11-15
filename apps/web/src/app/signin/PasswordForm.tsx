import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PasswordFormProps {
  defaultEmail: string;
  idPrefix: string;
  /** Runs the sign-in and shows any failure; the form only supplies values. */
  onSubmit: (values: { email: string; password: string }) => Promise<void>;
  /** True while any sign-in is under way, demo or password. */
  busy: boolean;
  /** The failure, drawn just above the button. */
  alert: ReactNode;
}

/**
 * Email and password, checked in the browser before anything is sent. A field
 * is checked when it loses focus and again on submit, and its message says how
 * to fix it. The password has an eye, so a wrong one can be seen before it is
 * sent. There is no length rule here: the server decides what a password is.
 */
export function PasswordForm({
  defaultEmail,
  idPrefix,
  onSubmit,
  busy,
  alert,
}: PasswordFormProps) {
  const { t } = useTranslation("signin");
  const [shown, setShown] = useState(false);
  // Messages are translated here, so the schema is built per language.
  const schema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .min(1, t("login.emailRequired"))
          .pipe(z.email(t("login.emailInvalid"))),
        password: z.string().min(1, t("login.passwordRequired")),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { email: defaultEmail, password: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const EyeIcon = shown ? EyeOff : Eye;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        void form.handleSubmit(onSubmit)(event);
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-email`}>{t("login.email")}</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          autoComplete="username"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={
            errors.email ? `${idPrefix}-email-error` : undefined
          }
          className="pointer-coarse:h-11"
          {...form.register("email")}
        />
        {errors.email ? (
          <p id={`${idPrefix}-email-error`} className="fs-14 text-destructive">
            {errors.email.message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-password`}>{t("login.password")}</Label>
        <div className="relative">
          <Input
            id={`${idPrefix}-password`}
            type={shown ? "text" : "password"}
            autoComplete="current-password"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={
              errors.password ? `${idPrefix}-password-error` : undefined
            }
            className="pr-11 pointer-coarse:h-11"
            {...form.register("password")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute inset-y-0 right-0 size-9 pointer-coarse:size-11"
            aria-label={t("login.showPassword")}
            aria-pressed={shown}
            aria-controls={`${idPrefix}-password`}
            onClick={() => {
              setShown((value) => !value);
            }}
          >
            <EyeIcon aria-hidden="true" />
          </Button>
        </div>
        {errors.password ? (
          <p
            id={`${idPrefix}-password-error`}
            className="fs-14 text-destructive"
          >
            {errors.password.message}
          </p>
        ) : null}
      </div>
      {alert}
      <Button
        type="submit"
        className="w-full pointer-coarse:h-11"
        disabled={busy || isSubmitting}
      >
        {isSubmitting ? t("login.submitting") : t("login.submit")}
      </Button>
    </form>
  );
}
