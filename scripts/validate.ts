import fs from "fs";
import { parseCSV } from "./csv.ts";
import { log, group } from "./log.ts";

log("reading ./data/master.csv");
const csv = fs.readFileSync("./data/master.csv", "utf8");
log("reading ./data/countries.json");
const countries: Record<string, string> = JSON.parse(
  fs.readFileSync("./data/countries.json", "utf8")
);
log("reading ./data/territories.json");
const { codes: territoryCodes } = JSON.parse(
  fs.readFileSync("./data/territories.json", "utf8")
);
const territories = new Set<string>(territoryCodes);
log(`loaded ${Object.keys(countries).length} countries, ${territories.size} territory codes`);

const rows = parseCSV(csv);
const header = rows[0].join(",");
log(`header: ${header}`);

if (header !== "passport,destination,status,days,notes,source_url,last_verified,confidence,reciprocity") {
  throw new Error("Invalid CSV header");
}

const dataRows = rows.slice(1);
log(`validating ${dataRows.length} data rows`);
const validStatuses = new Set(["vf", "vo", "ev", "et", "vr"]);
const validConfidence = new Set(["unverified", "verified", "disputed"]);
const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const seen = new Set<string>();

group("validate: all rows", () => {
  for (const [index, row] of dataRows.entries()) {
    const rowNumber = index + 2;
    const [passport, destination, status, days, notes, sourceUrl, lastVerified, confidence, reciprocity] = row;
    log(`row ${rowNumber}: ${JSON.stringify(row)}`);

    if (!passport || passport.length !== 2)
      throw new Error(`Invalid passport code at row ${rowNumber}`);

    if (!destination || destination.length !== 2)
      throw new Error(`Invalid destination code at row ${rowNumber}`);

    if (passport === destination)
      throw new Error(`Self-reference at row ${rowNumber}`);

    if (!validStatuses.has(status))
      throw new Error(`Invalid status at row ${rowNumber}`);

    if (days && Number.isNaN(Number(days)))
      throw new Error(`Invalid days value at row ${rowNumber}`);

    if (sourceUrl && !/^https?:\/\//.test(sourceUrl))
      throw new Error(`Invalid source_url at row ${rowNumber}`);

    if (lastVerified && !dateRe.test(lastVerified))
      throw new Error(`Invalid last_verified date at row ${rowNumber} (expected YYYY-MM-DD)`);

    if (!validConfidence.has(confidence))
      throw new Error(`Invalid confidence at row ${rowNumber}`);

    if (!countries[passport])
      throw new Error(`Unknown passport code '${passport}' at row ${rowNumber} — add it to countries.json first`);

    if (!countries[destination])
      throw new Error(`Unknown destination code '${destination}' at row ${rowNumber} — add it to countries.json first`);

    if (territories.has(passport))
      throw new Error(`Territory code '${passport}' at row ${rowNumber} cannot be a passport`);

    const key = `${passport}:${destination}`;
    if (seen.has(key))
      throw new Error(`Duplicate route ${key} at row ${rowNumber}`);

    seen.add(key);
    log(`row ${rowNumber}: OK, key=${key}`);
  }
});

console.log(`✓ Validation passed (${dataRows.length} rows)`);
