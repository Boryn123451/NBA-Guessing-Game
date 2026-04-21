# Full Court Cipher

Original NBA player deduction game built with React, TypeScript, and Vite.

## Features

- Daily and Practice modes with deterministic daily boards per local time zone
- Two clue styles:
  - `Roster Clues` for LarryBirdle-style comparison feedback
  - `Career Path` for background-based deduction
- Theme-filtered pools:
  - Full League
  - Rookies
  - International
  - All-Stars
  - Under 25
- Five difficulty tiers:
  - Easy
  - Medium
  - Hard
  - Impossible
  - Elite Ball Knowledge
- Real NBA headshots with fallback silhouette and progressive reveal
- Season snapshot clues that unlock later in the round
- Local stats with wins, losses, streaks, win rate, and per-difficulty average guesses
- Metric / imperial height toggle and light / dark / system display theme
- Dynamic exclusion of players on active 10-day contracts during refresh

## Scripts

- `npm install`
- `npm run dev`
- `npm run refresh:data`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`

## Data refresh

`npm run refresh:data` writes the current eligible player pool to `src/data/generated/player-pool.json`.

Primary sources used by the refresh pipeline:

- `stats.nba.com/stats/playerindex` for current roster membership, jersey numbers, positions, heights, country, school, and draft metadata
- `stats.nba.com/stats/leaguedashplayerbiostats` for current ages
- `stats.nba.com/js/data/playermovement/NBA_Player_Movement.json` for transaction history
- `cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json` for active 10-day contract expiration logic
- `stats.nba.com/stats/leaguestandingsv3` for playoff-picture snapshot clues
- `stats.nba.com/stats/drafthistory` for draft team clues
- `stats.nba.com/stats/franchiseplayers` for franchise history / previous-team membership
- `nba.com/allstar/<year>/roster` for the current-season All-Stars theme

The refresh script stores cache files under `scripts/.cache/nba/<season>/` for the slower static-ish endpoints so reruns stay fast and resilient.

Eligibility rules applied during refresh:

- Only rows with `ROSTER_STATUS = 1` are considered
- Players on active 10-day contracts are excluded from both the answer pool and the guess list
- The client only filters from that shared eligible pool, so mystery-player selection and autocomplete always stay in sync

## Notes

- Daily reset follows the detected browser time zone and rolls at local midnight
- The All-Stars theme is based on the current season's official NBA All-Star roster
- Difficulty is part of the saved round state; after the first guess, the current round keeps its locked rules
- Elite Ball Knowledge disables portrait reveal, season snapshot clues, bonus clues, and Career Path mode
- The generated player pool is bundled into the client build, so the production build still emits a chunk-size warning
