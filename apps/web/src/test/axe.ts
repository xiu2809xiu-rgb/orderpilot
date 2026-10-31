import axe from "axe-core";

/**
 * Accessibility violations in a rendered tree, as short strings. jsdom has no
 * layout, so colour contrast is covered by tokens.test.ts instead.
 */
export async function axeViolations(container: HTMLElement): Promise<string[]> {
  const results = await axe.run(container, {
    rules: {
      "color-contrast": { enabled: false },
      region: { enabled: false },
    },
  });
  return results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html ?? ""}`);
}
