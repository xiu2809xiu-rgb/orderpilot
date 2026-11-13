import { useTranslation } from "react-i18next";
import { BorderBeam } from "@/components/kit/BorderBeam";
import { RoleButtons } from "./RoleButtons";
import { SignInForm } from "./SignInForm";
import { SignInGround } from "./SignInGround";
import { SignInHero } from "./SignInHero";

/**
 * The sign-in page, in show mode: the aurora ground, the promise on
 * the left and the form on the right, with the nine demo roles under it. It
 * fills the window, without the side panel or the top bar. It is a
 * prototype: nothing here signs anyone in.
 */
export default function SignInScreen() {
  const { t } = useTranslation("directions-home");
  return (
    <div className="relative isolate grid min-h-full lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <SignInGround />
      <SignInHero />
      <section
        aria-labelledby="dx-signin-form"
        className="flex min-w-0 items-center justify-center px-6 py-8 lg:px-14"
      >
        <div className="dx-card dx-card-work dx-signin-card relative flex w-full max-w-136 flex-col gap-6 p-6">
          <h2 id="dx-signin-form" className="fs-20 font-semibold">
            {t("signin.form.title")}
          </h2>
          <SignInForm />
          <div className="border-t border-border pt-5">
            <RoleButtons />
          </div>
          <p className="fs-12 text-muted-foreground">{t("signin.data")}</p>
          <BorderBeam size={90} duration={8} />
        </div>
      </section>
    </div>
  );
}
