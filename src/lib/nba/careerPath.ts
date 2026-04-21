import type { GameOutcome, PlayerRecord } from './types'

export interface CareerPathClue {
  id: 'country' | 'path' | 'debutYear' | 'draftTeam' | 'previousTeams'
  label: string
  value: string
  revealAfterMisses: number
}

export const CAREER_PATH_REVEAL_AFTER: Record<CareerPathClue['id'], number> = {
  country: 0,
  path: 1,
  debutYear: 2,
  draftTeam: 3,
  previousTeams: 4,
}

function formatDraftTeam(player: PlayerRecord): string {
  if (player.draft.isUndrafted) {
    return 'Undrafted'
  }

  if (player.draft.teamName) {
    return player.draft.teamName
  }

  return 'Draft team unavailable'
}

function formatPreviousTeams(player: PlayerRecord): string {
  if (player.career.previousTeamNames.length === 0) {
    return 'No previous NBA teams'
  }

  return player.career.previousTeamNames.join(', ')
}

export function getCareerPathClues(player: PlayerRecord): CareerPathClue[] {
  return [
    {
      id: 'country',
      label: 'Country',
      value: player.country ?? 'Country unavailable',
      revealAfterMisses: CAREER_PATH_REVEAL_AFTER.country,
    },
    {
      id: 'path',
      label: 'Pre-NBA path',
      value: player.career.preNbaPath ?? player.college ?? 'Path unavailable',
      revealAfterMisses: CAREER_PATH_REVEAL_AFTER.path,
    },
    {
      id: 'debutYear',
      label: 'NBA debut',
      value:
        player.career.debutYear === null ? 'Debut year unavailable' : `${player.career.debutYear}`,
      revealAfterMisses: CAREER_PATH_REVEAL_AFTER.debutYear,
    },
    {
      id: 'draftTeam',
      label: 'Draft team',
      value: formatDraftTeam(player),
      revealAfterMisses: CAREER_PATH_REVEAL_AFTER.draftTeam,
    },
    {
      id: 'previousTeams',
      label: 'Previous NBA teams',
      value: formatPreviousTeams(player),
      revealAfterMisses: CAREER_PATH_REVEAL_AFTER.previousTeams,
    },
  ]
}

export function isCareerClueRevealed(
  clue: CareerPathClue,
  guessCount: number,
  status: GameOutcome,
): boolean {
  return status !== 'in_progress' || guessCount >= clue.revealAfterMisses
}
