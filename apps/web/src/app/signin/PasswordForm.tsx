import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, type ReactNode } from "react";
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
  /** The failure message, drawn just above the button. */
  alert: ReactNode;
  /** The demo grid is the main way in, so this button is the quiet one. */
  secondary?: boolean;
}

/** Email and password, checked in the browser before anything is sent. */
export function PasswordForm({
  defaultEmail,
  idPrefix,
  onSubmit,
  busy,
  alert,
  secondary = false,
}: PasswordFormProps) {
  const { t } = useTranslation();
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

  return (
    <form
      noValidate
      className="space-y-s2"
      onSubmit={(event) => {
        void form.handleSubmit(onSubmit)(event);
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
      {alert}
      <Button
        type="submit"
        variant={secondary ? "secondary" : "default"}
        className="w-full"
        disabled={busy || isSubmitting}
      >
        {isSubmitting ? t("login.submitting") : t("login.submit")}
      </Button>
    </form>
  );
}
