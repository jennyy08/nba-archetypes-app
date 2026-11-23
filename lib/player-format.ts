export const ROLE_FIT_EXPLANATION = "A score of 90 means the player fits that role as well as or better than about 90% of players this season.";

const ordinalRules = new Intl.PluralRules("en", { type: "ordinal" });
const ordinalSuffixes: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "st", two: "nd", few: "rd" };

export function formatPercentile(score: number) {
  return `${score}${ordinalSuffixes[ordinalRules.select(score)] ?? "th"}`;
}

export function formatPlayerStat(value: number | string | null | undefined, feature: string) {
  const number = Number(value);
  if (value == null || value === "" || !Number.isFinite(number)) return "—";
  if (feature.endsWith("_PCT")) return `${(number * 100).toFixed(1)}%`;
  return number.toFixed(1);
}
