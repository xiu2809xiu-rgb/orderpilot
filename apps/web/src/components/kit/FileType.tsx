// Kit: ReUI / file-type. Licence: MIT. Adapted to OrderPilot's tokens.
import { cn } from "@/lib/utils";

type Family = "document" | "image" | "sheet" | "other";

// Only the five types the upload accepts, plus a plain fallback. ReUI's table
// covers hundreds of formats and brand colours; none of that is used here.
const FAMILY: Record<string, Family> = {
  pdf: "document",
  png: "image",
  jpg: "image",
  jpeg: "image",
  xlsx: "sheet",
  csv: "sheet",
};

const TONE: Record<Family, string> = {
  document: "text-destructive",
  image: "text-(--info)",
  sheet: "text-success",
  other: "text-muted-foreground",
};

/** The extension of a file name, lower case, or an empty string. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

interface FileTypeProps {
  /** A file name or an extension: "po-0102.pdf" and "pdf" both work. */
  name: string;
  /** Side of the icon in pixels. */
  size?: number;
  /** Names the kind for a screen reader. Leave out when the file name sits beside it. */
  label?: string;
  className?: string;
}

/**
 * A small page with a folded corner and its extension on a band, in the colour
 * of its family (documents, images, sheets). The extension is printed on the
 * icon, so the family is never colour alone. It marks a file in the upload
 * list and in an order's documents.
 */
export function FileType({ name, size = 32, label, className }: FileTypeProps) {
  const ext = name.includes(".") ? extensionOf(name) : name.toLowerCase();
  const family = FAMILY[ext] ?? "other";
  const band = ext.slice(0, 4).toUpperCase();
  return (
    <svg
      viewBox="0 0 32 40"
      width={size}
      height={(size * 40) / 32}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0", TONE[family], className)}
    >
      <path
        d="M4 2h16l8 8v28H4z"
        fill="var(--card)"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M20 2v8h8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect x="4" y="24" width="24" height="10" fill="currentColor" />
      <text
        x="16"
        y="31.6"
        textAnchor="middle"
        fontSize="7"
        fontWeight="700"
        fill="var(--card)"
      >
        {band}
      </text>
    </svg>
  );
}
