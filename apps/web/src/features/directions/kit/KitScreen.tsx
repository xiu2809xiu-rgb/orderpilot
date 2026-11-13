import { useTranslation } from "react-i18next";
import { CardSection } from "./CardSection";
import { ColourSection } from "./ColourSection";
import { ControlsSection } from "./ControlsSection";
import { ShapeSection } from "./ShapeSection";
import { StatusSection } from "./StatusSection";
import { TableSection } from "./TableSection";
import { TypeSection } from "./TypeSection";

/**
 * The kit sheet: the current direction's tokens and parts, read live. Step F2
 * adds the kit items (React Bits, ReUI, Magic UI) to this page.
 */
export default function KitScreen() {
  const { t } = useTranslation("directions-kit");
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 max-w-prose">
        <h1 className="fs-28 font-semibold">{t("title")}</h1>
        <p className="fs-14 mt-2 text-muted-foreground">{t("intro")}</p>
      </header>
      <div className="grid gap-5 lg:grid-cols-2">
        <ColourSection />
        <TypeSection />
        <ShapeSection />
        <ControlsSection />
        <div className="flex flex-col gap-5">
          <StatusSection />
          <CardSection />
        </div>
        <TableSection />
      </div>
    </div>
  );
}
