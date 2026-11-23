export function normalizePlayerName(name: string) {
  return name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function comparePlayerHref(name: string) {
  return `/compare?player=${encodeURIComponent(name)}`;
}
