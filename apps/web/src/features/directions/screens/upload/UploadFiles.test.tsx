import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
import { must } from "@/test/must";
import {
  pdf,
  reduceMotion,
  signInAsSupport,
  stubDemo,
  upload,
} from "./uploadHarness";

beforeAll(async () => {
  await i18n.loadNamespaces(["directions", "directions-intake"]);
});

beforeEach(() => {
  reduceMotion();
  stubDemo();
  signInAsSupport();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function addFiles(files: File[]) {
  const user = userEvent.setup({ applyAccept: false });
  upload();
  await user.upload(await screen.findByLabelText("Documents to upload"), files);
  await waitFor(() => {
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
  });
  return user;
}

describe("the file list, before anything is read", () => {
  it("says which sample will be read, and that the other files are not read", async () => {
    await addFiles([
      new File(["a,b\n1,2\n"], "stock.csv"),
      pdf("po-4471-26.pdf"),
      pdf("po-boxed-so-0102.pdf"),
    ]);
    const list = screen.getByRole("list", { name: "Files to read" });
    const rows = within(list).getAllByRole("listitem");
    expect(
      within(must(rows[0])).getByText("Not read in this preview"),
    ).toBeVisible();
    expect(within(must(rows[1])).getByText("Sample: PO 4471-26")).toBeVisible();
    expect(
      within(must(rows[2])).getByText(
        "Not read: only the first sample is read",
      ),
    ).toBeVisible();
    // Said before the work starts, beside the button that starts it.
    const start = screen.getByRole("button", { name: "Read with Spark" });
    expect(start).toBeEnabled();
    expect(
      screen.getByText(
        "Nothing is saved and no order is made in this preview.",
      ),
    ).toBeVisible();
  });

  it("reads the first file that has a sample, not the first file", async () => {
    const fetchMock = stubDemo();
    const user = await addFiles([
      new File(["a,b\n1,2\n"], "stock.csv"),
      pdf("po-4471-26.pdf"),
    ]);
    await user.click(screen.getByRole("button", { name: "Read with Spark" }));
    await screen.findByRole("heading", { name: "Review what Spark read" });
    expect(fetchMock).toHaveBeenCalledWith("/directions/po-4471-26.json");
  });

  it("keeps the button off, and says how to go on, when no listed file has a sample", async () => {
    await addFiles([pdf("scan.pdf"), new File(["a,b\n"], "stock.csv")]);
    expect(
      screen.getByRole("button", { name: "Read with Spark" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/Use the demo purchase order, or add a sample file/),
    ).toBeVisible();
    expect(screen.getAllByText("Not read in this preview")).toHaveLength(2);
  });

  it("shows a size under 1 KB in bytes", async () => {
    const user = userEvent.setup({ applyAccept: false });
    upload();
    await user.upload(await screen.findByLabelText("Documents to upload"), [
      pdf("po-4471-26.pdf"),
      new File([""], "blank.csv"),
    ]);
    await screen.findByText("Ready");
    expect(screen.getByText("13 B")).toBeVisible();
    // The empty file is refused: a message, and no row to show its size.
    expect(screen.getByText("blank.csv is empty.")).toBeVisible();
    expect(screen.queryByText("0 B")).toBeNull();
    expect(screen.queryByText("1 KB")).toBeNull();
  });

  it("says an XLSX, not a XLSX, and a PDF with the right article", async () => {
    const user = userEvent.setup({ applyAccept: false });
    upload();
    await user.upload(await screen.findByLabelText("Documents to upload"), [
      new File(["just words"], "book.xlsx"),
      new File(["just words"], "scan.png"),
    ]);
    expect(
      await screen.findByText(/book\.xlsx says it is an XLSX file but/),
    ).toBeVisible();
    expect(
      await screen.findByText(/scan\.png says it is a PNG file but/),
    ).toBeVisible();
  });

  it("refuses the same file twice with a message that names it", async () => {
    const user = userEvent.setup();
    upload();
    const input = await screen.findByLabelText("Documents to upload");
    // The same file, as the file dialog gives it twice: one name, size and date.
    const same = pdf("po-4471-26.pdf");
    await user.upload(input, same);
    await screen.findByText("Ready");
    await user.upload(input, same);
    expect(
      await screen.findByText(
        "po-4471-26.pdf is already in the list. It was not added twice.",
      ),
    ).toBeVisible();
    // It is not in the list twice: one row, and the message beside it.
    const list = screen.getByRole("list", { name: "Files to read" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(
      screen.getAllByRole("button", { name: "Remove po-4471-26.pdf" }),
    ).toHaveLength(1);
  });
});

describe("focus after a file is removed", () => {
  it("goes to the next file's remove button, and to Choose files after the last", async () => {
    const user = await addFiles([pdf("a.pdf"), pdf("b.pdf"), pdf("c.pdf")]);
    await user.click(screen.getByRole("button", { name: "Remove a.pdf" }));
    expect(screen.getByRole("button", { name: "Remove b.pdf" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Remove c.pdf" }));
    expect(screen.getByRole("button", { name: "Choose files" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Remove b.pdf" }));
    expect(screen.getByRole("button", { name: "Choose files" })).toHaveFocus();
  });
});

describe("a file dropped outside the drop zone", () => {
  function dropEvent(type: "dragover" | "drop", target: Element) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", {
      value: { types: ["Files"], files: [], dropEffect: "copy" },
    });
    act(() => {
      fireEvent(target, event);
    });
    return event;
  }

  it("is stopped, so the browser does not open it, while the screen is open", async () => {
    const { unmount } = upload();
    await screen.findByLabelText("Documents to upload");
    expect(dropEvent("dragover", document.body).defaultPrevented).toBe(true);
    expect(dropEvent("drop", document.body).defaultPrevented).toBe(true);
    // The pointer says a drop is not accepted there.
    const over = dropEvent("dragover", document.body);
    expect(
      (over as unknown as { dataTransfer: { dropEffect: string } }).dataTransfer
        .dropEffect,
    ).toBe("none");
    unmount();
    expect(dropEvent("drop", document.body).defaultPrevented).toBe(false);
  });

  it("is left to the drop zone when it lands on it, which takes the file", async () => {
    const user = userEvent.setup();
    upload();
    const input = await screen.findByLabelText("Documents to upload");
    const zone = must(input.closest("[data-dropzone]"));
    const over = dropEvent("dragover", zone);
    expect(
      (over as unknown as { dataTransfer: { dropEffect: string } }).dataTransfer
        .dropEffect,
    ).toBe("copy");
    await user.upload(input, pdf("po-4471-26.pdf"));
    expect(await screen.findByText("Sample: PO 4471-26")).toBeVisible();
  });
});
