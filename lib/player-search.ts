import type { PlayerRecord } from "./stats";

export function normalizePlayerName(name: string) {
  return name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function searchKey(name: string) {
  return normalizePlayerName(name).replace(/['’]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function buildPlayerSearchIndex(players: PlayerRecord[]) {
  return players.map((player, index) => {
    const name = searchKey(player.name);
    const words = name.split(" ");
    return { player, index, name, words, initials: words.map((word) => word[0]).join("") };
  });
}

type PlayerSearchEntry = ReturnType<typeof buildPlayerSearchIndex>[number];

export function findPlayerMatches(index: PlayerSearchEntry[], input: string) {
  const query = searchKey(input);
  if (!query) return [];

  const terms = query.split(" ");
  const exact: PlayerSearchEntry[] = [];
  const close: PlayerSearchEntry[] = [];
  const partial: PlayerSearchEntry[] = [];

  for (const entry of index) {
    if (entry.name === query) {
      exact.push(entry);
    } else if (entry.words.includes(query) || entry.initials === query) {
      close.push(entry);
    } else if (entry.name.includes(query) || terms.every((term) => entry.words.some((word) => word.startsWith(term)))) {
      partial.push(entry);
    }
  }

  return [...exact, ...close, ...partial].slice(0, 6);
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
