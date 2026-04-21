import { CLUE_KEYS } from './comparison'
import {
  formatClueModeLabel,
  formatDifficultyLabel,
  formatModeLabel,
  formatThemeLabel,
} from './format'
import type {
  ClueMode,
  DifficultyId,
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
  maxGuesses: number
  session: StoredGameSession
  guesses: GuessResult[]
  guessCount: number
  dateKey: string
}): string {
  const { clueMode, dateKey, difficultyId, guessCount, guesses, maxGuesses, mode, session, themeId } =
    options
  const title = `Full Court Cipher ${formatModeLabel(mode)}`
  const score =
    session.status === 'won'
      ? `${session.guessIds.length}/${maxGuesses}`
      : session.status === 'lost'
        ? `X/${maxGuesses}`
        : `${session.guessIds.length}/${maxGuesses}`
  const modeLine = mode === 'daily' ? `${title} ${dateKey}` : title
  const variantLine = `${formatClueModeLabel(clueMode)} | ${formatThemeLabel(themeId)}`
  const difficultyLine = formatDifficultyLabel(difficultyId)
  const board =
    clueMode === 'career'
      ? buildCareerShareLine(guessCount)
      : guesses
          .map((result) =>
            CLUE_KEYS.map((key) => EMOJI_BY_STATUS[result.clues[key].status]).join(''),
          )
          .join('\n')

  return `${modeLine}\n${variantLine}\n${difficultyLine}\n${score}\n${board}`.trim()
}

