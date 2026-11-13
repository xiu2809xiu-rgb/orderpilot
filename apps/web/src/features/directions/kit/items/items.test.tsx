import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { GroundsSection } from "./GroundsSection";
import { MagicUiSection } from "./MagicUiSection";
import { ReactBitsSection } from "./ReactBitsSection";
import { ReuiSection } from "./ReuiSection";

const SOURCES = import.meta.glob<string>("../*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
});

// The files in kit/ that are a vendor's item, with the vendor's licence.
const ITEM_FILES: Record<string, RegExp> = {
  NumberTicker: /Magic UI \/ number-ticker\. Licence: MIT\./,
  BlurFade: /Magic UI \/ blur-fade\. Licence: MIT\./,
  BorderBeam: /Magic UI \/ border-beam\. Licence: MIT\./,
  ShineBorder: /Magic UI \/ shine-border\. Licence: MIT\./,
  AnimatedList: /Magic UI \/ animated-list\. Licence: MIT\./,
  ShinyText: /Magic UI \/ animated-shiny-text\. Licence: MIT\./,
  CircularProgress:
    /Magic UI \/ animated-circular-progress-bar\. Licence: MIT\./,
  DotPattern: /Magic UI \/ dot-pattern\. Licence: MIT\./,
  GridPattern: /Magic UI \/ grid-pattern\. Licence: MIT\./,
  SplitFlap:
    /React Bits \/ SplitFlapText\. Licence: MIT with the Commons Clause\./,
  GradientText:
    /React Bits \/ GradientText\. Licence: MIT with the Commons Clause\./,
  BlurText: /React Bits \/ BlurText\. Licence: MIT with the Commons Clause\./,
  SpotlightCard:
    /React Bits \/ SpotlightCard\. Licence: MIT with the Commons Clause\./,
  GlassSurface:
    /React Bits \/ GlassSurface\. Licence: MIT with the Commons Clause\./,
  StatusMark:
    /React Bits \/ StatusMark\. Licence: MIT with the Commons Clause\./,
  LatticeLoader:
    /React Bits \/ LatticeLoader\. Licence: MIT with the Commons Clause\./,
  ThoughtLine:
    /React Bits \/ ThoughtLine\. Licence: MIT with the Commons Clause\./,
  HoldButton:
    /React Bits \/ HoldButton\. Licence: MIT with the Commons Clause\./,
  Dither: /React Bits \/ Dither\. Licence: MIT with the Commons Clause\./,
  Aurora: /React Bits \/ Aurora\. Licence: MIT with the Commons Clause\./,
  Stepper: /ReUI \/ stepper\. Licence: MIT\./,
  Timeline: /ReUI \/ timeline\. Licence: MIT\./,
  Badge: /ReUI \/ badge\. Licence: MIT\./,
  Frame: /ReUI \/ frame\. Licence: MIT\./,
  Alert: /ReUI \/ alert\. Licence: MIT\./,
  FileType: /ReUI \/ file-type\. Licence: MIT\./,
};

describe("the kit items", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces(["directions-kit-items"]);
  });

  it.each(Object.entries(ITEM_FILES))(
    "%s names its vendor, item and licence in its first line",
    (file, header) => {
      const source = SOURCES[`../${file}.tsx`];
      expect(source, `${file}.tsx exists`).toBeDefined();
      const first = (source ?? "").split("\n")[0] ?? "";
      expect(first).toMatch(/^\/\/ Kit: /);
      expect(first).toMatch(header);
      expect(first).toContain("Adapted to OrderPilot's tokens.");
    },
  );

  it("uses no icon package other than Lucide", () => {
    for (const [path, source] of Object.entries(SOURCES)) {
      expect(source, path).not.toMatch(/hugeicons/);
    }
  });

  it("the kit sheet lists every item with its vendor and licence", () => {
    render(
      <>
        <MagicUiSection />
        <ReactBitsSection />
        <ReuiSection />
        <GroundsSection />
      </>,
    );
    const figures = screen.getAllByRole("figure");
    // Twenty-six items; the dot pattern is shown once, among the grounds.
    expect(figures.length).toBe(26);
    const names = figures.map(
      (figure) => figure.querySelector("figcaption span")?.textContent,
    );
    expect(new Set(names).size).toBe(26);
    expect(screen.getAllByText("Magic UI, MIT").length).toBe(9);
    expect(
      screen.getAllByText("React Bits, MIT with the Commons Clause").length,
    ).toBe(11);
    expect(screen.getAllByText("ReUI, MIT").length).toBe(6);
  });
});
