import { ShineBorder } from "@/components/kit/ShineBorder";
import { SignInCardBody } from "./SignInCardBody";

/** The glass card the form sits on, with a slow shine along its edge. */
export function SignInCard() {
  return (
    <section
      aria-labelledby="signin-title"
      className="col-start-1 row-start-2 flex min-w-0 items-center justify-center lg:col-start-2 lg:items-start lg:pt-11 lg:row-span-3 lg:row-start-1"
    >
      <div className="dx-card dx-card-work relative w-full max-w-136 p-5 sm:p-6">
        <SignInCardBody />
        <ShineBorder
          borderWidth={1.5}
          duration={12}
          shineColor={["var(--ring)", "var(--info)"]}
        />
      </div>
    </section>
  );
}
