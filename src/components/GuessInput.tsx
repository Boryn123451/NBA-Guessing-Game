import {
  useDeferredValue,
  useMemo,
  useState,
} from 'react'
import type { KeyboardEvent } from 'react'

import type { DifficultyConfig } from '../lib/nba/difficulty'
import { searchPlayers } from '../lib/nba/search'
import type { PlayerRecord } from '../lib/nba/types'
import { PlayerAvatar } from './PlayerAvatar'

interface GuessInputProps {
  players: PlayerRecord[]
  guessedIds: Set<number>
  disabled: boolean
  difficulty: DifficultyConfig
  label?: string
  closeGuessFeedback: string | null
  blockedTeamId: number | null
  onGuess: (playerId: number) => void
}

function getEmptyStateMessage(difficulty: DifficultyConfig): string | null {
  if (difficulty.ui.showEmptyStateGuidance) {
    return 'No match yet. Try first or last name. Guessed players stay marked.'
  }

  if (difficulty.ui.showSearchHint) {
    return 'No eligible players matched this search.'
  }

  return null
}

export function GuessInput({
  players,
  guessedIds,
  disabled,
  difficulty,
  label = 'Search eligible players',
  closeGuessFeedback,
  blockedTeamId,
  onGuess,
}: GuessInputProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const deferredQuery = useDeferredValue(query)
  const results = useMemo(
    () =>
      searchPlayers(players, deferredQuery, guessedIds, {
        includeGuessedPlayers: difficulty.search.includeGuessedPlayers,
        limit: difficulty.search.resultLimit,
        matchMode: difficulty.search.matchMode,
        typoTolerance: difficulty.search.typoTolerance,
      }),
    [deferredQuery, difficulty.search, guessedIds, players],
  )
  const emptyStateMessage = getEmptyStateMessage(difficulty)

  function isOptionDisabled(player: PlayerRecord): boolean {
    return guessedIds.has(player.id) || (blockedTeamId !== null && player.teamId === blockedTeamId)
  }

  function commitGuess(player: PlayerRecord): void {
    if (isOptionDisabled(player)) {
      return
    }

    onGuess(player.id)
    setQuery('')
    setIsOpen(false)
    setHighlightedIndex(0)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsOpen(true)
      setHighlightedIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((current) => Math.max(current - 1, 0))
      return
    }

    if (event.key === 'Escape') {
      setIsOpen(false)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const choice = results[highlightedIndex] ?? results[0]

      if (choice && !isOptionDisabled(choice)) {
        commitGuess(choice)
      }
    }
  }

  return (
    <div className="guess-box">
      <label className="guess-box__label" htmlFor="player-guess">
        {label}
      </label>
      <div className="guess-box__field">
        <input
          autoComplete="off"
          className="guess-box__input"
          disabled={disabled}
          id="player-guess"
          placeholder={disabled ? 'Round complete' : 'Type a player name'}
          role="combobox"
          value={query}
          aria-controls="player-guess-results"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 120)
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            setIsOpen(true)
            setHighlightedIndex(0)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
      </div>
      {difficulty.ui.showSearchHint ? (
        <div className="guess-box__hint">Green is exact. Yellow is close. Gray means a miss.</div>
      ) : null}
      {closeGuessFeedback ? <div className="guess-box__feedback">{closeGuessFeedback}</div> : null}
      {blockedTeamId !== null && !disabled ? (
        <div className="guess-box__feedback">Elite rule: consecutive same-team guesses are blocked.</div>
      ) : null}
      {isOpen && query.trim().length > 0 ? (
        <ul className="guess-box__results" id="player-guess-results" role="listbox">
          {results.length > 0 ? (
            results.map((player, index) => {
              const isGuessed = guessedIds.has(player.id)
              const isBlocked = blockedTeamId !== null && player.teamId === blockedTeamId
              const isDisabled = isGuessed || isBlocked

              return (
                <li key={player.id}>
                  <button
                    className={`guess-box__option ${index === highlightedIndex ? 'is-active' : ''} ${isDisabled ? 'is-disabled' : ''}`}
                    type="button"
                    role="option"
                    aria-selected={index === highlightedIndex}
                    aria-disabled={isDisabled}
                    disabled={isDisabled}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => commitGuess(player)}
                  >
                    <span className="guess-box__option-player">
                      <PlayerAvatar player={player} />
                      <span className="guess-box__option-copy">
                        <span className="guess-box__option-name">
                          {player.displayName}
                          {isGuessed ? <em className="guess-box__badge">Guessed</em> : null}
                          {isBlocked ? <em className="guess-box__badge">Blocked</em> : null}
                        </span>
                        <span className="guess-box__option-meta">
                          {player.teamAbbreviation} | {player.position}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              )
            })
          ) : emptyStateMessage ? (
            <li className="guess-box__empty">{emptyStateMessage}</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
