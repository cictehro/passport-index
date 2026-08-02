import fs from "fs";
import path from "path";
import { CODE_MAP } from "./code-map.ts";
import { parseCSV } from "./csv.ts";
import { log, group } from "./log.ts";

const R_DATA_DIR = process.env.R_DATA_DIR ?? "../r-data";

interface TerritoryEntry {
  region: string;
  name: string;
  description: string;
  source_url: string;
}

const byPassport: Record<string, TerritoryEntry[]> = {};

group("territories: parse and group", () => {
  const csvPath = path.join(R_DATA_DIR, "territory_notes.csv");
  log(`reading ${csvPath}`);

  if (!fs.existsSync(csvPath)) {
    log(`${csvPath} does not exist, writing empty territory-notes.json`);
    return;
  }

  const rows = parseCSV(fs.readFileSync(csvPath, "utf8"));
  const header = rows[0];
  const dataRows = rows.slice(1);
  log(`parsed ${dataRows.length} rows, header=${JSON.stringify(header)}`);

  const idx = (name: string) => header.indexOf(name);
  const iPassport = idx("passport_code");
  const iRegion = idx("region");
  const iName = idx("territory_name");
  const iDescription = idx("description");
  const iUrl = idx("source_url");

  let skippedUnmapped = 0;
  for (const [i, r] of dataRows.entries()) {
    const rawPassport = r[iPassport];
    const region = r[iRegion] ?? "";
    const name = r[iName] ?? "";
    const description = r[iDescription] ?? "";
    const sourceUrl = r[iUrl] ?? "";

    const passport = CODE_MAP[rawPassport];
    if (!passport || !name) {
      skippedUnmapped++;
      log(`row ${i + 2}: skipped (unmapped passport or empty name) rawPassport='${rawPassport}'->${passport} name='${name}'`);
      continue;
    }

    byPassport[passport] ??= [];
    byPassport[passport].push({ region, name, description, source_url: sourceUrl });
    log(`row ${i + 2}: ${passport} -> region='${region}' name='${name}'`);
  }

  log(`grouped into ${Object.keys(byPassport).length} passports, ${skippedUnmapped} rows skipped (unmapped)`);
});

group("territories: write file", () => {
  fs.mkdirSync("./generated", { recursive: true });
  fs.writeFileSync("./generated/territory-notes.json", JSON.stringify(byPassport, null, 2));
  log("wrote ./generated/territory-notes.json");
});

const totalEntries = Object.values(byPassport).reduce((a, b) => a + b.length, 0);
console.log(`✓ Territory notes: ${Object.keys(byPassport).length} passports, ${totalEntries} entries`);
