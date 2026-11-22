import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Lock,
  Play,
  TriangleAlert,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { MemoryRouter } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";
import { PageHeader, SectionCard } from "@/components/common";
import i18n from "@/i18n";
import { Section } from "@/components/parts/Section";
import { KpiTile } from "@/components/parts/KpiTile";
import { PageHeader as PartsPageHeader } from "@/components/parts/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { HomeHeader } from "@/features/directions/screens/home/HomeHeader";
import { HomeSection } from "@/features/directions/screens/home/HomeSection";

beforeAll(async () => {
  await i18n.loadNamespaces(["directions-parts"]);
});

const dir = import.meta.dirname;
const src = path.join(dir, "..");
const read = (file: string) => readFileSync(path.join(src, file), "utf8");
const css = readFileSync(path.join(dir, "optical.css"), "utf8");
/** The rules without the comments, which talk about the trim at length. */
const code = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Every rule of optical.css outside its @supports block. */
const outsideSupports = code.replace(
  /@supports \(text-box[\s\S]*?\.icon-after-trim \{[^}]*\}\s*\}/,
  "",
);

describe("the trim", () => {
  it("is only ever written inside @supports, so a browser without it looks as before", () => {
    expect(css).toContain("@supports (text-box: trim-start cap alphabetic)");
    expect(outsideSupports).not.toContain("text-box");
    expect(outsideSupports).not.toContain("text-trim-start");
    expect(outsideSupports).not.toContain("icon-after-trim");
  });

  it("trims the start only, never the end, so a gradient title keeps its descenders", () => {
    expect(css).toContain("text-box: trim-start cap alphabetic");
    expect(css).not.toContain("trim-both");
    expect(css).not.toContain("trim-end");
  });

  it("gives back what it trimmed, so a card keeps its height", () => {
    expect(css).toContain(
      "padding-block-end: calc((0.5lh - 0.355em) * var(--optical-keep, 1))",
    );
    expect(read("styles/tokens.css")).toContain("--optical-keep: 1;");
  });

  it("is used by the card heads and the tiles, not by controls", () => {
    render(
      <MemoryRouter>
        <Section title="Section head">body</Section>
        <HomeSection title="Home head">body</HomeSection>
        <SectionCard title="Card head">body</SectionCard>
        <SectionCard title="Card with buttons" actions={<span>Add</span>}>
          body
        </SectionCard>
        <KpiTile label="Orders waiting" value={4} />
      </MemoryRouter>,
    );
    for (const name of ["Section head", "Home head", "Card head"]) {
      expect(screen.getByRole("heading", { name }).className, name).toContain(
        "text-trim-start",
      );
    }
    // Beside buttons a title is centred on them, which the trim would undo.
    expect(
      screen.getByRole("heading", { name: "Card with buttons" }).className,
    ).not.toContain("text-trim-start");
    expect(screen.getByText("Orders waiting").className).toContain(
      "text-trim-start",
    );
    for (const size of ["default", "xs", "sm", "lg"] as const) {
      expect(buttonVariants({ size }), size).not.toContain("text-trim");
    }
  });

  it("moves the arrow of a count tile up with its trimmed label", () => {
    const tile = read("features/directions/screens/home/CountTile.tsx");
    expect(tile).toContain('<span className="text-trim-start">{label}</span>');
    expect(tile).toContain("icon-after-trim mt-0.5");
  });
});

describe("heading start", () => {
  function inset(element: HTMLElement): string {
    return element.style.getPropertyValue("--optical-inset");
  }

  it("sets each title's own first-letter inset on every header", () => {
    render(
      <MemoryRouter>
        <PageHeader title="Needs you" />
        <PageHeader title="Gallery" headingLevel={2} />
        <PartsPageHeader title="Orders" />
        <HomeHeader title="Good morning, Priya" />
      </MemoryRouter>,
    );
    const stem = screen.getByRole("heading", { name: "Needs you" });
    expect(stem.className).toContain("optical-start");
    expect(inset(stem)).toBe("-0.08em");
    const nested = screen.getByRole("heading", { name: "Gallery" });
    expect(nested.className).toContain("optical-start");
    expect(inset(nested)).toBe("-0.043em");
    expect(inset(screen.getByRole("heading", { name: "Orders" }))).toBe(
      "-0.043em",
    );
    const greeting = screen.getByRole("heading", {
      name: "Good morning, Priya",
    });
    expect(greeting.className).toContain("optical-start");
    expect(inset(greeting)).toBe("-0.043em");
  });

  it("moves the box and gives the space back on the other side", () => {
    expect(css).toContain("margin-inline-start: var(--optical-inset, 0em);");
    expect(css).toContain(
      "margin-inline-end: calc(var(--optical-inset, 0em) * -1);",
    );
    // Letter-spacing would move the gradient with the text; a margin does not.
    expect(css).not.toContain("letter-spacing");
  });
});

