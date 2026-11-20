import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { vi } from "vitest";
import { createQueryClient } from "@/lib/query";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import demo from "@/../public/demo-documents/po-boxed-so-0102.json";
import storyline from "@/../public/directions/po-4471-26.json";
import UploadScreen from "./UploadScreen";

export { demo, storyline };

/** Like the site, each preview document answers at its own address. */
export function stubDemo() {
  const fetchMock = vi.fn((url: string) =>
    Promise.resolve(
      new Response(
        JSON.stringify(url.endsWith("po-4471-26.json") ? storyline : demo),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Reduced motion: the reading is short and its steps are all there at once. */
export function reduceMotion() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

/** The screen in a data router (the leave guard needs one), with a page to leave for. */
export function upload() {
  const router = createMemoryRouter(
    [
      { path: "/upload", element: <UploadScreen /> },
      { path: "/elsewhere", element: <main /> },
    ],
    { initialEntries: ["/upload"] },
  );
  return {
    router,
    ...render(
      <QueryClientProvider client={createQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
  };
}

/** A small real PDF, by name. */
export const pdf = (name = "po.pdf") =>
  new File([new TextEncoder().encode("%PDF-1.7 demo")], name, {
    type: "application/pdf",
  });

export function signInAsSupport() {
  useSessionStore.setState({
    status: "active",
    session: sessionFor("SUPPORT"),
  });
}

/** The test DOM has no AnimationEvent, so React listens there for the prefixed name; send both. */
export function endAnimation(node: Element) {
  fireEvent(node, new Event("webkitAnimationEnd", { bubbles: true }));
  fireEvent.animationEnd(node);
}

export type User = ReturnType<typeof userEvent.setup>;

/** Opens the review of the default sample, through the demo button. */
export async function toReview(user: User) {
  const view = upload();
  await user.click(
    await screen.findByRole("button", { name: "Use the demo purchase order" }),
  );
  const heading = await screen.findByRole("heading", {
    name: "Review what Spark read",
  });
  return { heading, ...view };
}

/** Opens the review of the storyline PO (one uncertain field, the quantity). */
export async function toStoryline(user: User) {
  const view = upload();
  await user.upload(
    await screen.findByLabelText("Documents to upload"),
    pdf("po-4471-26.pdf"),
  );
  await screen.findByText("Ready");
  await user.click(screen.getByRole("button", { name: "Read with Spark" }));
  const heading = await screen.findByRole("heading", {
    name: "Review what Spark read",
  });
  return { heading, ...view };
}
