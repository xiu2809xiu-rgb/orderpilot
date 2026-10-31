// Keeps client documents out of Git. Spectra's documents never go into Git
// (CLAUDE.md, the opening rules), and samples tried on one machine live in
// samples/, which .gitignore covers except for its README. The ignore rule
// stops a plain `git add`, but not `git add -f`, nor a folder called samples
// somewhere else. This check stops both.
//
// Refused:
//   - anything in the root samples/ folder except samples/README.md;
//   - a document-type file (PDF, image, spreadsheet, email and so on) inside
//     any folder called samples, at any depth, in any letter case.
//
// Usage:
//   node scripts/check-samples.mjs                 every tracked file
//   node scripts/check-samples.mjs --staged        what the next commit would write
//   node scripts/check-samples.mjs --history       every commit in HEAD's history
//   node scripts/check-samples.mjs -- <revisions>  the commits `git log <revisions>` lists

import { pathsInCommits, stagedFiles, trackedFiles } from "./lib/git.mjs";
import { report } from "./lib/report.mjs";

// The document types a client could send, and the containers they come in.
export const CLIENT_DOCUMENT_EXTENSIONS = new Set([
  "7z",
  "bmp",
  "csv",
  "doc",
  "docx",
  "eml",
  "gif",
  "gz",
  "heic",
  "htm",
  "html",
  "jpeg",
  "jpg",
  "json",
  "msg",
  "ods",
  "odt",
  "pdf",
  "png",
  "ppt",
  "pptx",
  "rar",
  "rtf",
  "tar",
  "tgz",
  "tif",
  "tiff",
  "txt",
  "webp",
  "xls",
  "xlsm",
  "xlsx",
  "xml",
  "zip",
]);

const ADVICE = [
  "Client documents never go into Git. Keep samples in the root samples/ folder,",
  "which Git ignores, and remove these files from the commit:",
  "  git rm --cached <file>",
  "Synthetic fixtures belong in a folder with another name, such as fixtures/.",
  "If one is already in a pushed commit, stop and tell Richie: it must be purged.",
].join("\n");

/**
 * Why a repository path is refused, or undefined if it is allowed.
 *
 * @param {string} path A repository-relative path with forward slashes.
 * @returns {string | undefined}
 */
export function refusalFor(path) {
  const segments = path.split("/");
  const folders = segments.slice(0, -1).map((part) => part.toLowerCase());
  const name = segments.at(-1) ?? "";

  if (folders[0] === "samples" && path !== "samples/README.md") {
    return "only samples/README.md may be committed from the root samples/ folder";
  }
  const dot = name.lastIndexOf(".");
  const extension = dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
  if (
    folders.includes("samples") &&
    CLIENT_DOCUMENT_EXTENSIONS.has(extension)
  ) {
    return `a .${extension} file inside a samples folder looks like a client document`;
  }
  return undefined;
}

/**
 * @param {string[]} argv
 * @param {string} [cwd]
 * @returns {number} the exit code
 */
export function main(argv, cwd = process.cwd()) {
  /** @type {string[]} */
  const problems = [];
  const separator = argv.indexOf("--");

  if (argv.includes("--history") || separator !== -1) {
    const revisions = separator === -1 ? ["HEAD"] : argv.slice(separator + 1);
    /** @type {Set<string>} */
    const seen = new Set();
    for (const { commit, path } of pathsInCommits(revisions, cwd)) {
      const reason = refusalFor(path);
      const key = `${commit} ${path}`;
      if (reason !== undefined && !seen.has(key)) {
        seen.add(key);
        problems.push(`${path} in commit ${commit.slice(0, 12)}: ${reason}`);
      }
    }
  } else {
    const paths = argv.includes("--staged")
      ? stagedFiles(cwd)
      : trackedFiles(cwd);
    for (const path of paths) {
      const reason = refusalFor(path);
      if (reason !== undefined) problems.push(`${path}: ${reason}`);
    }
  }

  return report("check-samples", problems, ADVICE);
}

if (import.meta.main) {
  process.exitCode = main(process.argv.slice(2));
}
