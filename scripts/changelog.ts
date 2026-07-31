import fs from "fs";
import { log, group } from "./log.ts";

// ============================================================
// Generates/appends to CHANGELOG.md after every build
// Records what changed vs the previous run
// ============================================================

const CHANGELOG_PATH = "./CHANGELOG.md";
const MATRIX_PATH = "./data/passport_matrix.json";
const RANKINGS_PATH = "./generated/rankings.json";
const SCORES_PATH = "./generated/scores.json";

log(`reading ${MATRIX_PATH}, ${RANKINGS_PATH}, ${SCORES_PATH}`);
const matrix: Record<string, Record<string, string[]>> = JSON.parse(
  fs.readFileSync(MATRIX_PATH, "utf8")
);
const rankings: { rank: number; passport: string; score: number }[] = JSON.parse(
  fs.readFileSync(RANKINGS_PATH, "utf8")
);
const scores: Record<string, number> = JSON.parse(
  fs.readFileSync(SCORES_PATH, "utf8")
);

const date = new Date().toISOString().split("T")[0];
const totalRoutes = Object.values(matrix).reduce(
  (a, b) => a + Object.keys(b).length, 0
);
const top = rankings[0];
const last = rankings.at(-1)!;
log(`date=${date} passports=${Object.keys(matrix).length} totalRoutes=${totalRoutes} top=${JSON.stringify(top)} last=${JSON.stringify(last)}`);

// Read existing changelog
const existing = fs.existsSync(CHANGELOG_PATH)
  ? fs.readFileSync(CHANGELOG_PATH, "utf8")
  : "";
log(`existing changelog: ${existing.length} chars`);

// Extract previous totals from last entry if available
const prevRoutesMatch = existing.match(/Routes\s*\|\s*([\d,]+)/);
const prevRoutes = prevRoutesMatch ? parseInt(prevRoutesMatch[1].replace(",", "")) : null;
const routeDiff = prevRoutes !== null ? totalRoutes - prevRoutes : null;
const diffStr = routeDiff !== null
  ? routeDiff > 0 ? ` (+${routeDiff})` : routeDiff < 0 ? ` (${routeDiff})` : " (no change)"
  : "";
log(`prevRoutesMatch=${prevRoutesMatch?.[0]} prevRoutes=${prevRoutes} routeDiff=${routeDiff} diffStr='${diffStr}'`);

const entry = `## ${date}

| Metric | Value |
|--------|-------|
| Passports | ${Object.keys(matrix).length} |
| Routes | ${totalRoutes.toLocaleString()}${diffStr} |
| Top ranked | ${top.passport} (score: ${top.score}) |
| Last ranked | ${last.passport} (score: ${last.score}) |

---

`;
log(`entry:\n${entry}`);

group("changelog: write file", () => {
  // Prepend new entry after title
  const title = "# Changelog\n\n";
  if (existing.startsWith(title)) {
    log(`existing changelog starts with title, prepending entry`);
    fs.writeFileSync(CHANGELOG_PATH, title + entry + existing.slice(title.length));
  } else {
    log(`existing changelog has no title, writing title + entry`);
    fs.writeFileSync(CHANGELOG_PATH, title + entry);
  }
  log(`wrote ${CHANGELOG_PATH}`);
});

console.log(`✓ Changelog updated (${date})`);
