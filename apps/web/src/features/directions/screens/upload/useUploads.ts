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
  const count = useRef(0);

  const patch = useCallback((id: number, row: UploadRow) => {
    setRows((all) => all.map((item) => (item.id === id ? row : item)));
  }, []);

  const add = useCallback(
    (files: readonly File[]) => {
      for (const file of files) {
        const id = next.current;
        next.current += 1;
        const early =
          count.current >= MAX_FILES
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
        count.current += 1;
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
              count.current -= 1;
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
            count.current -= 1;
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
    [patch],
  );

  const remove = useCallback((id: number) => {
    setRows((all) => {
      const gone = all.find((item) => item.id === id);
      if (gone && gone.status !== "refused") count.current -= 1;
      return all.filter((item) => item.id !== id);
    });
  }, []);

  const ready = rows.filter((row) => row.status === "ready").length;
  return { rows, add, remove, ready };
}
