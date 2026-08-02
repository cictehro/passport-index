import fs from "fs";
import path from "path";
import { CODE_MAP } from "./code-map.ts";
import { NAME_MAP } from "./name-map.ts";
import { parseCSV, csvField } from "./csv.ts";
import { log, group } from "./log.ts";

const R_DATA_DIR = process.env.R_DATA_DIR ?? "../r-data";

const { codes: territoryCodes } = JSON.parse(
  fs.readFileSync("./data/territories.json", "utf8")
);
const territories = new Set<string>(territoryCodes);

const NAME_MAP_CI: Record<string, string> = {};
for (const [name, code] of Object.entries(NAME_MAP)) {
  NAME_MAP_CI[name.toLowerCase()] = code;
}
function resolveName(name: string): string | undefined {
  return NAME_MAP[name] ?? NAME_MAP_CI[name.trim().toLowerCase()];
}

function parseDays(allowedStay: string): string {
  const s = allowedStay.toLowerCase();
  const num = s.match(/\d+/);
  if (!num) return "";
  const n = parseInt(num[0], 10);
  if (s.includes("year")) return String(n * 365);
  if (s.includes("month")) return String(n * 30);
  return String(n);
}

function cleanNotes(notes: string): string {
  return notes.trim();
}

function mapStatus(requirement: string, requirementRaw: string): string | null {
  if (requirement === "visa_free") return "vf";
  if (requirement === "visa_on_arrival") return "vo";
  if (requirement === "visa_required") return "vr";
  if (requirement === "no_admission") return "vr";
  if (requirement === "eta_evisa") {
    const raw = requirementRaw.toLowerCase();
    if (/\beta\b|electronic travel/.test(raw)) return "et";
    return "ev";
  }
  return null;
}

type MasterRow = {
  passport: string;
  destination: string;
  status: string;
  days: string;
  notes: string;
  source_url: string;
  last_verified: string;
  confidence: string;
  reciprocity: string;
};

