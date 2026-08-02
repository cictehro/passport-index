import fs from "fs";
import { parseCSV } from "./csv.ts";
import { log, group } from "./log.ts";

log("reading ./data/master.csv");
const csv = fs.readFileSync("./data/master.csv", "utf8");
const rows = parseCSV(csv);
const header = rows[0];
const dataRows = rows.slice(1);
log(`parsed ${dataRows.length} rows, header=${JSON.stringify(header)}`);

const idx = (name: string) => header.indexOf(name);
const iPassport = idx("passport");
const iDest = idx("destination");
const iStatus = idx("status");
const iDays = idx("days");
const iNotes = idx("notes");
const iUrl = idx("source_url");
const iVerified = idx("last_verified");
const iConfidence = idx("confidence");
const iReciprocity = idx("reciprocity");
log(`column indices: passport=${iPassport} destination=${iDest} status=${iStatus} days=${iDays} notes=${iNotes} source_url=${iUrl} last_verified=${iVerified} confidence=${iConfidence} reciprocity=${iReciprocity}`);

const matrix: Record<string, Record<string, any>> = {};
const metadata: Record<string, { notes: string; source_url: string; last_verified: string; confidence: string; reciprocity: string }> = {};

group("build: matrix + metadata", () => {
  for (const [i, row] of dataRows.entries()) {
    const passport = row[iPassport];
    const destination = row[iDest];
    const status = row[iStatus];
    const days = row[iDays];

    matrix[passport] ??= {};
    matrix[passport][destination] = days && days.length > 0 ? [status, Number(days)] : [status];

    metadata[`${passport}:${destination}`] = {
      notes: row[iNotes] || "",
      source_url: row[iUrl] || "",
      last_verified: row[iVerified] || "",
      confidence: row[iConfidence] || "unverified",
      reciprocity: (iReciprocity >= 0 ? row[iReciprocity] : "") || "",
    };

    log(`row ${i + 2}: ${passport}->${destination} = ${JSON.stringify(matrix[passport][destination])}`);
  }
  log(`matrix built: ${Object.keys(matrix).length} passports`);
});

group("build: write files", () => {
  fs.writeFileSync("./data/passport_matrix.json", JSON.stringify(matrix, null, 2));
  log("wrote ./data/passport_matrix.json");
  fs.writeFileSync("./generated/route-metadata.json", JSON.stringify(metadata, null, 2));
  log(`wrote ./generated/route-metadata.json, ${Object.keys(metadata).length} entries`);
});

console.log("✓ passport_matrix.json generated");
console.log("✓ route-metadata.json generated");
