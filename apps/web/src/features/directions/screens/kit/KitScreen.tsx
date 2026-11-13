import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/parts/PageHeader";
import { CardSection } from "./CardSection";
import { ColourSection } from "./ColourSection";
import { ControlsSection } from "./ControlsSection";
import { GroundsSection } from "./items/GroundsSection";
import { KitSummary } from "./items/KitSummary";
import { MagicUiSection } from "./items/MagicUiSection";
import { PartsSection } from "./items/PartsSection";
import { ReactBitsSection } from "./items/ReactBitsSection";
import { ReuiSection } from "./items/ReuiSection";
import { SparkKitSection } from "./items/SparkKitSection";
import { ShapeSection } from "./ShapeSection";
import { StatusSection } from "./StatusSection";
import { TableSection } from "./TableSection";
import { TypeSection } from "./TypeSection";

/**
 * The kit sheet: the design's tokens, then every kit item in use
 * (Magic UI, React Bits, ReUI) and the product parts built on them, all live.
 * It is the proof that the kits are used.
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
        <KitSummary />
        <MagicUiSection />
        <ReactBitsSection />
        <ReuiSection />
        <SparkKitSection />
        <GroundsSection />
        <PartsSection />
      </div>
    </div>
  );
}
