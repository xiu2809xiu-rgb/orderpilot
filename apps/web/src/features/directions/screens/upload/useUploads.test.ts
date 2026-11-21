import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_FILES } from "./uploadRules";
import { useUploads } from "./useUploads";

// A reader that stays slow until the test finishes it, so that a file can be
// removed while it is still being read.
class SlowReader {
  static pending: SlowReader[] = [];
  onprogress: ((event: unknown) => void) | null = null;
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;
  result: ArrayBuffer | null = null;
  readAsArrayBuffer() {
    SlowReader.pending.push(this);
  }
  finish(bytes: string) {
    this.result = new TextEncoder().encode(bytes).buffer;
    this.onload?.();
  }
  fail() {
    this.onerror?.();
  }
}

const file = (name: string, content = "%PDF-1.7 demo") =>
  new File([content], name, { type: "application/pdf", lastModified: 1 });

beforeEach(() => {
  SlowReader.pending = [];
  vi.stubGlobal("FileReader", SlowReader);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the files a person adds", () => {
  it("keeps the limit when a file is removed while it is still being read", () => {
    const { result } = renderHook(() => useUploads());
    act(() => {
      result.current.add(
        Array.from({ length: MAX_FILES }, (_, i) => file(`f${String(i)}.pdf`)),
      );
    });
    const first = result.current.rows[0];
    expect(result.current.rows).toHaveLength(MAX_FILES);
    // The person removes the first file while its read is under way, then its
    // read fails: it must give back its place once, not twice.
    act(() => {
      result.current.remove(first?.id ?? -1);
    });
    act(() => {
      SlowReader.pending[0]?.fail();
    });
    act(() => {
      result.current.add([file("six.pdf"), file("seven.pdf")]);
    });
    // The refused file is a message, not a row.
    expect(result.current.rows).toHaveLength(MAX_FILES);
    expect(result.current.refused).toHaveLength(1);
    expect(result.current.refused[0]).toMatchObject({
      name: "seven.pdf",
      reason: "tooMany",
    });
  });

  it("gives a place back once when a removed file finishes reading", () => {
    const { result } = renderHook(() => useUploads());
    act(() => {
      result.current.add([file("a.pdf")]);
    });
    act(() => {
      result.current.remove(result.current.rows[0]?.id ?? -1);
    });
    act(() => {
      SlowReader.pending[0]?.finish("not a pdf at all");
    });
    expect(result.current.rows).toHaveLength(0);
    act(() => {
      result.current.add(
        Array.from({ length: MAX_FILES + 1 }, (_, i) =>
          file(`g${String(i)}.pdf`),
        ),
      );
    });
    expect(result.current.refused).toHaveLength(1);
    expect(result.current.rows).toHaveLength(MAX_FILES);
  });

  it("refuses the same file added twice, naming it, and takes it again once removed", () => {
    const { result } = renderHook(() => useUploads());
    act(() => {
      result.current.add([file("po.pdf")]);
    });
    act(() => {
      result.current.add([file("po.pdf")]);
    });
    // The second copy leaves a message and no row.
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.refused).toMatchObject([
      { name: "po.pdf", reason: "duplicate" },
    ]);
    // A file of the same name but another size is another file.
    act(() => {
      result.current.add([file("po.pdf", "%PDF-1.7 a longer one")]);
    });
    expect(result.current.rows[1]?.status).toBe("reading");
    // New files start the messages afresh.
    expect(result.current.refused).toHaveLength(0);
    act(() => {
      result.current.remove(result.current.rows[0]?.id ?? -1);
    });
    act(() => {
      result.current.add([file("po.pdf")]);
    });
    expect(result.current.rows.at(-1)?.status).toBe("reading");
  });

  it("leaves no row for a file that cannot be read, and none for a type it does not take", async () => {
    const { result } = renderHook(() => useUploads());
    act(() => {
      result.current.add([file("broken.pdf"), file("setup.exe")]);
    });
    await act(async () => {
      SlowReader.pending[0]?.fail();
      await Promise.resolve();
    });
    expect(result.current.rows).toHaveLength(0);
    expect(result.current.refused.map((note) => note.reason)).toEqual([
      "type",
      "unreadable",
    ]);
  });

  it("says nothing of a file the person removed before its read ended", async () => {
    const { result } = renderHook(() => useUploads());
    act(() => {
      result.current.add([file("gone.pdf")]);
    });
    act(() => {
      result.current.remove(result.current.rows[0]?.id ?? -1);
    });
    await act(async () => {
      SlowReader.pending[0]?.finish("not a pdf at all");
      await Promise.resolve();
    });
    expect(result.current.refused).toHaveLength(0);
  });

  it("drops a message when it is dismissed", () => {
    const { result } = renderHook(() => useUploads());
    act(() => {
      result.current.add([file("setup.exe")]);
    });
    act(() => {
      result.current.dismiss(result.current.refused[0]?.id ?? -1);
    });
    expect(result.current.refused).toHaveLength(0);
  });
});
