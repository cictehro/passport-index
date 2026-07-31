import fs from "fs";
import { log, group } from "./log.ts";
import { computeScores, rankPassports, RankingEntry } from "./scoring.ts";

log("reading ./data/passport_matrix.json");
const matrix = JSON.parse(
  fs.readFileSync("./data/passport_matrix.json", "utf8")
);

log("reading ./data/territories.json");
const { codes: territoryCodes } = JSON.parse(
  fs.readFileSync("./data/territories.json", "utf8")
);
const territories = new Set<string>(territoryCodes);

let scores: Record<string, number> = {};
let visaFreeCounts: Record<string, number> = {};

group("stats: score each passport", () => {
  ({ scores, visaFreeCounts } = computeScores(matrix, territories));
});

let rankings: RankingEntry[] = [];

group("stats: assign ranks", () => {
  rankings = rankPassports(scores, visaFreeCounts);
});

group("stats: write files", () => {
  fs.writeFileSync(
    "./generated/scores.json",
    JSON.stringify(scores, null, 2)
  );
  log("wrote ./generated/scores.json");

  fs.writeFileSync(
    "./generated/visa-free-counts.json",
    JSON.stringify(visaFreeCounts, null, 2)
  );
  log("wrote ./generated/visa-free-counts.json");

  fs.writeFileSync(
    "./generated/rankings.json",
    JSON.stringify(rankings, null, 2)
  );
  log("wrote ./generated/rankings.json");
});

console.log("✓ Statistics generated");
