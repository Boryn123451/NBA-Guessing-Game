import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { getDifficultyDefinition } from '../lib/nba/difficulty'
import { buildPlayerRecord } from '../lib/nba/testUtils'
import { GuessInput } from './GuessInput'

describe('GuessInput', () => {
  it('commits a player selection on mouse down before blur can close the list', async () => {
    const user = userEvent.setup()
    const onGuess = vi.fn()
    const brandonClarke = buildPlayerRecord({
      id: 1629634,
      displayName: 'Brandon Clarke',
      firstName: 'Brandon',
      lastName: 'Clarke',
      teamAbbreviation: 'MEM',
    })

    render(
      <GuessInput
        blockedTeamId={null}
        closeGuessFeedback={null}
        difficulty={getDifficultyDefinition('medium')}
        disabled={false}
        guessedIds={new Set()}
        players={[brandonClarke]}
        onGuess={onGuess}
      />,
    )

    await user.type(screen.getByRole('combobox'), 'brandon')
    fireEvent.mouseDown(screen.getByRole('option', { name: /brandon clarke/i }))

    expect(onGuess).toHaveBeenCalledWith(1629634)
  })
})
