import { CLUE_KEYS } from './comparison'
import { DRAFT_CLUE_KEYS } from './draftMode'
import {
  formatClueModeLabel,
  formatDifficultyLabel,
  formatEventModeLabel,
  formatModeLabel,
  formatPlayerPoolScopeLabel,
  formatThemeLabel,
} from './format'
import type {
  ClueMode,
  DifficultyId,
  EventModeId,
  GameMode,
  GuessResult,
  PlayerPoolScopeId,
  PlayerThemeId,
  StoredGameSession,
} from './types'

const SYMBOL_BY_STATUS = {
  exact: 'X',
  close: '~',
  miss: '.',
  unknown: '?',
} as const

function buildCareerShareLine(guessCount: number): string {
  return 'R'.repeat(Math.max(guessCount, 1))
}

export function buildShareSummary(options: {
  mode: GameMode
  clueMode: ClueMode
  themeId: PlayerThemeId
  playerPoolScope: PlayerPoolScopeId
  difficultyId: DifficultyId
  eventId: EventModeId | null
  maxGuesses: number
  session: StoredGameSession
  guesses: GuessResult[]
  guessCount: number
  dateKey: string
}): string {
  const {
    clueMode,
    dateKey,
    difficultyId,
    eventId,
    guessCount,
    guesses,
    maxGuesses,
    mode,
    playerPoolScope,
    session,
    themeId,
  } = options
  const title = `Full Court Cipher ${formatModeLabel(mode)}`
  const score =
    session.status === 'won'
      ? `${session.guessIds.length}/${maxGuesses}`
      : session.status === 'lost'
        ? `X/${maxGuesses}`
        : `${session.guessIds.length}/${maxGuesses}`
  const modeLine = mode === 'daily' ? `${title} ${dateKey}` : title
  const variantLine =
    playerPoolScope === 'history'
      ? `${formatClueModeLabel(clueMode)} | ${formatPlayerPoolScopeLabel(playerPoolScope)}`
      : `${formatClueModeLabel(clueMode)} | ${formatThemeLabel(themeId)}`
  const eventLine = eventId ? `Event | ${formatEventModeLabel(eventId)}` : null
  const difficultyLine = formatDifficultyLabel(difficultyId)
  const board =
    clueMode === 'career'
      ? buildCareerShareLine(guessCount)
      : guesses
          .map((result) => {
            const clueKeys = clueMode === 'draft' ? DRAFT_CLUE_KEYS : CLUE_KEYS
            return clueKeys.map((key) => SYMBOL_BY_STATUS[result.clues[key as keyof typeof result.clues].status]).join('')
          })
          .join('\n')

  return [modeLine, variantLine, eventLine, difficultyLine, score, board]
    .filter(Boolean)
    .join('\n')
    .trim()
}
