import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  decodePDFRawStream,
} from "pdf-lib";

/**
 * Reads a rendered PDF back the way a viewer would, so a test checks the bytes
 * and not the code that made them.
 */

export interface TextOrigin {
  /** From 1. */
  page: number;
  x: number;
  /** The baseline, measured from the top of the page. */
  y: number;
}

function streamsOf(doc: PDFDocument, contents: unknown): PDFRawStream[] {
  if (contents instanceof PDFRawStream) return [contents];
  if (contents instanceof PDFArray) {
    return contents
      .asArray()
      .flatMap((entry) => streamsOf(doc, doc.context.lookup(entry)));
  }
  return [];
}

/** Where every piece of text on every page starts. */
export async function textOrigins(bytes: Uint8Array): Promise<TextOrigin[]> {
  const doc = await PDFDocument.load(bytes);
  const found: TextOrigin[] = [];
  doc.getPages().forEach((page, i) => {
    const height = page.getHeight();
    const streams = streamsOf(doc, page.node.Contents());
    for (const stream of streams) {
      const content = Buffer.from(decodePDFRawStream(stream).decode()).toString(
        "latin1",
      );
      for (const match of content.matchAll(/1 0 0 1 ([-\d.]+) ([-\d.]+) Tm/g)) {
        found.push({
          page: i + 1,
          x: Number(match[1]),
          y: height - Number(match[2]),
        });
      }
    }
  });
  return found;
}

export interface GreyImage {
  width: number;
  height: number;
  pixels: Uint8Array;
}

/** The one image on a scanned page, as 8-bit grey. Null when the page has none. */
export async function pageImage(
  bytes: Uint8Array,
  pageNumber = 1,
): Promise<GreyImage | null> {
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPages()[pageNumber - 1];
  const resources = page?.node.Resources();
  const xobjects = resources?.get(PDFName.of("XObject"));
  if (!(xobjects instanceof PDFDict)) return null;
  const first = xobjects.values()[0];
  const stream = first ? doc.context.lookup(first) : undefined;
  if (!(stream instanceof PDFRawStream)) return null;
  const number = (key: string): number => {
    const value = stream.dict.get(PDFName.of(key));
    return value instanceof PDFNumber ? value.asNumber() : 0;
  };
  return {
    width: number("Width"),
    height: number("Height"),
    pixels: decodePDFRawStream(stream).decode(),
  };
}

/** The dates and producer in the file's own metadata. */
export async function readMetadata(bytes: Uint8Array): Promise<{
  created: string | undefined;
  modified: string | undefined;
  producer: string | undefined;
}> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  return {
    created: doc.getCreationDate()?.toISOString(),
    modified: doc.getModificationDate()?.toISOString(),
    producer: doc.getProducer(),
  };
}
