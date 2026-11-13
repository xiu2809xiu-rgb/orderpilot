import { useTranslation } from "react-i18next";
import { PageHeader } from "../parts/PageHeader";
import { CardSection } from "./CardSection";
import { ColourSection } from "./ColourSection";
import { ControlsSection } from "./ControlsSection";
import { GroundsSection } from "./items/GroundsSection";
import { MagicUiSection } from "./items/MagicUiSection";
import { ReactBitsSection } from "./items/ReactBitsSection";
import { ReuiSection } from "./items/ReuiSection";
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
    <div className="dx-sheet py-8">
      <PageHeader title={t("title")} intro={t("intro")} />
      <div className="dx-grid grid gap-5 lg:grid-cols-2">
        <ColourSection />
        <TypeSection />
        <ShapeSection />
        <ControlsSection />
        <div className="dx-grid-cell flex flex-col gap-5">
          <StatusSection />
          <CardSection />
        </div>
        <TableSection />
      </div>
      <div className="dx-grid mt-5 grid gap-5">
        <MagicUiSection />
        <ReactBitsSection />
        <ReuiSection />
        <GroundsSection />
      </div>
    </div>
  );
}