describe("the icon nudges", () => {
  const ICONS: Record<string, LucideIcon> = {
    "lucide-chevron-right": ChevronRight,
    "lucide-chevron-left": ChevronLeft,
    "lucide-play": Play,
    "lucide-triangle-alert": TriangleAlert,
    "lucide-upload": Upload,
    "lucide-download": Download,
    "lucide-lock": Lock,
  };

  it("is keyed on classes that the pinned lucide-react still draws", () => {
    const used = new Set(
      [...css.matchAll(/\.(lucide-[a-z-]+)/g)].map((m) => m[1] ?? ""),
    );
    // Every icon with a nudge has a row here, and every row has a nudge.
    expect(
      [...used].filter((name) => name !== "lucide-chevron-down").sort(),
    ).toEqual(Object.keys(ICONS).sort());
    for (const [name, Icon] of Object.entries(ICONS)) {
      const { container } = render(<Icon aria-hidden="true" />);
      expect(
        container.querySelector("svg")?.classList.contains(name),
        name,
      ).toBe(true);
    }
    const { container } = render(<ArrowRight aria-hidden="true" />);
    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      "lucide-arrow-right",
    );
  });

  it("leaves icons that turn alone, because translate is applied outside rotate", () => {
    expect(css).toContain('.lucide-chevron-right:not([class*="rotate"])');
    expect(css).toContain('.lucide-chevron-left:not([class*="rotate"])');
    // The vertical chevrons turn in six places; they are only nudged in a select.
    expect(css).toContain(
      '[data-slot="select-trigger"] .lucide-chevron-down {',
    );
    expect(css).not.toMatch(/\n\.lucide-chevron-(down|up)/);
  });

  it("reads the percentage against the drawn box, not the 24-unit view box", () => {
    const blocks = css.match(/transform-box: border-box;/g) ?? [];
    const translates = css.match(/\n\s+translate: [^;]*;/g) ?? [];
    expect(blocks.length).toBe(translates.length);
    expect(read("styles/tokens.css")).toContain(
      "--optical-unit: calc(100% / 24);",
    );
  });
});

describe("no control changed size", () => {
  const SIZES = [
    { size: "default", height: "h-9", pad: "3" },
    { size: "xs", height: "h-6", pad: "1.5" },
    { size: "sm", height: "h-8", pad: "2.5" },
    { size: "lg", height: "h-10", pad: "4" },
  ] as const;

  it("keeps each button size's fixed height and its 44 px touch minimum", () => {
    for (const { size, height } of SIZES) {
      const classes = buttonVariants({ size }).split(" ");
      expect(classes, size).toContain(height);
      expect(classes, size).toContain("pointer-coarse:min-h-11");
    }
    for (const size of ["icon", "icon-xs", "icon-sm", "icon-lg"] as const) {
      expect(buttonVariants({ size }), size).toMatch(/pointer-coarse:size-11/);
    }
  });

  it("moves a button's content by growing one side's padding and shrinking the other's by the same amount", () => {
    for (const { size, pad } of SIZES) {
      const classes = buttonVariants({ size });
      const base = `has-[>svg]:px-${pad}`;
      expect(classes, size).toContain(base);
      for (const [edge, token, near, far] of [
        ["end", "--optical-icon-end", "ps", "pe"],
        ["start", "--optical-icon-start", "pe", "ps"],
      ] as const) {
        // The side nearer the icon's empty box gets less padding.
        const grows = `data-[icon-edge=${edge}]:${near}-[calc(--spacing(${pad})+var(${token}))]`;
        const shrinks = `data-[icon-edge=${edge}]:${far}-[calc(--spacing(${pad})-var(${token}))]`;
        expect(classes, `${size} ${edge} grows`).toContain(grows);
        expect(classes, `${size} ${edge} shrinks`).toContain(shrinks);
      }
    }
  });

  it("states the distances as tokens, once", () => {
    const tokens = read("styles/tokens.css");
    expect(tokens).toContain("--optical-icon-end: 1.15px;");
    expect(tokens).toContain("--optical-icon-start: 0.7px;");
  });
});

describe("counts are tabular and centred", () => {
  it("sets tabular figures on every count badge, so a 1 does not sit left of centre", () => {
    // Without tnum the proportional 1 has 39 units of space on its left and
    // 109 on its right, 0.42 px left of centre at 12 px. With it every digit
    // sits in a 600-unit cell and its ink is centred to within 1 unit.
    expect(read("app/shell/CountBadge.tsx")).toContain('"numeral ');
    expect(read("app/shell/Notifications.tsx")).toContain("tabular-nums");
    expect(read("app/shell/MenuCount.tsx")).toContain("data-numeric");
    expect(read("styles/type.css")).toMatch(
      /\.numeral \{[^}]*font-variant-numeric: tabular-nums/,
    );
    expect(read("styles/index.css")).toMatch(
      /\[data-numeric\] \{\s*font-variant-numeric: tabular-nums/,
    );
  });
});
