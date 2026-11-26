import { describe, expect, it, vi } from "vitest";
import {
  blobFromDataUrl,
  centreSquare,
  MAX_SOURCE_BYTES,
  PICTURE_SIDE,
  PictureChoiceError,
  preparePicture,
  type DrawingCanvas,
  type DrawingContext,
  type PictureTools,
} from "./prepare-picture";

// Four bytes of a JPEG: start of image, then end of image.
const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xd9];
const JPEG_URL = `data:image/jpeg;base64,${btoa(String.fromCharCode(...JPEG_BYTES))}`;

function fileOf(type: string, size = 100) {
  const file = new File([new Uint8Array(size)], "chosen", { type });
  return file;
}

/** A canvas that records what was drawn, because jsdom has none. */
function fakeTools(width: number, height: number) {
  const calls: string[] = [];
  const draws: number[][] = [];
  const context: DrawingContext = {
    fillStyle: "",
    imageSmoothingQuality: "low",
    fillRect: (...args) => {
      const style =
        typeof context.fillStyle === "string" ? context.fillStyle : "other";
      calls.push(`fill ${style} ${args.join(",")}`);
    },
    drawImage: (_image, ...args) => {
      calls.push("draw");
      draws.push(args);
    },
  };
  const canvas: DrawingCanvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toDataURL: vi.fn(() => JPEG_URL),
  };
  const close = vi.fn();
  const tools: PictureTools = {
    decode: () =>
      Promise.resolve({
        width,
        height,
        image: document.createElement("canvas"),
        close,
      }),
    makeCanvas: () => canvas,
  };
  return { tools, calls, draws, canvas, close };
}

describe("centreSquare", () => {
  it("cuts the middle of a wide picture", () => {
    expect(centreSquare(600, 400)).toEqual({ x: 100, y: 0, side: 400 });
  });

  it("cuts the middle of a tall picture", () => {
    expect(centreSquare(300, 500)).toEqual({ x: 0, y: 100, side: 300 });
  });

  it("keeps a square picture whole", () => {
    expect(centreSquare(256, 256)).toEqual({ x: 0, y: 0, side: 256 });
  });
});

describe("preparePicture", () => {
  it("refuses a file that is not a PNG, JPEG or WebP", async () => {
    const { tools } = fakeTools(300, 300);
    const error = await preparePicture(fileOf("image/gif"), tools).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(PictureChoiceError);
    expect(error).toMatchObject({ code: "not_an_image" });
  });

  it("refuses a file over 10 MB before reading it", async () => {
    const decode = vi.fn();
    const error = await preparePicture(
      fileOf("image/png", MAX_SOURCE_BYTES + 1),
      { decode, makeCanvas: () => fakeTools(1, 1).canvas },
    ).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "too_large_file" });
    expect(decode).not.toHaveBeenCalled();
  });

  it("says the file cannot be read when the browser cannot decode it", async () => {
    const error = await preparePicture(fileOf("image/png"), {
      decode: () => Promise.reject(new Error("bad")),
      makeCanvas: () => fakeTools(1, 1).canvas,
    }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "cannot_read" });
  });

  it("refuses a picture under 128 pixels on a side, and frees it", async () => {
    const { tools, close } = fakeTools(400, 100);
    const error = await preparePicture(fileOf("image/png"), tools).catch(
      (e: unknown) => e,
    );
    expect(error).toMatchObject({ code: "too_small" });
    expect(close).toHaveBeenCalledOnce();
  });

  it("paints white first, then draws the middle square into 256 by 256", async () => {
    const { tools, calls, draws, canvas, close } = fakeTools(600, 400);
    const prepared = await preparePicture(fileOf("image/webp"), tools);
    expect(canvas.width).toBe(PICTURE_SIDE);
    expect(canvas.height).toBe(PICTURE_SIDE);
    expect(calls).toEqual(["fill #ffffff 0,0,256,256", "draw"]);
    expect(draws).toEqual([[100, 0, 400, 400, 0, 0, 256, 256]]);
    expect(close).toHaveBeenCalledOnce();
    expect(canvas.toDataURL).toHaveBeenCalledWith("image/jpeg", 0.85);
    expect(prepared.dataUrl.startsWith("data:image/jpeg")).toBe(true);
  });

  it("sends exactly the bytes the preview shows", async () => {
    const { tools } = fakeTools(300, 300);
    const prepared = await preparePicture(fileOf("image/jpeg"), tools);
    expect(prepared.blob.type).toBe("image/jpeg");
    const bytes = new Uint8Array(await prepared.blob.arrayBuffer());
    expect([...bytes]).toEqual(JPEG_BYTES);
  });
});

describe("blobFromDataUrl", () => {
  it("refuses a canvas that gave back anything but a JPEG", () => {
    expect(() => blobFromDataUrl("data:image/png;base64,AAAA")).toThrow(
      PictureChoiceError,
    );
  });
});
