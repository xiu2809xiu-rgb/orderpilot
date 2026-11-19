import { Brand } from "../shell/Brand";
import { ThemeSwitch } from "../shell/ThemeSwitch";
import { SignInCard } from "../signin/SignInCard";
import { SignInGround } from "../signin/SignInGround";
import { SignInHero } from "../signin/SignInHero";
import "../../styles/signin.css";

/**
 * The sign-in page: the promise on the left, a glass card with the form on
 * the right. On a phone the order is the bar, the form, then the promise.
 * The document order is the keyboard order: the form comes first and the
 * theme switch last, though the switch sits at the top right of the page.
 * `overflow-clip`: the edge light is a 90 px box that runs past the card, and
 * where it leaves the window it must not make the page scroll sideways.
 */
export function LoginPage() {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="relative isolate grid min-h-dvh overflow-clip grid-cols-1 gap-8 px-4 py-4 outline-none sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr_auto] lg:gap-x-14 lg:gap-y-10 lg:px-14 lg:py-14"
    >
      <SignInGround />
      <header
        className="dx-panel flex items-center gap-3 col-start-1 row-start-1 self-start px-4 py-2.5 pr-16"
        style={{ borderRadius: "var(--radius-card)" }}
      >
        <Brand collapsed={false} />
      </header>
      <SignInCard />
      <SignInHero />
      {/* Last in the document so the keyboard meets the form first, drawn in the bar's own cell. Positioned, because the glass bar is a stacking context and would paint over it. */}
      <div className="signin-theme relative col-start-1 row-start-1 m-1.5 mr-2 self-start justify-self-end">
        <ThemeSwitch />
      </div>
    </main>
  );
}
