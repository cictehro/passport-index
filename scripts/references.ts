import fs from "fs";
import path from "path";
import { CODE_MAP } from "./code-map.ts";
import { parseCSV } from "./csv.ts";
import { log, group } from "./log.ts";

const R_DATA_DIR = process.env.R_DATA_DIR ?? "../r-data";

const byPassport: Record<string, Record<string, string>> = {};

group("references: parse and group", () => {
  const csvPath = path.join(R_DATA_DIR, "references.csv");
  log(`reading ${csvPath}`);

  if (!fs.existsSync(csvPath)) {
    log(`${csvPath} does not exist, writing empty references.json`);
    return;
  }

  const rows = parseCSV(fs.readFileSync(csvPath, "utf8"));
  const header = rows[0];
  const dataRows = rows.slice(1);
  log(`parsed ${dataRows.length} rows, header=${JSON.stringify(header)}`);

  const idx = (name: string) => header.indexOf(name);
  const iPassport = idx("passport_code");
  const iFootnoteId = idx("footnote_id");
  const iText = idx("text");

  let skippedUnmapped = 0;
  for (const [i, r] of dataRows.entries()) {
    const rawPassport = r[iPassport];
    const footnoteId = r[iFootnoteId] ?? "";
    const text = r[iText] ?? "";

    const passport = CODE_MAP[rawPassport];
    if (!passport || !footnoteId) {
      skippedUnmapped++;
      log(`row ${i + 2}: skipped (unmapped passport or empty footnote_id) rawPassport='${rawPassport}'->${passport} footnote_id='${footnoteId}'`);
      continue;
    }

    byPassport[passport] ??= {};
    byPassport[passport][footnoteId] = text;
  }

  log(`grouped into ${Object.keys(byPassport).length} passports, ${skippedUnmapped} rows skipped (unmapped)`);
});

group("references: write file", () => {
  fs.mkdirSync("./generated", { recursive: true });
  fs.writeFileSync("./generated/references.json", JSON.stringify(byPassport, null, 2));
  log("wrote ./generated/references.json");
});

const totalRefs = Object.values(byPassport).reduce((a, b) => a + Object.keys(b).length, 0);
console.log(`✓ References: ${Object.keys(byPassport).length} passports, ${totalRefs} unique footnotes (deduped, not per-route)`);
