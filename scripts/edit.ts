import fs from "fs";
import { parseCSV, csvField } from "./csv.ts";

// ============================================================
// passport-index edit CLI
// Usage:
//   npm run edit -- add <passport> <destination> <status> [days]
//   npm run edit -- remove <passport> <destination>
//   npm run edit -- lookup <passport> <destination>
//   npm run edit -- passport <code>
//   npm run edit -- destination <code>
// ============================================================

const CSV_PATH = "./data/master.csv";
const VALID_STATUSES = new Set(["vf", "vo", "ev", "et", "vr"]);

interface Row {
  passport: string;
  destination: string;
  status: string;
  days: string;
  notes: string;
  sourceUrl: string;
  lastVerified: string;
  confidence: string;
  reciprocity: string;
  footnoteIds: string;
}

function readCSV(): Row[] {
  const content = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parseCSV(content).slice(1); // skip header
  return rows.map((r) => {
    const [passport, destination, status, days = "", notes = "", sourceUrl = "", lastVerified = "", confidence = "unverified", reciprocity = "", footnoteIds = ""] = r;
    return { passport, destination, status, days, notes, sourceUrl, lastVerified, confidence, reciprocity, footnoteIds };
  });
}

function writeCSV(rows: Row[]): void {
  const sorted = rows.sort((a, b) =>
    a.passport !== b.passport
      ? a.passport.localeCompare(b.passport)
      : a.destination.localeCompare(b.destination)
  );
  const lines = sorted.map((r) =>
    [r.passport, r.destination, r.status, r.days, csvField(r.notes), csvField(r.sourceUrl), r.lastVerified, r.confidence || "unverified", csvField(r.reciprocity || ""), csvField(r.footnoteIds || "")].join(",")
  );
  fs.writeFileSync(
    CSV_PATH,
    ["passport,destination,status,days,notes,source_url,last_verified,confidence,reciprocity,footnote_ids", ...lines].join("\n") + "\n"
  );
}

function validate(passport: string, destination: string, status?: string): void {
  if (passport.length !== 2) throw new Error(`Invalid passport code: ${passport}`);
  if (destination.length !== 2) throw new Error(`Invalid destination code: ${destination}`);
  if (passport === destination) throw new Error(`Passport and destination cannot be the same`);
  if (status && !VALID_STATUSES.has(status)) throw new Error(`Invalid status: ${status}. Must be one of: vf, vo, ev, et, vr`);
}

const [, , command, ...args] = process.argv;

