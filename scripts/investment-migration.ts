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

type Program = {
  program_type: string;
  program_name: string;
  min_investment: string;
  currency: string;
  investment_route: string;
  processing_time: string;
  physical_presence_requirement: string;
  due_diligence: string;
  family_inclusion: string;
  path_to_citizenship: string;
  status: string;
  source_url: string;
};

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

  const idx = (name: string) => header.indexOf(name);
  const iName = idx("country_name");
  const iType = idx("program_type");
  const iProgram = idx("program_name");
  const iMin = idx("min_investment");
  const iCurrency = idx("currency");
  const iRoute = idx("investment_route");
  const iProcessing = idx("processing_time");
  const iPresence = idx("physical_presence_requirement");
  const iDueDiligence = idx("due_diligence");
  const iFamily = idx("family_inclusion");
  const iPath = idx("path_to_citizenship");
  const iStatus = idx("status");
  const iSource = idx("source_url");

  let skippedUnmapped = 0;
  for (const [i, r] of dataRows.entries()) {
    const countryName = r[iName];
    const code = resolveCode(countryName);
    if (!code) {
      skippedUnmapped++;
      log(`row ${i + 2}: skipped (unmapped country) countryName='${countryName}'`);
      continue;
    }

    byCountry[code] ??= [];
    byCountry[code].push({
      program_type: r[iType] ?? "",
      program_name: r[iProgram] ?? "",
      min_investment: r[iMin] ?? "",
      currency: r[iCurrency] ?? "",
      investment_route: r[iRoute] ?? "",
      processing_time: r[iProcessing] ?? "",
      physical_presence_requirement: r[iPresence] ?? "",
      due_diligence: r[iDueDiligence] ?? "",
      family_inclusion: r[iFamily] ?? "",
      path_to_citizenship: r[iPath] ?? "",
      status: r[iStatus] ?? "",
      source_url: r[iSource] ?? "",
    });
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
