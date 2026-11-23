# NBA Archetype Studio

An interactive NBA analytics platform for exploring player roles, comparing profiles, and testing basketball actions. It combines an explainable archetype model with a browser-based statistical lab and an interactive basketball strategy board.

## What it does

- **Explore Roles** — browse players on a 2D profile map, filter by stable archetypes, search players, and inspect similar-player results. Open **Custom groups** to choose the statistics and number of groups for live clustering.
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
2. **Custom groups** in Explore Roles recomputes k-means groups and a PCA projection from the stats and number of groups you select.

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

### 2. Refresh NBA stats locally

From the project directory:

```bash
npm run refresh-data
```

If you still need to set up Python for this project, run these from the project directory once:

```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
```

The command fetches traditional and advanced per-game stats through `nba_api`, joins them by NBA player ID, and checks that the players have the fields used by the app. It replaces `public/data/players.json` only after the checks pass. Explore Roles and Compare Players show the date of the last published update. Reload the app after refreshing.

### Nightly updates on GitHub

The **Refresh NBA stats** workflow runs nightly at 08:37 UTC once it is on the repository’s default branch. You can also start it under **Actions** → **Refresh NBA stats** → **Run workflow**. It commits only the updated JSON file and skips the commit if the data is identical. If a request or validation fails, the prior snapshot stays in use.

A Vercel project connected to the same production branch can deploy these data commits through its Git integration. Check the first run in GitHub Actions and confirm it created a Vercel deployment.

## Project structure

```text
app/
  page.tsx                    # Explore Roles
  compare/page.tsx            # Player comparison
  methodology/page.tsx        # Methodology + archetype directory
  play-lab/page.tsx           # Interactive strategy board
  players/[name]/page.tsx     # Shareable player profile
  profile-lab/page.tsx        # Redirect to Explore Roles custom groups
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

Play Lab supports Pick & Roll, Five-Out, and Horns actions and four defensive coverages. Use **Your lineup** to name the five offensive markers. The **Drawing tools** section lets you move players, draw their routes, and turn off preset offensive movement.

Open **Ball movement** to choose who starts with possession. Add receivers in order for straight passes or draw each pass from the current passer to the next marker. Each receiver carries the ball until the next pass. The selected read supplies the default ball movement. Playbook saves and JSON exports include player names, routes, and pass sequences.

**NBA lineup fit** uses optional NBA stat profiles and per-game stat thresholds to grade the action. Court names belong to the diagram.

## Validate changes

```bash
npm run lint
npx tsc --noEmit
```

## Current limitations

- The model uses box-score and advanced summary statistics only.
- It does not yet include player tracking, play-by-play, lineup, matchup, or explicit position data.
- `stats.nba.com` can be rate-limited or unavailable in restricted networks; refresh data from a normal local connection when needed.
