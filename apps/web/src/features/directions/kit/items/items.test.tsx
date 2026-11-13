import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { MemoryRouter, Route, Routes } from "react-router";
import { GroundsSection } from "./GroundsSection";
import { KitSummary } from "./KitSummary";
import { PartsSection } from "./PartsSection";
import { itemsOf, KIT_ITEMS } from "./registry";
import { MagicUiSection } from "./MagicUiSection";
import { ReactBitsSection } from "./ReactBitsSection";
import { ReuiSection } from "./ReuiSection";
import { SparkKitSection } from "./SparkKitSection";

const SOURCES = import.meta.glob<string>("../*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
});
const ORB_SOURCES = import.meta.glob<string>(
  ["../../spark/orb/LiquidOrb.ts", "../../spark/orb/LICENSE"],
  { query: "?raw", import: "default", eager: true },
);

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
  FileDropzone: /ReUI \/ use-file-upload\. Licence: MIT\./,
  PromptBar: /React Bits \/ PromptBar\. Licence: MIT with the Commons Clause\./,
  Orb: /React Bits \/ Orb\. Licence: MIT with the Commons Clause\./,
};

describe("the kit items", () => {
  beforeAll(async () => {
    await i18n.loadNamespaces(["directions-kit-items", "directions-parts"]);
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

  it("names the source and licence of the WebGPU orb and keeps its licence file beside it", () => {
    const code = ORB_SOURCES["../../spark/orb/LiquidOrb.ts"] ?? "";
    const first = code.split(String.fromCharCode(10))[0] ?? "";
    expect(first).toContain("github.com/LerSent001/orb");
    expect(first).toContain("Licence: MIT, Copyright (c) 2026 LerSent001");
    const licence = ORB_SOURCES["../../spark/orb/LICENSE"] ?? "";
    expect(licence).toContain("MIT License");
    expect(licence).toContain("Copyright (c) 2026 LerSent001");
  });

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
        <SparkKitSection />
        <GroundsSection />
      </>,
    );
    const figures = screen.getAllByRole("figure");
    // Thirty items; the dot pattern is shown once, among the grounds.
    expect(figures.length).toBe(30);
    const names = figures.map(
      (figure) => figure.querySelector("figcaption span")?.textContent,
    );
    expect(new Set(names).size).toBe(30);
    expect(screen.getAllByText("Magic UI, MIT").length).toBe(9);
    expect(
      screen.getAllByText("React Bits, MIT with the Commons Clause").length,
    ).toBe(13);
    expect(screen.getAllByText("ReUI, MIT").length).toBe(7);
    expect(screen.getAllByText("github.com/LerSent001/orb, MIT").length).toBe(
      1,
    );
  });

  it("shows exactly the items in the registry, no more and no fewer", () => {
    render(
      <>
        <MagicUiSection />
        <ReactBitsSection />
        <ReuiSection />
        <SparkKitSection />
        <GroundsSection />
      </>,
    );
    const shown = screen
      .getAllByRole("figure")
      .map((figure) => figure.querySelector("figcaption span")?.textContent);
    const expected = KIT_ITEMS.map((item) =>
      i18n.t(`items.${item.key}`, { ns: "directions-kit-items" }),
    );
    expect([...shown].sort()).toEqual([...expected].sort());
    expect(
      itemsOf("magic") + itemsOf("bits") + itemsOf("reui") + itemsOf("orb"),
    ).toBe(KIT_ITEMS.length);
  });

  it("has a file in kit/ for every item in the registry", () => {
    const files = new Set(Object.keys(ITEM_FILES));
    const inKit = KIT_ITEMS.filter((item) => !item.outside);
    for (const { key } of inKit) {
      const file = `${key[0]?.toUpperCase() ?? ""}${key.slice(1)}`;
      expect(files.has(file), `${file}.tsx is a listed kit file`).toBe(true);
    }
    expect(files.size).toBe(inKit.length);
  });

  it("summarises the kits with their counts and a button for each section", () => {
    render(
      <MemoryRouter initialEntries={["/directions/ink/kit"]}>
        <Routes>
          <Route
            path="/directions/:direction/:screen"
            element={<KitSummary />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(
      screen.getByText(/30 items from three kits and one orb/),
    ).toBeInTheDocument();
    expect(screen.getByText("Magic UI, MIT")).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Jump to a section" });
    expect(within(nav).getAllByRole("button")).toHaveLength(6);
  });

  it("shows each product part with what it follows or is built on", () => {
    render(
      <MemoryRouter initialEntries={["/directions/paper/kit"]}>
        <Routes>
          <Route
            path="/directions/:direction/:screen"
            element={<PartsSection />}
          />
        </Routes>
      </MemoryRouter>,
    );
    // The full rail and three small ones.
    expect(
      screen.getAllByRole("list", { name: "Sales order journey" }),
    ).toHaveLength(4);
    expect(
      screen.getByRole("list", { name: "Purchase order journey" }),
    ).toBeInTheDocument();
    expect(screen.getByText("KPI tile")).toBeInTheDocument();
    expect(screen.getByText("No documents waiting")).toBeInTheDocument();
    // The estimate line is arithmetic on the committed step times.
    expect(
      screen.getByText(
        /Expected to ship in 9 days, from how long each step took on 120 orders/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("1,020")).toBeInTheDocument();
  });
});
