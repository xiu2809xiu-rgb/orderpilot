import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { generateDemoFiles } from "../files.js";

/** Where the files go: the web app serves them, so the upload area can offer them to anyone. */
export const DEMO_FOLDER = fileURLToPath(
  new URL("../../../../apps/web/public/demo-documents/", import.meta.url),
);

async function existing(name: string): Promise<Buffer | null> {
  try {
    return await readFile(`${DEMO_FOLDER}${name}`);
  } catch {
    return null;
  }
}

/** Writes the demo files, or with `--check` says which differ from the committed ones. */
async function main(): Promise<void> {
  const check = process.argv.includes("--check");
  const files = await generateDemoFiles();
  const stale: string[] = [];
  for (const file of files) {
    const current = await existing(file.name);
    if (current && Buffer.compare(current, file.bytes) === 0) continue;
    stale.push(file.name);
    if (!check) {
      await mkdir(DEMO_FOLDER, { recursive: true });
      await writeFile(`${DEMO_FOLDER}${file.name}`, file.bytes);
    }
  }
  const known = new Set(files.map((f) => f.name));
  const extra = (await readdir(DEMO_FOLDER).catch(() => [])).filter(
    (name) => !known.has(name),
  );
  if (check) {
    const problems = [...stale, ...extra.map((n) => `${n} (not generated)`)];
    if (problems.length > 0) {
      console.error(
        `Out of date: ${problems.join(", ")}. Run pnpm docs:generate.`,
      );
      process.exitCode = 1;
      return;
    }
    console.log(`All ${String(files.length)} demo files are up to date.`);
    return;
  }
  console.log(
    `${String(files.length)} files in ${DEMO_FOLDER}: ${String(stale.length)} written, ${String(files.length - stale.length)} unchanged.`,
  );
  if (extra.length > 0) {
    console.warn(`Not generated, so left alone: ${extra.join(", ")}`);
  }
}

await main();
