# NBA Archetype Studio

An interactive NBA analytics platform for exploring player roles, comparing profiles, and testing basketball actions. It combines an explainable archetype model with a browser-based statistical lab and an interactive basketball strategy board.

## What it does

- **Explore Roles** — browse players on a 2D profile map, filter by stable archetypes, search players, and inspect similar-player results.
- **Profile Lab** — choose the statistics and number of clusters, then recompute k-means groups and a PCA projection live in the browser.
- **Compare Players** — compare two players through role-fit bars, key stats, shared strengths, and biggest differences.
- **Player Profiles** — use shareable `/players/[name]` pages for a player’s role fit, stat profile, and nearest statistical matches.
- **Methodology & Roles** — inspect how the model works and browse all ten archetypes with their strongest current examples.
- **Play Lab** — build a five-player lineup, place players on an interactive HTML5 Canvas half-court, select an action and defensive coverage, choose a read, and animate the tactical sequence.

## Tech stack

| Area | Technology |
| --- | --- |
| Frontend | Next.js 16 App Router, React 19, TypeScript |
| Styling | Tailwind CSS v4 + custom CSS |
| Player analysis | Client-side TypeScript implementations of standardization, seeded k-means++, PCA, and nearest-neighbor search |
| Visualizations | Custom SVG scatter plot and vanilla HTML5 Canvas court renderer |
| Data refresh | Flask, Flask-CORS, `nba_api` |

## Analytics approach

The app deliberately separates two kinds of analysis:

1. **Stable archetypes** are intentional weighted statistical models for basketball roles such as Primary Ball Handler, 3-and-D Wing, Stretch Big, and Rim Protector. Scores are percentiles within the loaded season’s player pool.
2. **Profile Lab** is exploratory. Users can change features and `k`, so cluster labels are recalculated rather than treated as fixed player identities.

The client-side analytics pipeline in `lib/stats.ts`:

- standardizes all selected feature columns to z-scores;
- runs seeded, k-means++-style clustering for reproducible results;
- finds similar players with Euclidean distance in standardized feature space;
- computes a two-dimensional PCA projection from the covariance matrix using power iteration.

## Run locally

### 1. Start the Next.js app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 2. Optional: enable current-season data refresh

Open a second terminal:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

With the Flask service running at `http://localhost:5001`, use **Load latest NBA stats** on the Explore Roles page. The service fetches traditional and advanced per-game statistics from `nba_api`, joins them by player ID, and saves the result to:

```text
public/data/players.json
```

That JSON file is the frontend’s default data source, so Explore Roles, Compare Players, Player Profiles, Profile Lab, and Play Lab all use the same refreshed data after reload.

## Project structure

```text
app/
  page.tsx                    # Explore Roles
  compare/page.tsx            # Player comparison
  methodology/page.tsx        # Methodology + archetype directory
  play-lab/page.tsx           # Interactive strategy board
  players/[name]/page.tsx     # Shareable player profile
  profile-lab/page.tsx        # Custom clustering workspace
components/
  ScatterPlot.tsx             # Hand-built SVG profile map
  PlayCanvas.tsx              # Vanilla Canvas court and animation
  SiteHeader.tsx              # Shared navigation
lib/
  constants.ts                # Features, colors, and archetype definitions
  stats.ts                    # Statistical algorithms
backend/
  app.py                      # Flask + nba_api refresh service
public/data/players.json      # Static player data served to the frontend
```

## Play Lab notes

Play Lab is a tactical visualization tool, not a game-outcome prediction engine. It supports Pick & Roll, Five-Out, and Horns actions; Drop, Switch, Hedge, and ICE coverages; and action-specific reads. The ball stays with the handler while an action develops, passes to the selected read, and plays the sequence three times before stopping.

Lineup action-fit grades use calibrated per-game stat thresholds—for example, shooting combines three-point accuracy and volume; creation combines scoring, usage, and passing. This prevents a single high archetype percentile from making an entire lineup look elite.

## Validate changes

```bash
npm run lint
npx tsc --noEmit
```

## Current limitations

- The model uses box-score and advanced summary statistics only.
- It does not yet include player tracking, play-by-play, lineup, matchup, or explicit position data.
- `stats.nba.com` can be rate-limited or unavailable in restricted networks; refresh data from a normal local connection when needed.
