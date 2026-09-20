import { writeFile } from "node:fs/promises";

import { auditIndexingExport } from "./search-console-client.mjs";

function parseArgs(argv) {
  const options = {
    csvPath: "",
    output: "",
    timeoutMs: undefined,
    concurrency: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--csv" && argv[index + 1]) options.csvPath = argv[++index];
    else if (arg === "--output" && argv[index + 1]) options.output = argv[++index];
    else if (arg === "--timeout-ms" && argv[index + 1]) options.timeoutMs = Number(argv[++index]);
    else if (arg === "--concurrency" && argv[index + 1]) options.concurrency = Number(argv[++index]);
    else if (arg === "--help") {
      console.log("Usage: npm run search-console:audit -- --csv reports/indexing.csv [--output reports/audit.json] [--timeout-ms N] [--concurrency N]");
      return null;
    }
  }

  if (!options.csvPath) throw new Error("--csv is required");
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options) return;
  const report = await auditIndexingExport(options.csvPath, {
    allowedRoot: process.env.GSC_IMPORT_ROOT?.trim() || process.cwd(),
    canonicalOrigin: process.env.GSC_ALLOWED_ORIGIN?.trim() || "https://tahinspare.com",
    timeoutMs: options.timeoutMs,
    concurrency: options.concurrency,
  });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.output) await writeFile(options.output, json, "utf8");
  process.stdout.write(json);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
