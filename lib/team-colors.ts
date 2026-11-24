const teamColors: Record<string, string> = {
  ATL: "#e34a58", BKN: "#91949c", BOS: "#289459", CHA: "#1ea5a0", CHI: "#dc4d62",
  CLE: "#a7335c", DAL: "#3682cf", DEN: "#efae3f", DET: "#507dc2", GSW: "#f5b738",
  HOU: "#e3435d", IND: "#e3ae4e", LAC: "#477fc1", LAL: "#9763c7", MEM: "#77a2dc",
  MIA: "#ea5264", MIL: "#399267", MIN: "#759f5a", NOP: "#9c7c56", NYK: "#ed8941",
  OKC: "#36a4e1", ORL: "#408bd8", PHI: "#4d8edd", PHX: "#dd8139", POR: "#d75055",
  SAC: "#9766c3", SAS: "#9dabb8", TOR: "#de5460", UTA: "#9d78cc", WAS: "#cf4b60",
};

export function teamAccent(team: string) {
  return teamColors[team] ?? "#d08946";
}
