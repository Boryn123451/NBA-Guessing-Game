import type { GameOutcome, PlayerRecord } from './types'

export interface SeasonSnapshotClue {
  id: 'points' | 'rebounds' | 'assists' | 'playoffPicture' | 'accolade'
  label: string
  value: string
  revealAfterMisses: number
}

export const SNAPSHOT_REVEAL_AFTER: Record<SeasonSnapshotClue['id'], number> = {
  points: 2,
  rebounds: 3,
  assists: 4,
  playoffPicture: 5,
  accolade: 6,
}

function formatBucket(
  value: number | null,
  edges: number[],
  unitLabel: string,
): string | null {
  if (value === null) {
    return null
  }

  let lowerBound = 0

  for (const edge of edges) {
    if (value < edge) {
      return `${lowerBound.toFixed(0)}-${(edge - 0.1).toFixed(1)} ${unitLabel}`
    }

    lowerBound = edge
  }

  return `${lowerBound}+ ${unitLabel}`
}

function formatPlayoffPicture(player: PlayerRecord): string | null {
  if (player.snapshot.playoffPicture === null) {
    return null
  }

  return player.snapshot.playoffPicture
    ? 'Current team is inside the postseason picture'
    : 'Current team is outside the postseason picture'
}

export function getSeasonSnapshotClues(player: PlayerRecord): SeasonSnapshotClue[] {
  return [
    {
      id: 'points',
      label: 'Scoring range',
      value: formatBucket(player.snapshot.pointsPerGame, [5, 10, 15, 20, 25, 30], 'PPG') ?? 'Unavailable',
      revealAfterMisses: SNAPSHOT_REVEAL_AFTER.points,
    },
    {
      id: 'rebounds',
      label: 'Rebound range',
      value: formatBucket(player.snapshot.reboundsPerGame, [3, 6, 9, 12, 15], 'RPG') ?? 'Unavailable',
      revealAfterMisses: SNAPSHOT_REVEAL_AFTER.rebounds,
    },
    {
      id: 'assists',
      label: 'Assist range',
      value: formatBucket(player.snapshot.assistsPerGame, [2, 4, 6, 8, 10], 'APG') ?? 'Unavailable',
      revealAfterMisses: SNAPSHOT_REVEAL_AFTER.assists,
    },
    {
      id: 'playoffPicture',
      label: 'Team context',
      value: formatPlayoffPicture(player) ?? 'Unavailable',
      revealAfterMisses: SNAPSHOT_REVEAL_AFTER.playoffPicture,
    },
    {
      id: 'accolade',
      label: 'Notable accolade',
      value: player.snapshot.accoladeLabel ?? 'No notable accolade clue available',
      revealAfterMisses: SNAPSHOT_REVEAL_AFTER.accolade,
    },
  ]
}

export function isSeasonSnapshotClueRevealed(
  clue: SeasonSnapshotClue,
  guessCount: number,
  status: GameOutcome,
): boolean {
  return status !== 'in_progress' || guessCount >= clue.revealAfterMisses
}
