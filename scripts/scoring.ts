import { SCORE_WEIGHTS } from "./constants.ts";
import { log } from "./log.ts";

export interface RankingEntry {
  rank: number;
  passport: string;
  score: number;
}

export function computeScores(
  matrix: Record<string, Record<string, string[]>>,
  territories: Set<string>
): { scores: Record<string, number>; visaFreeCounts: Record<string, number> } {
  const scores: Record<string, number> = {};
  const visaFreeCounts: Record<string, number> = {};

  for (const passport of Object.keys(matrix)) {
    if (territories.has(passport)) {
      log(`${passport}: skipped, is a territory`);
      continue;
    }

    let score = 0;
    let vf = 0;

    for (const destination of Object.keys(matrix[passport])) {
      if (territories.has(destination)) {
        log(`${passport}->${destination}: skipped, destination is a territory`);
        continue;
      }

      const [status] = matrix[passport][destination];
      const weight = SCORE_WEIGHTS[status] ?? 0;
      score += weight;
      log(`${passport}->${destination}: status=${status} weight=${weight} running_score=${score}`);

      if (status === "vf") {
        vf++;
      }
    }

    scores[passport] = Math.round(score * 100) / 100;
    visaFreeCounts[passport] = vf;
    log(`${passport}: final score=${scores[passport]} visa_free_count=${vf}`);
  }

  return { scores, visaFreeCounts };
}

export function rankPassports(
  scores: Record<string, number>,
  visaFreeCounts: Record<string, number>
): RankingEntry[] {
  const sorted = Object.entries(scores).sort((a, b) => {
    const [passportA, scoreA] = a;
    const [passportB, scoreB] = b;

    if (scoreB !== scoreA) return scoreB - scoreA;

    const vfA = visaFreeCounts[passportA] ?? 0;
    const vfB = visaFreeCounts[passportB] ?? 0;
    if (vfB !== vfA) return vfB - vfA;

    return passportA.localeCompare(passportB);
  });
  log(`sorted ${sorted.length} passports by score`);

  const rankings: RankingEntry[] = [];

  for (let index = 0; index < sorted.length; index++) {
    const [passport, score] = sorted[index];

    if (index > 0) {
      const [prevPassport, prevScore] = sorted[index - 1];
      const tied =
        prevScore === score &&
        visaFreeCounts[prevPassport] === visaFreeCounts[passport];

      if (tied) {
        rankings.push({ rank: rankings[index - 1].rank, passport, score });
        log(`${passport}: tied with ${prevPassport}, rank=${rankings[index - 1].rank}`);
        continue;
      }
    }

    rankings.push({ rank: index + 1, passport, score });
    log(`${passport}: rank=${index + 1} score=${score}`);
  }

  return rankings;
}
