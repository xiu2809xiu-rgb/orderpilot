import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import { PAGE, type Color, type DrawOp } from "./canvas.js";
import { loadFont, type FontId } from "./fonts.js";

export interface PdfMeta {
  title: string;
  subject: string;
  keywords: string[];
}

// A fixed moment, so the same drawing is the same bytes on any day. It is the
// reference date of the synthetic set, not a claim about when a file was made.
const FIXED_DATE = new Date(Date.UTC(2026, 10, 2, 9, 0, 0));
const CREATOR = "OrderPilot synthetic-documents";

const color = ([r, g, b]: Color) => rgb(r, g, b);

/** Starts a document with every field of its metadata fixed, so nothing reads a clock. */
export async function newPdf(meta: PdfMeta): Promise<PDFDocument> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.registerFontkit(fontkit);
  doc.setTitle(meta.title);
  doc.setSubject(meta.subject);
  doc.setKeywords(meta.keywords);
  doc.setAuthor("Synthetic demo data");
  doc.setCreator(CREATOR);
  doc.setProducer(CREATOR);
  doc.setCreationDate(FIXED_DATE);
  doc.setModificationDate(FIXED_DATE);
  return doc;
}

/** Writes recorded pages as vector text. The fonts are embedded as subsets from the package's own files. */
export async function writeTextPdf(
  pages: readonly (readonly DrawOp[])[],
  meta: PdfMeta,
): Promise<Uint8Array> {
  const doc = await newPdf(meta);
  const fonts = new Map<FontId, PDFFont>();
  const fontFor = async (id: FontId): Promise<PDFFont> => {
    let font = fonts.get(id);
    if (!font) {
      // A fixed name: pdf-lib would otherwise add a random suffix.
      font = await doc.embedFont(loadFont(id).bytes, {
        subset: true,
        customName: `OPDEMO-${id}`,
      });
      fonts.set(id, font);
    }
    return font;
  };
  for (const ops of pages) {
    const page = doc.addPage([PAGE.width, PAGE.height]);
    for (const op of ops) {
      if (op.kind === "text") {
        page.drawText(op.text, {
          x: op.x,
          y: PAGE.height - op.y,
          size: op.size,
          font: await fontFor(op.font),
          color: color(op.color),
        });
      } else if (op.kind === "rect") {
        page.drawRectangle({
          x: op.box.x,
          y: PAGE.height - op.box.y - op.box.h,
          width: op.box.w,
          height: op.box.h,
          ...(op.fill ? { color: color(op.fill) } : {}),
          ...(op.stroke
            ? { borderColor: color(op.stroke), borderWidth: op.lineWidth }
            : { borderWidth: 0 }),
        });
      } else {
        page.drawLine({
          start: { x: op.from[0], y: PAGE.height - op.from[1] },
          end: { x: op.to[0], y: PAGE.height - op.to[1] },
          thickness: op.lineWidth,
          color: color(op.color),
        });
      }
    }
  }
  return doc.save({ useObjectStreams: false });
}
