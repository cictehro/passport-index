import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { parseCSV } from "../scripts/csv.ts";

describe("validate", () => {
  const csvPath = "./data/master.csv";
  const countriesPath = "./data/countries.json";
  const territoriesPath = "./data/territories.json";

  const HEADER = "passport,destination,status,days,notes,source_url,last_verified,confidence,reciprocity,footnote_ids";

  function readRows() {
    const rows = parseCSV(fs.readFileSync(csvPath, "utf8"));
    return rows.slice(1);
  }

  it("master.csv exists", () => {
    assert.ok(fs.existsSync(csvPath), "master.csv missing");
  });

  it("header is correct", () => {
    const rows = parseCSV(fs.readFileSync(csvPath, "utf8"));
    assert.equal(rows[0].join(","), HEADER);
  });

  it("has rows beyond the header", () => {
    assert.ok(readRows().length > 0, "CSV has no data rows");
  });

  it("all codes are 2 characters", () => {
    for (const [i, row] of readRows().entries()) {
      const [passport, destination] = row;
      assert.equal(passport.length, 2, `Bad passport at row ${i + 2}: '${passport}'`);
      assert.equal(destination.length, 2, `Bad destination at row ${i + 2}: '${destination}'`);
    }
  });

  it("no self-references", () => {
    for (const [i, row] of readRows().entries()) {
      const [passport, destination] = row;
      assert.notEqual(passport, destination, `Self-reference at row ${i + 2}: ${passport}`);
    }
  });

  it("all statuses are valid", () => {
    const valid = new Set(["vf", "vo", "ev", "et", "vr"]);
    for (const [i, row] of readRows().entries()) {
      const status = row[2];
      assert.ok(valid.has(status), `Invalid status '${status}' at row ${i + 2}`);
    }
  });

  it("no duplicate routes", () => {
    const seen = new Set<string>();
    for (const [i, row] of readRows().entries()) {
      const [passport, destination] = row;
      const key = `${passport}:${destination}`;
      assert.ok(!seen.has(key), `Duplicate route ${key} at row ${i + 2}`);
      seen.add(key);
    }
  });

  it("all codes exist in countries.json", () => {
    const countries = JSON.parse(fs.readFileSync(countriesPath, "utf8"));
    for (const [i, row] of readRows().entries()) {
      const [passport, destination] = row;
      assert.ok(countries[passport], `Unknown passport '${passport}' at row ${i + 2}`);
      assert.ok(countries[destination], `Unknown destination '${destination}' at row ${i + 2}`);
    }
  });

  it("territories never appear as a passport", () => {
    const { codes } = JSON.parse(fs.readFileSync(territoriesPath, "utf8"));
    const territories = new Set<string>(codes);
    for (const [i, row] of readRows().entries()) {
      const passport = row[0];
      assert.ok(!territories.has(passport), `Territory '${passport}' used as passport at row ${i + 2}`);
    }
  });

  it("days field is numeric when present", () => {
    for (const [i, row] of readRows().entries()) {
      const days = row[3];
      if (days && days.trim() !== "") {
        assert.ok(!Number.isNaN(Number(days)), `Invalid days '${days}' at row ${i + 2}`);
      }
    }
  });

  it("confidence is a valid value on every row", () => {
    const valid = new Set(["unverified", "verified", "disputed"]);
    for (const [i, row] of readRows().entries()) {
      const confidence = row[7];
      assert.ok(valid.has(confidence), `Invalid confidence '${confidence}' at row ${i + 2}`);
    }
  });

  it("last_verified is YYYY-MM-DD when present", () => {
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    for (const [i, row] of readRows().entries()) {
      const lastVerified = row[6];
      if (lastVerified && lastVerified.trim() !== "") {
        assert.ok(dateRe.test(lastVerified), `Invalid last_verified '${lastVerified}' at row ${i + 2}`);
      }
    }
  });

  it("source_url is http(s) when present", () => {
    for (const [i, row] of readRows().entries()) {
      const sourceUrl = row[5];
      if (sourceUrl && sourceUrl.trim() !== "") {
        assert.ok(/^https?:\/\//.test(sourceUrl), `Invalid source_url '${sourceUrl}' at row ${i + 2}`);
      }
    }
  });

  it("reciprocity is Yes, No, or empty", () => {
    const valid = new Set(["Yes", "No", ""]);
    for (const [i, row] of readRows().entries()) {
      const reciprocity = row[8] ?? "";
      assert.ok(valid.has(reciprocity), `Invalid reciprocity '${reciprocity}' at row ${i + 2}`);
    }
  });
});
