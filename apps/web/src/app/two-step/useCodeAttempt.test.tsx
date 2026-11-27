import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCodeAttempt } from "./useCodeAttempt";

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function setup(
  submit: (code: string) => Promise<string>,
  kind: "wrong" | "plain" = "wrong",
) {
  const onDone = vi.fn();
  const onFail = vi.fn(() => kind);
  const hook = renderHook(() => useCodeAttempt({ submit, onDone, onFail }));
  return { ...hook, onDone, onFail };
}

/** Lets the promise chains settle without moving the clock. */
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}
async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("the holds of a code attempt", () => {
  it("holds verifying for at least 500 ms, even when the server answers at once", async () => {
    const { result, onDone } = setup(() => Promise.resolve("ok"));
    act(() => {
      result.current.run("123456");
    });
    await flush();
    expect(result.current.state).toBe("verifying");
    await tick(499);
    expect(result.current.state).toBe("verifying");
    await tick(1);
    expect(result.current.state).toBe("success");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("clears the value and returns the field to input 900 ms after a wrong code", async () => {
    const { result, onFail } = setup(() => Promise.reject(new Error("no")));
    act(() => {
      result.current.setValue("123456");
    });
    act(() => {
      result.current.run("123456");
    });
    await tick(500);
    expect(result.current.state).toBe("error");
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(result.current.value).toBe("123456");
    await tick(899);
    expect(result.current.state).toBe("error");
    await tick(1);
    expect(result.current.state).toBe("input");
    expect(result.current.value).toBe("");
  });

  it("calls done 700 ms after success", async () => {
    const { result, onDone } = setup(() => Promise.resolve("the-answer"));
    act(() => {
      result.current.run("123456");
    });
    await tick(500);
    expect(result.current.state).toBe("success");
    await tick(699);
    expect(onDone).not.toHaveBeenCalled();
    await tick(1);
    expect(onDone).toHaveBeenCalledWith("the-answer");
  });

  it("clears every timer on unmount", async () => {
    const { result, unmount, onDone } = setup(() => Promise.resolve("ok"));
    act(() => {
      result.current.run("123456");
    });
    await tick(500);
    expect(result.current.state).toBe("success");
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    await tick(2_000);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("is busy from the submit through success and not busy after an error", async () => {
    const ok = setup(() => Promise.resolve("ok"));
    expect(ok.result.current.busy).toBe(false);
    act(() => {
      ok.result.current.run("123456");
    });
    expect(ok.result.current.busy).toBe(true);
    await tick(500);
    expect(ok.result.current.busy).toBe(true);
    await tick(700);
    expect(ok.result.current.busy).toBe(true);

    const bad = setup(() => Promise.reject(new Error("no")));
    act(() => {
      bad.result.current.run("123456");
    });
    expect(bad.result.current.busy).toBe(true);
    await tick(500);
    expect(bad.result.current.busy).toBe(false);
  });

  it("returns to input at once for a failure that is not a wrong code, keeping the digits", async () => {
    const { result } = setup(() => Promise.reject(new Error("net")), "plain");
    act(() => {
      result.current.setValue("123456");
    });
    act(() => {
      result.current.run("123456");
    });
    await tick(500);
    expect(result.current.state).toBe("input");
    expect(result.current.value).toBe("123456");
  });

  it("ignores a try that ends after a newer one began", async () => {
    let first: (v: string) => void = () => undefined;
    const submit = vi
      .fn<(code: string) => Promise<string>>()
      .mockImplementationOnce(
        () => new Promise<string>((resolve) => (first = resolve)),
      )
      .mockImplementation(() => Promise.resolve("second"));
    const { result, onDone } = setup(submit);
    act(() => {
      result.current.run("111111");
    });
    act(() => {
      result.current.run("222222");
    });
    await tick(1_200);
    first("first");
    await tick(1_200);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith("second");
  });
});
