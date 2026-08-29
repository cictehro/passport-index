import fs from "fs";
import path from "path";
import { NAME_MAP } from "./name-map.ts";
import { parseCSV } from "./csv.ts";
import { log, group } from "./log.ts";

const R_DATA_DIR = process.env.R_DATA_DIR ?? "../r-data";

const NAME_MAP_CI: Record<string, string> = {};
for (const [name, code] of Object.entries(NAME_MAP)) {
  NAME_MAP_CI[name.toLowerCase()] = code;
}
function resolveCode(name: string): string | undefined {
  return NAME_MAP[name] ?? NAME_MAP_CI[name.trim().toLowerCase()];
}

type Program = Record<string, string>;

const byCountry: Record<string, Program[]> = {};

group("investment-migration: parse and group", () => {
  const csvPath = path.join(R_DATA_DIR, "investment_migration.csv");
  log(`reading ${csvPath}`);

  if (!fs.existsSync(csvPath)) {
    log(`${csvPath} does not exist, writing empty investment-migration.json`);
    return;
  }

  const rows = parseCSV(fs.readFileSync(csvPath, "utf8"));
  const header = rows[0];
  const dataRows = rows.slice(1);
  log(`parsed ${dataRows.length} rows, header=${JSON.stringify(header)}`);

  const iName = header.indexOf("country_name");

  let skippedUnmapped = 0;
  for (const [i, r] of dataRows.entries()) {
    const countryName = r[iName];
    const code = resolveCode(countryName);
    if (!code) {
      skippedUnmapped++;
      log(`row ${i + 2}: skipped (unmapped country) countryName='${countryName}'`);
      continue;
    }

    const program: Program = {};
    for (const [colIdx, col] of header.entries()) {
      if (col === "country_name") continue;
      program[col] = r[colIdx] ?? "";
    }

    byCountry[code] ??= [];
    byCountry[code].push(program);
  }

  log(`grouped into ${Object.keys(byCountry).length} countries, ${skippedUnmapped} rows skipped (unmapped)`);
});

group("investment-migration: write file", () => {
  fs.mkdirSync("./generated", { recursive: true });
  fs.writeFileSync("./generated/investment-migration.json", JSON.stringify(byCountry, null, 2));
  log("wrote ./generated/investment-migration.json");
});

const totalPrograms = Object.values(byCountry).reduce((a, b) => a + b.length, 0);
console.log(`✓ Investment migration: ${Object.keys(byCountry).length} countries, ${totalPrograms} programs`);
