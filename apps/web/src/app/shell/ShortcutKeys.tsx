import { keyParts, type Shortcut } from "./shortcutRegistry";

/** The keys of a shortcut, one small `kbd` for each part: Ctrl and K. */
export function ShortcutKeys({ entry }: { entry: Shortcut }) {
  return (
    <span className="inline-flex items-center gap-1">
      {keyParts(entry).map((part) => (
        <kbd key={part} className="dx-kbd">
          {part}
        </kbd>
      ))}
    </span>
  );
}
