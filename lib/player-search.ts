export function normalizePlayerName(name: string) {
  return name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export const FEATURED_MATCHUP = {
  first: "Stephen Curry",
  second: "LeBron James",
  label: "Curry vs. LeBron",
};

export function comparePlayerHref(name: string, opponent?: string) {
  const href = `/compare?player=${encodeURIComponent(name)}`;
  return opponent ? `${href}&opponent=${encodeURIComponent(opponent)}` : href;
}
