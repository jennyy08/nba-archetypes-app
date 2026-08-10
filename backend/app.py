"""Small API service for refreshing NBA player data used by the frontend."""

from datetime import date
import math

from flask import Flask, jsonify
from flask_cors import CORS
from nba_api.stats.endpoints import leaguedashplayerstats


app = Flask(__name__)
CORS(app)


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


@app.get("/api/nba-stats")
def nba_stats():
    season = current_nba_season()

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

    return jsonify(players)


if __name__ == "__main__":
    app.run(debug=True, port=5001)
