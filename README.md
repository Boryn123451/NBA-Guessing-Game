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
- `npm run refresh:data:current`
- `npm run refresh:data:history`
- `npm run refresh:data:all`
- `npm run refresh:data:images`
- `npm run refresh:data:repair-missing`
- `npm run refresh:data:add-missing`
- `npm run enrich:full`
- `npm run enrich:repair`
- `npm run enrich:repair:missing`
- `npm run enrich:repair:playwright`
- `npm run enrich:report`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`

`npm run test` uses a single-process threads pool and `npm run build` uses Vite's native config loader to avoid Windows sandbox spawn failures.

## Data refresh

`npm run refresh:data` is the smart entrypoint:

- refreshes the live/current pool when the current snapshot is older than `7 days`
- refreshes the full history snapshot when the history snapshot is older than `30 days`
- otherwise skips work

Manual refresh commands:

- `npm run refresh:data:current`
  - weekly path
  - refreshes the current NBA pool
  - refreshes the current 2KRatings fallback manifest
  - keeps the inactive historical pool untouched and merges the fresh current players back into history
- `npm run refresh:data:history`
  - monthly full rebuild
  - refreshes current + historical data together
- `npm run refresh:data:all`
  - alias for the full rebuild
- `npm run refresh:data:images`
  - only rebuilds the 2KRatings fallback manifest from the current pool
- `npm run refresh:data:repair-missing`
  - only fetches missing bio fields and missing image fallbacks from the already generated pools
  - does not rebuild the full current/history pools
- `npm run refresh:data:add-missing`
  - alias for `repair-missing`

Generated outputs:

- the current eligible player pool to `src/data/generated/player-pool.json`
- the all-time player pool to `src/data/generated/history-player-pool.json`
- the static 2KRatings fallback manifest to `src/data/generated/player-image-fallbacks.json`

## Enrichment pipeline

The crawler/enrichment tooling lives in `scripts/enrich/` and runs only in Node before deploy. Nothing from Crawlee is bundled into the Vite frontend.

Structure:

- `scripts/enrich/providers/nba.ts`
- `scripts/enrich/providers/basketballReference.ts`
- `scripts/enrich/providers/fallbackImage.ts`
- `scripts/enrich/providers/crawleeHttp.ts`
- `scripts/enrich/providers/crawleePlaywright.ts`

Behavior:

- Primary source: NBA `commonplayerinfo`
- Secondary source: Basketball-Reference over `CheerioCrawler`
- Fallback only when explicitly requested: Basketball-Reference over `PlaywrightCrawler`
- Image fallback: 2KRatings URL probe

Commands:

- `npm run enrich:full`
  - runs the provider chain for all players
  - still uses cache-first behavior and reuses successful parsed records
- `npm run enrich:repair`
  - repairs incomplete or failed records
- `npm run enrich:repair:missing`
  - only fetches records that still have missing fields
- `npm run enrich:repair:playwright`
  - same repair path, but allows Playwright fallback for pages that failed under static HTML
- `npm run enrich:report`
  - prints the latest enrichment summary

Cache and resume:

- raw fetched responses are stored under `scripts/.cache/enrich/raw/`
- parsed provider results are stored under `scripts/.cache/enrich/parsed/`
- resumable per-player status is stored in `scripts/.cache/enrich/status.json`
- the latest summary report is stored in `scripts/.cache/enrich/report.json`

The enrichment runner reuses cached successes, retries incomplete or failed records, and keeps generating final JSON even if some records still cannot be resolved.

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

## GitHub Pages rebuild

1. `npm install`
2. `npm run refresh:data:current`
3. `npm run enrich:repair`
4. `npm run enrich:report`
5. `npm run build`
6. `git add .`
7. `git commit -m "refresh data"`
8. `git push`

If you need the slow browser fallback:

1. `npx playwright install chromium`
2. `npm run enrich:repair:playwright`
