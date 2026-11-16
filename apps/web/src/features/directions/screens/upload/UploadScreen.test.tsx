import { QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import i18n from "@/i18n";
import { createQueryClient } from "@/lib/query";
import { useSessionStore } from "@/stores/session";
import { axeViolations } from "@/test/axe";
import { sessionFor } from "@/test/fixtures";
import { must } from "@/test/must";
import demo from "@/../public/demo-documents/po-boxed-so-0102.json";
import storyline from "@/../public/directions/po-4471-26.json";
import UploadScreen from "./UploadScreen";

// Like the site, each preview document answers at its own address.
function stubDemo() {
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

// Reduced motion: the reading is short and its steps are all there at once.
function reduceMotion() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function upload() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={["/upload"]}>
        <Routes>
          <Route path="/upload" element={<UploadScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const pdf = (name = "po.pdf") =>
  new File([new TextEncoder().encode("%PDF-1.7 demo")], name, {
    type: "application/pdf",
  });

beforeAll(async () => {
  await i18n.loadNamespaces([
    "directions",
    "directions-intake",
    "directions-parts",
    "directions-spark",
  ]);
});

beforeEach(() => {
  reduceMotion();
  stubDemo();
  useSessionStore.setState({
    status: "active",
    session: sessionFor("SUPPORT"),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// The test DOM has no AnimationEvent, so React listens there for the prefixed
// name; a browser hears the plain one. Sending both keeps the test true in either.
function endAnimation(node: Element) {
  fireEvent(node, new Event("webkitAnimationEnd", { bubbles: true }));
  fireEvent.animationEnd(node);
}

async function toReview(user: ReturnType<typeof userEvent.setup>) {
  upload();
  await user.click(
    await screen.findByRole("button", { name: "Use the demo purchase order" }),
  );
  return screen.findByRole("heading", { name: "Review what Spark read" });
}

describe("the upload screen", () => {
  it("writes the limits inside the drop zone before anyone tries", async () => {
    upload();
    expect(
      await screen.findByText(
        "PDF, PNG, JPEG, XLSX or CSV. Up to 10 MB each, up to 5 files.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(/a file you add stays in your browser/),
    ).toBeVisible();
    // Nothing to read yet: the primary button is off and says what to do.
    expect(
      screen.getByRole("button", { name: "Read with Spark" }),
    ).toBeDisabled();
  });

  it("gives a role that may not upload the reason, not the form", async () => {
    useSessionStore.setState({
      status: "active",
      session: sessionFor("WAREHOUSE"),
    });
    upload();
    expect(
      await screen.findByText("Uploading documents is for Support"),
    ).toBeVisible();
    expect(screen.queryByText("Choose files")).toBeNull();
  });

  it("checks each file in the browser: a real PDF is ready, the rest say why they were refused", async () => {
    // A dropped file is not filtered by the input's accept list, so neither is this.
    const user = userEvent.setup({ applyAccept: false });
    upload();
    const input = await screen.findByLabelText("Documents to upload");
    await user.upload(input, [
      pdf(),
      new File(["just words"], "invoice.pdf", { type: "application/pdf" }),
      new File(["MZ"], "setup.exe"),
      new File([""], "empty.csv"),
    ]);
    const list = await screen.findByRole("list", { name: "Files to read" });
    await waitFor(() => {
      expect(within(list).getByText("Ready")).toBeVisible();
    });
    expect(
      within(list).getByText(
        /invoice\.pdf says it is a PDF file but its content is not/,
      ),
    ).toBeVisible();
    expect(
      within(list).getByText(
        "setup.exe is not a PDF, PNG, JPEG, XLSX or CSV file.",
      ),
    ).toBeVisible();
    expect(within(list).getByText("empty.csv is empty.")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Read with Spark" }),
    ).toBeEnabled();
    await user.click(
      within(list).getByRole("button", { name: "Remove invoice.pdf" }),
    );
    expect(within(list).queryByText(/invoice\.pdf says/)).toBeNull();
  });

  it("refuses a file over the size limit without reading it", async () => {
    const user = userEvent.setup();
    upload();
    const big = new File(["x"], "scan.png");
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    await user.upload(await screen.findByLabelText("Documents to upload"), big);
    expect(
      await screen.findByText("scan.png is larger than 10 MB."),
    ).toBeVisible();
  });

  it("reads the demo document, then reviews it with a box on every field and the uncertain ones marked", async () => {
    const user = userEvent.setup();
    await toReview(user);
    expect(screen.getByText("Classified as Customer PO")).toBeVisible();
    expect(
      screen.getByText(
        "21 fields read: 19 above 90 percent, 2 for you to approve.",
      ),
    ).toBeVisible();
    // The page of the PDF is a picture; each field has a box named after it.
    const page = screen.getByRole("img", {
      name: /Page 1 of purchase order PO-IN-4807/,
    });
    expect(page).toBeVisible();
    const boxes = screen.getByRole("group", { name: "Fields on this page" });
    expect(within(boxes).getAllByRole("button")).toHaveLength(20);
    expect(screen.getAllByText("Requires approval")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Finish review" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "2 fields still need your approval before the review can be finished.",
      ),
    ).toBeVisible();
  });

  it("reads the page once as the review opens: a field's box and row carry where it sits, and the pass never plays again", async () => {
    const user = userEvent.setup();
    await toReview(user);
    const fields = screen.getByRole("group", { name: "Fields read" });
    const stage = must(fields.parentElement);
    expect(stage).toHaveAttribute("data-arriving", "true");
    const light = must(stage.querySelector('[data-slot="reading-light"]'));
    expect(light).toHaveAttribute("aria-hidden", "true");
    // How far down its page a field sits is when the light reaches it, and the
    // box and the row share that moment.
    const field = must(demo.fields[1]);
    const at = String(must(field.box[1]));
    const box = within(
      screen.getByRole("group", { name: "Fields on this page" }),
    ).getByRole("button", { name: `${field.label}: ${field.text}` });
    const show = within(fields).getByRole("button", {
      name: `Show ${field.label} on the page`,
    });
    const row = must(show.closest("li"));
    expect(box.style.getPropertyValue("--dx-at")).toBe(at);
    expect(row.style.getPropertyValue("--dx-at")).toBe(at);

    endAnimation(light);
    expect(stage).toHaveAttribute("data-arriving", "false");
    expect(stage.querySelector('[data-slot="reading-light"]')).toBeNull();
    // Choosing a field afterwards does not bring the pass back.
    await user.click(show);
    expect(show).toHaveAttribute("aria-pressed", "true");
    expect(stage).toHaveAttribute("data-arriving", "false");
  });

  it("opens the preview document that the added file is named after, and the default for any other name", async () => {
    const user = userEvent.setup();
    const fetchMock = stubDemo();
    upload();
    await user.upload(
      await screen.findByLabelText("Documents to upload"),
      pdf("PO-4471-26.PDF"),
    );
    await screen.findByText("Ready");
    await user.click(screen.getByRole("button", { name: "Read with Spark" }));
    await screen.findByRole("heading", { name: "Review what Spark read" });
    expect(fetchMock).toHaveBeenCalledWith("/directions/po-4471-26.json");
    // Only the quantity is below the threshold, and its page image is this PO's own.
    expect(
      screen.getByText(
        "16 fields read: 15 above 90 percent, 1 for you to approve.",
      ),
    ).toBeVisible();
    expect(screen.getAllByText("Requires approval")).toHaveLength(1);
    expect(
      screen.getByRole("img", { name: /Page 1 of purchase order 4471-26/ }),
    ).toHaveAttribute("src", "/directions/po-4471-26-p1.png");
  });

  it("opens the default preview document for a file with any other name", async () => {
    const user = userEvent.setup();
    const fetchMock = stubDemo();
    upload();
    await user.upload(
      await screen.findByLabelText("Documents to upload"),
      pdf("customer-po.pdf"),
    );
    await screen.findByText("Ready");
    await user.click(screen.getByRole("button", { name: "Read with Spark" }));
    await screen.findByRole("heading", { name: "Review what Spark read" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/demo-documents/po-boxed-so-0102.json",
    );
    expect(
      screen.getByRole("img", { name: /Page 1 of purchase order PO-IN-4807/ }),
    ).toHaveAttribute("src", "/directions/po-boxed-so-0102-p1.png");
  });

  it("lights a field's box when its row is chosen, and the row when its box is", async () => {
    const user = userEvent.setup();
    await toReview(user);
    const box = () =>
      within(
        screen.getByRole("group", { name: "Fields on this page" }),
      ).getByRole("button", { name: /^Ship to:/ });
    expect(box()).toHaveAttribute("data-selected", "false");
    await user.click(
      screen.getByRole("button", { name: "Show Ship to on the page" }),
    );
    expect(box()).toHaveAttribute("data-selected", "true");
    // The other way round: a box chosen on the page presses its row.
    await user.click(
      within(
        screen.getByRole("group", { name: "Fields on this page" }),
      ).getByRole("button", { name: /^Buyer:/ }),
    );
    expect(
      screen.getByRole("button", { name: "Show Buyer on the page" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Show Ship to on the page" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("switches page for a field that is on page 2", async () => {
    const user = userEvent.setup();
    await toReview(user);
    await user.click(
      screen.getByRole("button", { name: "Show Payment terms on the page" }),
    );
    expect(
      screen.getByRole("img", { name: /Page 2 of purchase order/ }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("takes a person to the next field to approve, and stops offering it when none is left", async () => {
    const user = userEvent.setup();
    await toReview(user);
    const next = screen.getByRole("button", { name: "Next to approve" });
    await user.click(next);
    // The first waiting field is Ship to, on page 1.
    expect(
      screen.getByRole("button", { name: "Show Ship to on the page" }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Confirm Ship to" }));
    await user.click(screen.getByRole("button", { name: "Next to approve" }));
    expect(
      screen.getByRole("img", { name: /Page 2 of purchase order/ }),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Confirm Payment terms" }),
    );
    expect(
      screen.queryByRole("button", { name: "Next to approve" }),
    ).not.toBeInTheDocument();
  });

  it("opens Finish review only when every uncertain field is confirmed or corrected", async () => {
    const user = userEvent.setup();
    await toReview(user);
    const create = screen.getByRole("button", { name: "Finish review" });
    await user.click(screen.getByRole("button", { name: "Confirm Ship to" }));
    expect(create).toBeDisabled();
    expect(
      screen.getByText(
        "1 field still needs your approval before the review can be finished.",
      ),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Edit Payment terms" }),
    );
    const field = screen.getByRole("textbox", { name: "Payment terms" });
    expect(
      screen.getByText(
        "Change the value as it should read, then save. Saving confirms it.",
      ),
    ).toBeVisible();
    await user.clear(field);
    await user.type(field, "Net 45 days from invoice date");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Net 45 days from invoice date")).toBeVisible();
    expect(screen.getByText("Edited and confirmed")).toBeVisible();
    expect(create).toBeEnabled();
    await user.click(create);
    expect(
      await screen.findByText("Review finished: 21 fields confirmed"),
    ).toBeVisible();
    expect(
      screen.getByText(
        "This preview saves nothing. The order this purchase order belongs to is in the sample data: SO-0102.",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Open order SO-0102" }),
    ).toBeVisible();
    expect(create).toBeDisabled();
  });

  it("says so, with a way to try again, when the demo document cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("{}", { status: 500 }))),
    );
    const user = userEvent.setup();
    upload();
    await user.click(
      await screen.findByRole("button", {
        name: "Use the demo purchase order",
      }),
    );
    expect(
      await screen.findByText("The demo document could not be loaded."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  it("has no accessibility violations on the drop zone, with files, and on the review", async () => {
    const user = userEvent.setup();
    const { container } = upload();
    const input = await screen.findByLabelText("Documents to upload");
    expect(await axeViolations(container)).toEqual([]);
    await user.upload(input, [pdf(), new File(["MZ"], "setup.exe")]);
    await screen.findByText("Ready");
    expect(await axeViolations(container)).toEqual([]);
    await user.click(
      screen.getByRole("button", { name: "Use the demo purchase order" }),
    );
    await screen.findByRole("heading", { name: "Review what Spark read" });
    expect(await axeViolations(container)).toEqual([]);
  }, 60_000);
});
