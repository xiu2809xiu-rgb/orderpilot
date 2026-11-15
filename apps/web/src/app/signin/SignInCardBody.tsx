import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { SignInForm } from "../SignInForm";
import { SignInDemoNote } from "./SignInDemoNote";

function Title() {
  const { t } = useTranslation("signin");
  return (
    <h2 id="signin-title" className="fs-20 font-semibold">
      {t("login.title")}
    </h2>
  );
}

/** Stands where the card's words will be, for the moment their file is on its way. */
function Placeholder() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <Skeleton className="h-7 w-3/5" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

/**
 * The title, the form and the demo note. They use the sign-in words, which are
 * a small file of their own: the card's frame is on screen first and this fills
 * it as soon as they arrive.
 */
export function SignInCardBody() {
  return (
    <Suspense fallback={<Placeholder />}>
      <div className="flex flex-col gap-6">
        <Title />
        <div className="flex flex-col gap-4">
          <SignInForm />
          <SignInDemoNote />
        </div>
      </div>
    </Suspense>
  );
}
