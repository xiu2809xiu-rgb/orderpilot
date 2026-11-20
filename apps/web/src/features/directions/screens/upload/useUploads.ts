import { useCallback, useRef, useState } from "react";
import {
  checkFile,
  precheck,
  MAX_FILES,
  type AcceptedKind,
  type Refusal,
} from "./uploadRules";

export type UploadRow =
  | {
      id: number;
      name: string;
      size: number;
      status: "reading";
      /** 0 to 1: how much of the file the browser has read. */
      progress: number;
    }
  | {
      id: number;
      name: string;
      size: number;
      status: "ready";
      kind: AcceptedKind;
    }
  | {
      id: number;
      name: string;
      size: number;
      status: "refused";
      reason: Refusal | "unreadable";
      claimed?: string;
    };

/** Reads a file in the browser, reporting how far it has got; resolves with its first bytes. */
function readFile(
  file: File,
  onProgress: (ratio: number) => void,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    reader.onerror = () => {
      reject(new Error("unreadable"));
    };
    reader.onload = () => {
      const buffer = reader.result;
      if (buffer instanceof ArrayBuffer) {
        onProgress(1);
        resolve(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 4096)));
      } else {
        reject(new Error("unreadable"));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * The files a person has added. Each is read in the browser, with real
 * progress, and its first bytes are checked against its name and size: a file
 * that fails says why at once. Nothing is sent anywhere. Files beyond the limit
 * are refused, one by one, so the person sees which.
 */
export function useUploads() {
  const [rows, setRows] = useState<UploadRow[]>([]);
  const next = useRef(1);
  // The files that count towards the limit, by row id, each with the key that
  // makes a second copy of it a duplicate. A file leaves this map once, however
  // it leaves (refused after its read, failed, or removed while still being
  // read), so a count that is only lowered and raised can never drift.
  const live = useRef(new Map<number, string>());
  const release = useCallback((id: number) => {
    live.current.delete(id);
  }, []);

  const patch = useCallback((id: number, row: UploadRow) => {
    setRows((all) => all.map((item) => (item.id === id ? row : item)));
  }, []);

  const add = useCallback(
    (files: readonly File[]) => {
      for (const file of files) {
        const id = next.current;
        next.current += 1;
        const key = `${file.name}\u0000${String(file.size)}\u0000${String(file.lastModified)}`;
        const early = [...live.current.values()].includes(key)
          ? "duplicate"
          : live.current.size >= MAX_FILES
            ? "tooMany"
            : precheck(file.name, file.size);
        if (early) {
          setRows((all) => [
            ...all,
            {
              id,
              name: file.name,
              size: file.size,
              status: "refused",
              reason: early,
            },
          ]);
          continue;
        }
        live.current.set(id, key);
        setRows((all) => [
          ...all,
          {
            id,
            name: file.name,
            size: file.size,
            status: "reading",
            progress: 0,
          },
        ]);
        readFile(file, (ratio) => {
          setRows((all) =>
            all.map((item) =>
              item.id === id && item.status === "reading"
                ? { ...item, progress: ratio }
                : item,
            ),
          );
        })
          .then((head) => {
            const verdict = checkFile(file.name, file.size, head);
            if (verdict.ok) {
              patch(id, {
                id,
                name: file.name,
                size: file.size,
                status: "ready",
                kind: verdict.kind,
              });
            } else {
              release(id);
              patch(id, {
                id,
                name: file.name,
                size: file.size,
                status: "refused",
                reason: verdict.reason,
                claimed: verdict.claimed,
              });
            }
          })
          .catch(() => {
            release(id);
            patch(id, {
              id,
              name: file.name,
              size: file.size,
              status: "refused",
              reason: "unreadable",
            });
          });
      }
    },
    [patch, release],
  );

  const remove = useCallback(
    (id: number) => {
      release(id);
      setRows((all) => all.filter((item) => item.id !== id));
    },
    [release],
  );

  const ready = rows.filter((row) => row.status === "ready").length;
  return { rows, add, remove, ready };
}
