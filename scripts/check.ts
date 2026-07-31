import fs from "fs";
import { log, group } from "./log.ts";
import { computeScores, rankPassports } from "./scoring.ts";

function fail(msg: string): never {
  console.error(`✗ Integrity check failed: ${msg}`);
  process.exit(1);
}

log("reading ./data/passport_matrix.json");
const matrix = JSON.parse(
  fs.readFileSync("./data/passport_matrix.json", "utf8")
);

log("reading ./data/territories.json");
const { codes: territoryCodes } = JSON.parse(
  fs.readFileSync("./data/territories.json", "utf8")
);
const territories = new Set<string>(territoryCodes);

log("reading generated/scores.json, generated/visa-free-counts.json, generated/rankings.json, generated/route-metadata.json");
const scores: Record<string, number> = JSON.parse(
  fs.readFileSync("./generated/scores.json", "utf8")
);
const visaFreeCounts: Record<string, number> = JSON.parse(
  fs.readFileSync("./generated/visa-free-counts.json", "utf8")
);
const rankings: { rank: number; passport: string; score: number }[] = JSON.parse(
  fs.readFileSync("./generated/rankings.json", "utf8")
);
const routeMetadata: Record<string, unknown> = JSON.parse(
  fs.readFileSync("./generated/route-metadata.json", "utf8")
);

group("check: recompute and diff against shipped output", () => {
  const recomputed = computeScores(matrix, territories);

  for (const passport of Object.keys(recomputed.scores)) {
    log(`${passport}: shipped score=${scores[passport]} recomputed=${recomputed.scores[passport]}`);
    if (scores[passport] !== recomputed.scores[passport]) {
      fail(`score mismatch for ${passport}: shipped=${scores[passport]} recomputed=${recomputed.scores[passport]}`);
    }
    if (visaFreeCounts[passport] !== recomputed.visaFreeCounts[passport]) {
      fail(`visa-free count mismatch for ${passport}: shipped=${visaFreeCounts[passport]} recomputed=${recomputed.visaFreeCounts[passport]}`);
    }
  }
  log(`${Object.keys(recomputed.scores).length} passport scores match shipped output`);

  const recomputedRankings = rankPassports(recomputed.scores, recomputed.visaFreeCounts);
  if (recomputedRankings.length !== rankings.length) {
    fail(`ranking length mismatch: shipped=${rankings.length} recomputed=${recomputedRankings.length}`);
  }
  for (let i = 0; i < recomputedRankings.length; i++) {
    log(`rank ${i}: shipped=${JSON.stringify(rankings[i])} recomputed=${JSON.stringify(recomputedRankings[i])}`);
    if (
      recomputedRankings[i].passport !== rankings[i].passport ||
      recomputedRankings[i].rank !== rankings[i].rank
    ) {
      fail(`ranking mismatch at position ${i}: shipped=${JSON.stringify(rankings[i])} recomputed=${JSON.stringify(recomputedRankings[i])}`);
    }
  }
  log(`${recomputedRankings.length} rankings match shipped output`);
});

group("check: sanity invariants", () => {
  for (const [passport, score] of Object.entries(scores)) {
    if (score < 0) fail(`negative score for ${passport}: ${score}`);
    log(`${passport}: score=${score} >= 0 OK`);
  }

  let prevRank = 0;
  let prevScore = Infinity;
  for (const entry of rankings) {
    if (entry.rank < prevRank) fail(`ranks out of order at ${entry.passport}`);
    if (entry.score > prevScore) fail(`scores out of order at ${entry.passport}`);
    log(`${entry.passport}: rank=${entry.rank} score=${entry.score} order OK`);
    prevRank = entry.rank;
    prevScore = entry.score;
  }

  for (const key of Object.keys(routeMetadata)) {
    const [passport, destination] = key.split(":");
    if (!matrix[passport] || !matrix[passport][destination]) {
      fail(`route-metadata entry ${key} has no matching row in passport_matrix.json`);
    }
    log(`${key}: has matching matrix row OK`);
  }
  log(`${Object.keys(routeMetadata).length} route-metadata entries all match passport_matrix.json`);
});

console.log(`✓ Integrity check passed (${Object.keys(scores).length} passports, ${rankings.length} rankings)`);
