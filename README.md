# Full Court Cipher

Original NBA player deduction game built with React, TypeScript, and Vite.

## Features

- Daily and Practice modes with deterministic daily boards per local time zone
- Practice can switch between:
  - `Current players only`
  - `All NBA history`
- Two clue styles:
  - `Roster Clues` for LarryBirdle-style comparison feedback
  - `Career Path` for background-based deduction
  - `Draft Mode` for draft identity, team, and pick-range deduction across current-only or all-time practice pools
- Theme-filtered pools in Practice:
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
- Static image fallback chain:
  - official NBA headshot
  - generated 2KRatings fallback manifest
  - bundled local silhouette
- Season snapshot clues that unlock later in the round
- Local stats with wins, losses, streaks, win rate, and per-difficulty average guesses
- Guest-first local profile with editable display name, badges, weekly quests, personal records, daily history, and unlockable decade themes from the `1950s` through `2020s` purchased with local points
- Calendar-driven event modes with local countdowns and filtered player pools
- Metric / imperial height toggle and light / dark / system display theme
- Dynamic exclusion of players on active 10-day contracts during refresh
- Daily completion lockout with local reset countdown modal
- Mobile-aware interface that auto-switches into a reduced-density layout on smaller touch devices

## Scripts

- `npm install`
- `npm run dev`
- `npm run refresh:data`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`

`npm run test` uses a single-process threads pool and `npm run build` uses Vite's native config loader to avoid Windows sandbox spawn failures.

## Data refresh

`npm run refresh:data` writes:

- the current eligible player pool to `src/data/generated/player-pool.json`
- the all-time player pool to `src/data/generated/history-player-pool.json`
- the static 2KRatings fallback manifest to `src/data/generated/player-image-fallbacks.json`

Primary sources used by the refresh pipeline:

- `stats.nba.com/stats/playerindex` for current roster membership, jersey numbers, positions, heights, country, school, and draft metadata
- `stats.nba.com/stats/leaguedashplayerbiostats` for current ages
- `stats.nba.com/js/data/playermovement/NBA_Player_Movement.json` for transaction history
- `cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json` for active 10-day contract expiration logic
- `stats.nba.com/stats/leaguestandingsv3` for playoff-picture snapshot clues
- `stats.nba.com/stats/drafthistory` for draft team clues
- `stats.nba.com/stats/franchiseplayers` for franchise history / previous-team membership
- `nba.com/allstar/<year>/roster` for the current-season All-Stars theme
- `stats.nba.com/stats/playerawards` for career-wide accolades and championships

The refresh script stores cache files under `scripts/.cache/nba/<season>/` for the slower static-ish endpoints so reruns stay fast and resilient.

Eligibility rules applied during refresh:

- Only rows with `ROSTER_STATUS = 1` are considered
- Players on active 10-day contracts are excluded from both the answer pool and the guess list
- The client only filters from that shared eligible pool, so mystery-player selection and autocomplete always stay in sync

## Notes

- Daily reset follows the detected browser time zone and rolls at local midnight
- The All-Stars theme is based on the current season's official NBA All-Star roster
- Difficulty is part of the saved round state; after the first guess, the current round keeps its locked rules
- Daily always uses the full eligible roster and the same answer across every difficulty
- Daily ignores practice-only player-pool settings, so it never switches to the all-time scope
- Elite Ball Knowledge disables portrait reveal, season snapshot clues, bonus clues, and Career Path mode
- The generated player pool is bundled into the client build, so the production build still emits a chunk-size warning
- The app is static-host friendly: user progression lives only in browser storage, asset paths are relative for GitHub Pages, and there is no backend or authenticated account system
