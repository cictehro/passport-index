export const VALID_STATUSES = [
  "vf",
  "vo",
  "ev",
  "et",
  "vr"
] as const;

export const SCORE_WEIGHTS: Record<string, number> = {
  vf: 1.0,
  vo: 0.7,
  ev: 0.5,
  et: 0.3,
  vr: 0,
};