function main() {
  const visaPath = path.join(R_DATA_DIR, "visa_requirements.csv");
  log(`reading ${visaPath}`);
  const rawText = fs.readFileSync(visaPath, "utf8");
  const rows = parseCSV(rawText);
  const header = rows[0];
  const dataRows = rows.slice(1);
  log(`parsed ${dataRows.length} data rows, header=${JSON.stringify(header)}`);

  const idx = (name: string) => header.indexOf(name);
  const iPassport = idx("passport_code");
  const iDest = idx("destination_name");
  const iReq = idx("requirement");
  const iReqRaw = idx("requirement_raw");
  const iStay = idx("allowed_stay");
  const iNotes = idx("notes");
  const iUrl = idx("source_url");
  const iReciprocity = idx("reciprocity");
  log(`column indices: passport_code=${iPassport} destination_name=${iDest} requirement=${iReq} requirement_raw=${iReqRaw} allowed_stay=${iStay} notes=${iNotes} source_url=${iUrl} reciprocity=${iReciprocity}`);

  const seen = new Set<string>();
  const out: MasterRow[] = [];
  let skippedUnmapped = 0;
  let skippedUnknown = 0;
  let skippedDuplicate = 0;
  let skippedTerritoryPassport = 0;

  group("import: wikipedia pass", () => {
    for (const [i, r] of dataRows.entries()) {
      if (r.length < header.length) {
        log(`row ${i + 2}: skipped, ${r.length} fields < ${header.length} expected`);
        continue;
      }

      const rawPassport = r[iPassport];
      const rawDest = r[iDest];
      const requirement = r[iReq];
      const requirementRaw = r[iReqRaw];
      const allowedStay = r[iStay];
      const notes = r[iNotes];
      const sourceUrl = r[iUrl];
      const reciprocity = iReciprocity >= 0 ? r[iReciprocity] : "";

      const passport = CODE_MAP[rawPassport];
      const destination = resolveName(rawDest);

      if (!passport || !destination) {
        skippedUnmapped++;
        log(`row ${i + 2}: skipped (unmapped) rawPassport='${rawPassport}'->${passport} rawDest='${rawDest}'->${destination}`);
        continue;
      }

      if (territories.has(passport)) {
        skippedTerritoryPassport++;
        log(`row ${i + 2}: skipped (territory as passport) ${passport}:${destination}`);
        continue;
      }

      const status = mapStatus(requirement, requirementRaw);
      if (!status) {
        skippedUnknown++;
        log(`row ${i + 2}: skipped (unknown requirement) requirement='${requirement}' requirement_raw='${requirementRaw}'`);
        continue;
      }

      const key = `${passport}:${destination}`;
      if (seen.has(key)) {
        skippedDuplicate++;
        log(`row ${i + 2}: skipped (duplicate) key=${key}`);
        continue;
      }
      seen.add(key);

      log(`row ${i + 2}: accepted ${key} status=${status} days_raw='${allowedStay}' notes='${notes}' source_url='${sourceUrl}' reciprocity='${reciprocity}'`);
      out.push({
        passport,
        destination,
        status,
        days: parseDays(allowedStay),
        notes: cleanNotes(notes),
        source_url: sourceUrl,
        last_verified: "",
        confidence: "unverified",
        reciprocity: reciprocity || "",
      });
    }
    log(`wikipedia pass done: ${out.length} accepted, ${skippedUnmapped} unmapped, ${skippedUnknown} unknown, ${skippedDuplicate} duplicate`);
  });

  let backfilled = 0;
  const policyPath = path.join(R_DATA_DIR, "destination_policy.csv");
  group("import: destination-policy backfill", () => {
    log(`checking for ${policyPath}`);
    if (!fs.existsSync(policyPath)) {
      log(`${policyPath} does not exist, skipping backfill`);
      return;
    }
    const policyRows = parseCSV(fs.readFileSync(policyPath, "utf8"));
    const pHeader = policyRows[0];
    const pIdx = (name: string) => pHeader.indexOf(name);
    const iPDest = pIdx("destination_name");
    const iPSource = pIdx("source_country_name");
    const iPReq = pIdx("requirement");
    const iPReqRaw = pIdx("requirement_raw");
    const iPStay = pIdx("allowed_stay");
    const iPNotes = pIdx("notes");
    const iPUrl = pIdx("source_url");
    log(`parsed ${policyRows.length - 1} policy rows, header=${JSON.stringify(pHeader)}`);

    for (const [i, r] of policyRows.slice(1).entries()) {
      if (r.length < pHeader.length) {
        log(`policy row ${i + 2}: skipped, ${r.length} fields < ${pHeader.length} expected`);
        continue;
      }

      const passport = resolveName(r[iPSource]);
      const destination = resolveName(r[iPDest]);
      if (!passport || !destination) {
        log(`policy row ${i + 2}: skipped (unmapped) source='${r[iPSource]}'->${passport} dest='${r[iPDest]}'->${destination}`);
        continue;
      }

      if (territories.has(passport)) {
        skippedTerritoryPassport++;
        log(`policy row ${i + 2}: skipped (territory as passport) ${passport}:${destination}`);
        continue;
      }

      const key = `${passport}:${destination}`;
      if (seen.has(key)) {
        log(`policy row ${i + 2}: skipped, ${key} already seen from wikipedia pass`);
        continue;
      }

      const status = mapStatus(r[iPReq], r[iPReqRaw]);
      if (!status) {
        log(`policy row ${i + 2}: skipped (unknown requirement) requirement='${r[iPReq]}'`);
        continue;
      }

      seen.add(key);
      backfilled++;
      log(`policy row ${i + 2}: backfilled ${key} status=${status} source_url='${r[iPUrl]}'`);
      out.push({
        passport,
        destination,
        status,
        days: parseDays(r[iPStay]),
        notes: cleanNotes(r[iPNotes]),
        source_url: r[iPUrl],
        last_verified: "",
        confidence: "unverified",
        reciprocity: "",
      });
    }
    log(`backfill done: ${backfilled} rows added`);
  });

  group("import: sort and write master.csv", () => {
    out.sort((a, b) =>
      a.passport === b.passport
        ? a.destination.localeCompare(b.destination)
        : a.passport.localeCompare(b.passport)
    );
    log(`sorted ${out.length} rows`);

    const lines = ["passport,destination,status,days,notes,source_url,last_verified,confidence,reciprocity"];
    for (const [i, row] of out.entries()) {
      log(`writing row ${i + 1}/${out.length}: ${JSON.stringify(row)}`);
      lines.push(
        [
          row.passport,
          row.destination,
          row.status,
          row.days,
          csvField(row.notes),
          csvField(row.source_url),
          row.last_verified,
          row.confidence,
          csvField(row.reciprocity),
        ].join(",")
      );
    }

    fs.mkdirSync("./data", { recursive: true });
    fs.writeFileSync("./data/master.csv", lines.join("\n") + "\n");
    log(`wrote ./data/master.csv, ${lines.length - 1} data lines`);
  });

  console.log(`✓ master.csv written: ${out.length} rows`);
  console.log(`  skipped (unmapped code): ${skippedUnmapped}`);
  console.log(`  skipped (territory as passport): ${skippedTerritoryPassport}`);
  console.log(`  skipped (unknown/unclassified requirement): ${skippedUnknown}`);
  console.log(`  skipped (duplicate route): ${skippedDuplicate}`);
  console.log(`  backfilled from destination-policy (official sources): ${backfilled}`);
}

main();
