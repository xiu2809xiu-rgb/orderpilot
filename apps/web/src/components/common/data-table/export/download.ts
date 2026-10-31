/** Hands bytes to the browser as a file download. */
export function downloadFile(
  fileName: string,
  data: BlobPart,
  mimeType: string,
): void {
  const url = URL.createObjectURL(new Blob([data], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoke after the click has been handled.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

export const CSV_MIME = "text/csv;charset=utf-8";
export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
