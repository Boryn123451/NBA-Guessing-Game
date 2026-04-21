import {
  formatClueModeLabel,
  formatDifficultyLabel,
  formatEventModeLabel,
  formatModeLabel,
  formatThemeLabel,
} from './format'
import { CLUE_KEYS } from './comparison'
import type {
  ClueMode,
  DifficultyId,
  EventModeId,
  GameMode,
  GuessResult,
  PlayerThemeId,
  StoredGameSession,
} from './types'

const EMOJI_BY_STATUS = {
  exact: '🟩',
  close: '🟨',
  miss: '⬛',
  unknown: '⬜',
} as const

function buildCareerShareLine(guessCount: number): string {
  return '🟧'.repeat(Math.max(guessCount, 1))
}

export function buildShareSummary(options: {
  mode: GameMode
  clueMode: ClueMode
  themeId: PlayerThemeId
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
  const variantLine = `${formatClueModeLabel(clueMode)} | ${formatThemeLabel(themeId)}`
  const eventLine = eventId ? `Event | ${formatEventModeLabel(eventId)}` : null
  const difficultyLine = formatDifficultyLabel(difficultyId)
  const board =
    clueMode === 'career'
      ? buildCareerShareLine(guessCount)
      : guesses
          .map((result) =>
            CLUE_KEYS.map((key) => EMOJI_BY_STATUS[result.clues[key].status]).join(''),
          )
          .join('\n')

  return [modeLine, variantLine, eventLine, difficultyLine, score, board]
    .filter(Boolean)
    .join('\n')
    .trim()
}
