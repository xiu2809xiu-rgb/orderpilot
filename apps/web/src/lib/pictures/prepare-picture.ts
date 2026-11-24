import { PROFILE_PICTURE_LIMITS } from "@orderpilot/shared";

/** The kinds of file a person may choose. The server takes only a JPEG, so the browser makes one. */
export const CHOOSABLE_TYPES = ["image/png", "image/jpeg", "image/webp"];
/** The file a person chooses may be a large photo: it is shrunk here, never sent. */
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
/** The side of the picture that is sent. */
export const PICTURE_SIDE = 256;
const JPEG_QUALITY = 0.85;
const WHITE = "#ffffff";

export type PictureChoiceCode =
  "not_an_image" | "too_small" | "too_large_file" | "cannot_read";

/** The file cannot be used. `code` names the words the card shows for it. */
export class PictureChoiceError extends Error {
  override readonly name = "PictureChoiceError";
  constructor(readonly code: PictureChoiceCode) {
    super(code);
  }
}

export interface PreparedPicture {
  /** What is sent: a PICTURE_SIDE square JPEG. */
  blob: Blob;
  /** The same bytes as a `data:` URL, because the page's security policy allows `data:` images and not `blob:` ones. */
  dataUrl: string;
}

export interface DecodedPicture {
  width: number;
  height: number;
  image: CanvasImageSource;
  close: () => void;
}

export interface DrawingContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  imageSmoothingQuality: "low" | "medium" | "high";
  fillRect: (x: number, y: number, width: number, height: number) => void;
  drawImage: (
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sWidth: number,
    sHeight: number,
    dx: number,
    dy: number,
    dWidth: number,
    dHeight: number,
  ) => void;
}

export interface DrawingCanvas {
  width: number;
  height: number;
  getContext: (kind: "2d") => DrawingContext | null;
  toDataURL: (type: "image/jpeg", quality: number) => string;
}

/** What the preparation needs from the browser, so a test can stand in for it. */
export interface PictureTools {
  decode: (file: Blob) => Promise<DecodedPicture>;
  makeCanvas: () => DrawingCanvas;
}

export interface Square {
  x: number;
  y: number;
  side: number;
}

/** The biggest centred square of a picture: where to cut it. */
export function centreSquare(width: number, height: number): Square {
  const side = Math.min(width, height);
  return {
    x: Math.floor((width - side) / 2),
    y: Math.floor((height - side) / 2),
    side,
  };
}

/** The real browser: `createImageBitmap` respects the camera's rotation, and a canvas re-encodes. */
export const browserTools: PictureTools = {
  decode: async (file) => {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    return {
      width: bitmap.width,
      height: bitmap.height,
      image: bitmap,
      close: () => {
        bitmap.close();
      },
    };
  },
  makeCanvas: () => document.createElement("canvas"),
};

/**
 * Turns the file a person chose into the picture that is sent: the middle
 * square, 256 by 256, white behind anything see-through, as a JPEG. It is
 * drawn onto a canvas and read back, so nothing but pixels survives: the
 * camera's details (the place it was taken among them) never leave this
 * machine. The server checks all of this again and trusts none of it.
 */
export async function preparePicture(
  file: File,
  tools: PictureTools = browserTools,
): Promise<PreparedPicture> {
  if (!CHOOSABLE_TYPES.includes(file.type)) {
    throw new PictureChoiceError("not_an_image");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new PictureChoiceError("too_large_file");
  }
  let decoded: DecodedPicture;
  try {
    decoded = await tools.decode(file);
  } catch {
    throw new PictureChoiceError("cannot_read");
  }
  try {
    if (
      Math.min(decoded.width, decoded.height) < PROFILE_PICTURE_LIMITS.minSide
    ) {
      throw new PictureChoiceError("too_small");
    }
    const canvas = tools.makeCanvas();
    canvas.width = PICTURE_SIDE;
    canvas.height = PICTURE_SIDE;
    const context = canvas.getContext("2d");
    if (!context) throw new PictureChoiceError("cannot_read");
    // JPEG has no transparency: without this a see-through PNG turns black.
    context.fillStyle = WHITE;
    context.fillRect(0, 0, PICTURE_SIDE, PICTURE_SIDE);
    context.imageSmoothingQuality = "high";
    const square = centreSquare(decoded.width, decoded.height);
    context.drawImage(
      decoded.image,
      square.x,
      square.y,
      square.side,
      square.side,
      0,
      0,
      PICTURE_SIDE,
      PICTURE_SIDE,
    );
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    return { blob: blobFromDataUrl(dataUrl), dataUrl };
  } finally {
    decoded.close();
  }
}

const DATA_URL_START = "data:image/jpeg;base64,";

/** The bytes of a JPEG `data:` URL, so the preview and the upload are one picture. */
export function blobFromDataUrl(dataUrl: string): Blob {
  if (!dataUrl.startsWith(DATA_URL_START)) {
    throw new PictureChoiceError("cannot_read");
  }
  const text = atob(dataUrl.slice(DATA_URL_START.length));
  const bytes = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) {
    bytes[index] = text.charCodeAt(index);
  }
  return new Blob([bytes], { type: "image/jpeg" });
}
