"""Small API service for refreshing NBA player data used by the frontend."""

import argparse
from datetime import date, datetime, timezone
import math
import json
from pathlib import Path
from tempfile import NamedTemporaryFile

from flask import Flask, jsonify
from flask_cors import CORS
from nba_api.stats.endpoints import leaguedashplayerstats
from requests.exceptions import RequestException


app = Flask(__name__)
CORS(app)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
FEATURES = ["PTS", "REB", "AST", "STL", "BLK", "TOV", "FG3A", "FG3_PCT", "OREB", "DREB", "USG_PCT", "TS_PCT", "AST_PCT"]


def current_nba_season() -> str:
    """Return the season currently in progress, or the most recently completed one."""
    today = date.today()
    start_year = today.year if today.month >= 10 else today.year - 1
    return f"{start_year}-{str(start_year + 1)[-2:]}"


def json_value(value):
    """Convert pandas/NumPy scalars to JSON-safe Python values."""
    if hasattr(value, "item"):
        value = value.item()
    if isinstance(value, float) and math.isnan(value):
        return None
    return value


def fetch_nba_stats(season: str | None = None):
    """Fetch and combine the traditional and advanced player stat tables."""
    season = season or current_nba_season()

    # LeagueDashPlayerStats returns one measure type per request. Base contains
    # the traditional box-score fields; Advanced supplies usage, true shooting,
    # and assist percentage. Both requests are PerGame to match the app's data.
    traditional = leaguedashplayerstats.LeagueDashPlayerStats(
        season=season,
        per_mode_detailed="PerGame",
        measure_type_detailed_defense="Base",
    ).get_data_frames()[0]
    advanced = leaguedashplayerstats.LeagueDashPlayerStats(
        season=season,
        per_mode_detailed="PerGame",
        measure_type_detailed_defense="Advanced",
    ).get_data_frames()[0]

    advanced_by_player = advanced.set_index("PLAYER_ID").to_dict("index")
    players = []

    for _, player in traditional.iterrows():
        advanced_stats = advanced_by_player.get(player["PLAYER_ID"], {})
        record = {
                "name": player["PLAYER_NAME"],
                "playerId": player["PLAYER_ID"],
                "team": player["TEAM_ABBREVIATION"],
                "age": player["AGE"],
                "gp": player["GP"],
                "min": player["MIN"],
                "PTS": player["PTS"],
                "REB": player["REB"],
                "AST": player["AST"],
                "STL": player["STL"],
                "BLK": player["BLK"],
                "TOV": player["TOV"],
                "FG3A": player["FG3A"],
                "FG3_PCT": player["FG3_PCT"],
                "OREB": player["OREB"],
                "DREB": player["DREB"],
                "USG_PCT": advanced_stats.get("USG_PCT"),
                "TS_PCT": advanced_stats.get("TS_PCT"),
                "AST_PCT": advanced_stats.get("AST_PCT"),
        }
        players.append({key: json_value(value) for key, value in record.items()})

    return players


def validate_players(players):
    if len(players) < 2:
        raise ValueError("NBA Stats did not return enough players to build the player map.")

    ids = set()
    for player in players:
        player_id = player.get("playerId")
        if type(player_id) is not int or player_id <= 0 or player_id in ids:
            raise ValueError(f"Invalid or duplicate NBA player ID: {player_id}.")
        ids.add(player_id)

        for field in ("name", "team"):
            value = player.get(field)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"Player {player_id} is missing {field}.")

        for field in (*FEATURES, "age", "gp", "min"):
            value = player.get(field)
            if type(value) not in (int, float) or not math.isfinite(value):
                raise ValueError(f"Player {player_id} is missing a valid {field} value.")


def refresh_snapshot():
    """Fetch, validate, and replace the saved snapshot as a single file operation."""
    season = current_nba_season()
    players = fetch_nba_stats(season)
    validate_players(players)

    output_path = PROJECT_ROOT / "public" / "data" / "players.json"
    payload = {"season": season, "features": FEATURES, "players": players}
    try:
        previous = json.loads(output_path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        previous = None

    if isinstance(previous, dict) and previous.get("updatedAt") and all(
        value == previous.get(key) for key, value in payload.items()
    ):
        return previous, False

    updated_at = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    snapshot = {"season": season, "updatedAt": updated_at, "features": FEATURES, "players": players}
    content = json.dumps(snapshot, indent=2, allow_nan=False) + "\n"
    with NamedTemporaryFile(dir=output_path.parent, prefix=".players-", suffix=".json", delete=False) as temporary:
        temporary_path = Path(temporary.name)

    try:
        temporary_path.write_text(content, encoding="utf-8")
        temporary_path.chmod(0o644)
        temporary_path.replace(output_path)
    finally:
        temporary_path.unlink(missing_ok=True)

    return snapshot, True


@app.get("/api/nba-stats")
def nba_stats():
    return jsonify(fetch_nba_stats())


@app.post("/api/refresh-static-data")
def refresh_static_data():
    """Refresh the static JSON file that every Next.js page reads by default."""
    try:
        snapshot, _ = refresh_snapshot()
    except (KeyError, ValueError, RequestException) as error:
        app.logger.warning("NBA stats refresh failed: %s", error)
        return jsonify(error="Could not refresh NBA stats. The saved snapshot was preserved."), 502
    return jsonify(snapshot)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Serve or refresh the NBA player stats.")
    parser.add_argument("command", choices=("serve", "refresh"), nargs="?", default="serve")
    if parser.parse_args().command == "refresh":
        try:
            snapshot, changed = refresh_snapshot()
        except (KeyError, OSError, ValueError, RequestException) as error:
            parser.exit(1, f"NBA stats refresh failed. The saved snapshot was preserved.\n{error}\n")
        if changed:
            print(f"Updated {snapshot['season']} NBA stats for {len(snapshot['players'])} players.")
        else:
            print(f"The saved {snapshot['season']} NBA stats are already up to date.")
    else:
        app.run(debug=True, port=5001)