switch (command) {
  case "add": {
    const [passport, destination, status, ...rest] = args;
    if (!passport || !destination || !status) {
      console.error("Usage: npm run edit -- add <passport> <destination> <status> [days] [--source=url] [--verified=YYYY-MM-DD] [--confidence=verified|unverified|disputed]");
      process.exit(1);
    }
    const flags = rest.filter((a) => a.startsWith("--"));
    const positional = rest.filter((a) => !a.startsWith("--"));

    const flagValue = (name: string): string => {
      const flag = flags.find((f) => f.startsWith(`--${name}=`));
      return flag ? flag.slice(name.length + 3) : "";
    };

    const p = passport.toUpperCase();
    const d = destination.toUpperCase();
    validate(p, d, status);

    const rows = readCSV();
    const existing = rows.findIndex((r) => r.passport === p && r.destination === d);
    const old = existing >= 0 ? rows[existing] : undefined;

    const days = positional[0] ?? old?.days ?? "";
    const sourceUrl = flagValue("source") || old?.sourceUrl || "";
    const lastVerified = flagValue("verified") || old?.lastVerified || "";
    const confidence = flagValue("confidence") || old?.confidence || "unverified";

    if (old) {
      rows[existing] = { passport: p, destination: d, status, days, notes: old.notes, sourceUrl, lastVerified, confidence, reciprocity: old.reciprocity || "", footnoteIds: old.footnoteIds || "" };
      writeCSV(rows);
      console.log(`✓ Updated ${p} → ${d}: ${old.status} → ${status}`);
    } else {
      rows.push({ passport: p, destination: d, status, days, notes: "", sourceUrl, lastVerified, confidence, reciprocity: "", footnoteIds: "" });
      writeCSV(rows);
      console.log(`✓ Added ${p} → ${d}: ${status}`);
    }
    break;
  }

  case "remove": {
    const [passport, destination] = args;
    if (!passport || !destination) {
      console.error("Usage: npm run edit -- remove <passport> <destination>");
      process.exit(1);
    }
    const p = passport.toUpperCase();
    const d = destination.toUpperCase();

    const rows = readCSV();
    const before = rows.length;
    const filtered = rows.filter((r) => !(r.passport === p && r.destination === d));

    if (filtered.length === before) {
      console.error(`✗ Route not found: ${p} → ${d}`);
      process.exit(1);
    }

    writeCSV(filtered);
    console.log(`✓ Removed ${p} → ${d}`);
    break;
  }

  case "lookup": {
    const [passport, destination] = args;
    if (!passport || !destination) {
      console.error("Usage: npm run edit -- lookup <passport> <destination>");
      process.exit(1);
    }
    const p = passport.toUpperCase();
    const d = destination.toUpperCase();

    const rows = readCSV();
    const row = rows.find((r) => r.passport === p && r.destination === d);

    if (!row) {
      console.log(`No route found: ${p} → ${d}`);
    } else {
      const labels: Record<string, string> = { vf: "Visa Free", vo: "Visa on Arrival", ev: "eVisa", et: "ETA", vr: "Visa Required" };
      console.log(`${p} → ${d}: ${labels[row.status] ?? row.status}${row.days ? ` (${row.days} days)` : ""}`);
      console.log(`  confidence: ${row.confidence || "unverified"}`);
      if (row.lastVerified) console.log(`  last verified: ${row.lastVerified}`);
      if (row.sourceUrl) console.log(`  source: ${row.sourceUrl}`);
      if (row.notes) console.log(`  notes: ${row.notes}`);
    }
    break;
  }

  case "passport": {
    const [code] = args;
    if (!code) {
      console.error("Usage: npm run edit -- passport <code>");
      process.exit(1);
    }
    const p = code.toUpperCase();
    const rows = readCSV().filter((r) => r.passport === p);

    if (rows.length === 0) {
      console.log(`No routes found for passport: ${p}`);
    } else {
      const grouped: Record<string, string[]> = { vf: [], vo: [], ev: [], et: [], vr: [] };
      for (const r of rows) grouped[r.status]?.push(r.destination);
      console.log(`\n${p} passport (${rows.length} destinations)\n`);
      const labels: Record<string, string> = { vf: "Visa Free", vo: "Visa on Arrival", ev: "eVisa", et: "ETA", vr: "Visa Required" };
      for (const [status, dests] of Object.entries(grouped)) {
        if (dests.length) console.log(`  ${labels[status]} (${dests.length}): ${dests.join(", ")}`);
      }
    }
    break;
  }

  case "destination": {
    const [code] = args;
    if (!code) {
      console.error("Usage: npm run edit -- destination <code>");
      process.exit(1);
    }
    const d = code.toUpperCase();
    const rows = readCSV().filter((r) => r.destination === d);

    if (rows.length === 0) {
      console.log(`No routes found for destination: ${d}`);
    } else {
      const grouped: Record<string, string[]> = { vf: [], vo: [], ev: [], et: [], vr: [] };
      for (const r of rows) grouped[r.status]?.push(r.passport);
      console.log(`\n${d} as destination (${rows.length} passports)\n`);
      const labels: Record<string, string> = { vf: "Visa Free", vo: "Visa on Arrival", ev: "eVisa", et: "ETA", vr: "Visa Required" };
      for (const [status, passports] of Object.entries(grouped)) {
        if (passports.length) console.log(`  ${labels[status]} (${passports.length}): ${passports.join(", ")}`);
      }
    }
    break;
  }

  default: {
    console.log(`
passport-index edit CLI

Commands:
  add <passport> <destination> <status> [days] [--source=url] [--verified=YYYY-MM-DD] [--confidence=verified|unverified|disputed]
  remove <passport> <destination>                Remove a route
  lookup <passport> <destination>                Check a single route
  passport <code>                                Show all routes for a passport
  destination <code>                             Show all passports for a destination

Status codes: vf (Visa Free), vo (Visa on Arrival), ev (eVisa), et (ETA), vr (Visa Required)
Confidence: verified (checked against an official source), unverified (default), disputed (sources disagree)

Examples:
  npm run edit -- add KE US vf 90
  npm run edit -- add KE US vf 90 --source=https://travel.state.gov --verified=2026-07-12 --confidence=verified
  npm run edit -- remove KE US
  npm run edit -- lookup KE SG
  npm run edit -- passport KE
  npm run edit -- destination US
    `);
  }
}
