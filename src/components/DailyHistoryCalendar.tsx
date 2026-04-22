import { useMemo, useState } from 'react'

import { DateTime } from 'luxon'

import { formatClueModeLabel, formatDifficultyLabel, formatEventModeLabel } from '../lib/nba/format'
import type { DailyHistoryEntry } from '../lib/nba/types'

interface DailyHistoryCalendarProps {
  entries: DailyHistoryEntry[]
}

function buildCalendarDays(month: DateTime) {
  const start = month.startOf('month').startOf('week')
  return Array.from({ length: 42 }, (_, index) => start.plus({ days: index }))
}

export function DailyHistoryCalendar({
  entries,
}: DailyHistoryCalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => DateTime.now().startOf('month'))
  const entryByDateKey = useMemo(
    () => new Map(entries.map((entry) => [entry.dateKey, entry])),
    [entries],
  )
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth])
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(entries.at(-1)?.dateKey ?? null)
  const selectedEntry = selectedDateKey ? entryByDateKey.get(selectedDateKey) ?? null : null

  return (
    <section className="history-calendar">
      <div className="profile-panel__section-heading">
        <span className="settings-panel__label">Daily history</span>
        <div className="history-calendar__nav">
          <button type="button" onClick={() => setVisibleMonth((current) => current.minus({ months: 1 }))}>
            Prev
          </button>
          <strong>{visibleMonth.toFormat('LLLL yyyy')}</strong>
          <button type="button" onClick={() => setVisibleMonth((current) => current.plus({ months: 1 }))}>
            Next
          </button>
        </div>
      </div>

      <div className="history-calendar__grid history-calendar__grid--labels">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="history-calendar__grid">
        {calendarDays.map((day) => {
          const dateKey = day.toISODate() ?? ''
          const entry = entryByDateKey.get(dateKey)
          const isOutsideMonth = day.month !== visibleMonth.month

          return (
            <button
              key={dateKey}
              className={`history-calendar__day ${isOutsideMonth ? 'is-muted' : ''} ${entry ? (entry.didWin ? 'is-win' : 'is-loss') : 'is-empty'} ${selectedDateKey === dateKey ? 'is-selected' : ''}`}
              type="button"
              onClick={() => setSelectedDateKey(dateKey)}
            >
              <span>{day.day}</span>
              {entry ? <small>{entry.didWin ? 'W' : 'L'}</small> : null}
            </button>
          )
        })}
      </div>

      <div className="history-calendar__summary">
        {selectedEntry ? (
          <>
            <strong>{selectedEntry.didWin ? 'Solved' : 'Missed'} on {selectedEntry.dateKey}</strong>
            <span>
              {formatDifficultyLabel(selectedEntry.difficultyId)} | {formatClueModeLabel(selectedEntry.clueMode)}
            </span>
            <span>{selectedEntry.guessCount} guesses used</span>
            {selectedEntry.eventId ? (
              <span>Event: {formatEventModeLabel(selectedEntry.eventId)}</span>
            ) : null}
          </>
        ) : (
          <span>No Daily result stored for this day.</span>
        )}
      </div>
    </section>
  )
}
