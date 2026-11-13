import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/kit/Alert";

const MIN_PASSWORD = 8;

/**
 * Email and password, laid out by the form rules: the label is always shown,
 * a line of help stays under the field while typing, the check runs when a
 * field loses focus, and its message says how to fix it. The password has an
 * eye. It is a prototype: a valid form says nothing was sent.
 */
export function SignInForm() {
  const { t } = useTranslation("directions-home");
  const id = useId();
  const [shown, setShown] = useState(false);
  const [sent, setSent] = useState(false);
  const schema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .min(1, t("signin.form.emailRequired"))
          .pipe(z.email(t("signin.form.emailInvalid"))),
        password: z
          .string()
          .min(1, t("signin.form.passwordRequired"))
          .min(MIN_PASSWORD, t("signin.form.passwordShort")),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;
  const Eye_ = shown ? EyeOff : Eye;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        void form.handleSubmit(() => {
          setSent(true);
        })(event);
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-email`} className="fs-14">
          {t("signin.form.email")}
        </Label>
        <Input
          id={`${id}-email`}
          type="email"
          autoComplete="username"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={`${id}-email-help${errors.email ? ` ${id}-email-error` : ""}`}
          {...form.register("email", {
            onChange: () => {
              setSent(false);
            },
          })}
        />
        <p id={`${id}-email-help`} className="fs-14 text-muted-foreground">
          {t("signin.form.emailHelp")}
        </p>
        {errors.email ? (
          <p id={`${id}-email-error`} className="fs-14 text-destructive">
            {errors.email.message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-password`} className="fs-14">
          {t("signin.form.password")}
        </Label>
        <div className="relative">
          <Input
            id={`${id}-password`}
            type={shown ? "text" : "password"}
            autoComplete="current-password"
            className="pr-11"
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={`${id}-password-help${errors.password ? ` ${id}-password-error` : ""}`}
            {...form.register("password", {
              onChange: () => {
                setSent(false);
              },
            })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute inset-y-0 right-0 size-9 pointer-coarse:size-11"
            aria-label={t(shown ? "signin.form.hide" : "signin.form.show")}
            aria-pressed={shown}
            aria-controls={`${id}-password`}
            onClick={() => {
              setShown((value) => !value);
            }}
          >
            <Eye_ aria-hidden="true" />
          </Button>
        </div>
        <p id={`${id}-password-help`} className="fs-14 text-muted-foreground">
          {t("signin.form.passwordHelp")}
        </p>
        {errors.password ? (
          <p id={`${id}-password-error`} className="fs-14 text-destructive">
            {errors.password.message}
          </p>
        ) : null}
      </div>
      {sent ? (
        <Alert variant="info">
          <AlertDescription>{t("signin.form.sent")}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" className="w-full pointer-coarse:h-11">
        {t("signin.form.submit")}
      </Button>
    </form>
  );
}
