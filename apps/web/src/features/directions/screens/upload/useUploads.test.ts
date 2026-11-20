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
    const refused = result.current.rows.filter(
      (row) => row.status === "refused",
    );
    expect(result.current.rows).toHaveLength(MAX_FILES + 1);
    expect(refused).toHaveLength(1);
    expect(refused[0]).toMatchObject({ name: "seven.pdf", reason: "tooMany" });
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
    expect(
      result.current.rows.filter((row) => row.status === "refused"),
    ).toHaveLength(1);
  });

  it("refuses the same file added twice, naming it, and takes it again once removed", () => {
    const { result } = renderHook(() => useUploads());
    act(() => {
      result.current.add([file("po.pdf")]);
    });
    act(() => {
      result.current.add([file("po.pdf")]);
    });
    expect(result.current.rows[1]).toMatchObject({
      name: "po.pdf",
      status: "refused",
      reason: "duplicate",
    });
    // A file of the same name but another size is another file.
    act(() => {
      result.current.add([file("po.pdf", "%PDF-1.7 a longer one")]);
    });
    expect(result.current.rows[2]?.status).toBe("reading");
    act(() => {
      result.current.remove(result.current.rows[0]?.id ?? -1);
    });
    act(() => {
      result.current.add([file("po.pdf")]);
    });
    expect(result.current.rows.at(-1)?.status).toBe("reading");
  });
});
