import { render, screen, waitFor } from "@testing-library/react";
import { Suspense, use } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignInGround } from "./SignInGround";

const mode = vi.hoisted(() => ({ value: "throws" }));
const rendered = vi.hoisted(() => vi.fn());

// The aurora is a lazy chunk. Here it breaks, or never finishes loading.
vi.mock("@/components/kit/Aurora", () => ({
  Aurora: () => {
    rendered();
    if (mode.value === "never") use(new Promise<never>(() => undefined));
    throw new Error("the aurora broke");
  },
}));

afterEach(() => {
  rendered.mockClear();
});

function Page() {
  return (
    <Suspense fallback={<p>Whole page waiting</p>}>
      <label>
        Email
        <input />
      </label>
      <SignInGround />
    </Suspense>
  );
}

describe("a failure in the aurora behind the sign-in page", () => {
  it("leaves the form working and shows nothing as an error", async () => {
    mode.value = "throws";
    // React logs the error it hands to the boundary.
    const noise = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    render(<Page />);
    // Wait for the lazy chunk to load and throw, or the test proves nothing.
    await waitFor(() => {
      expect(rendered).toHaveBeenCalled();
    });
    // React logs an error only when a boundary caught it. With no boundary it
    // unmounts the tree, which this test would see as a failure to get here.
    await waitFor(() => {
      expect(noise).toHaveBeenCalled();
    });
    expect(screen.getByLabelText("Email")).toBeEnabled();
    expect(screen.queryByRole("alert")).toBeNull();
    noise.mockRestore();
  });

  it("is not waited for: the form is there while the aurora loads", async () => {
    mode.value = "never";
    render(<Page />);
    expect(screen.getByLabelText("Email")).toBeEnabled();
    await waitFor(() => {
      expect(rendered).toHaveBeenCalled();
    });
    expect(screen.queryByText("Whole page waiting")).toBeNull();
    expect(screen.getByLabelText("Email")).toBeEnabled();
  });
});
