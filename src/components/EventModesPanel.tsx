import type { CSSProperties } from 'react'

import { formatDurationCompact } from '../lib/nba/format'
import type { ActiveEventMode } from '../lib/nba/events'
import type { EventModeId } from '../lib/nba/types'

interface EventModesPanelProps {
  activeEvents: ActiveEventMode[]
  upcomingEvents: ActiveEventMode[]
  selectedEventId: EventModeId | null
  locked: boolean
  isCompact?: boolean
  onSelect: (eventId: EventModeId | null) => void
}

export function EventModesPanel({
  activeEvents,
  upcomingEvents,
  selectedEventId,
  locked,
  isCompact = false,
  onSelect,
}: EventModesPanelProps) {
  const hasActiveEvents = activeEvents.length > 0

  return (
    <section className={`event-panel ${isCompact ? 'is-compact' : ''}`}>
      <div className="panel-heading">
        <span className="eyebrow">Event Modes</span>
        <h3>NBA calendar rotations</h3>
      </div>
      <p className="event-panel__copy">
        Client-side calendar windows activate themed pools automatically. Pick one active event or
        stay on the standard pool.
      </p>

      <div className="event-panel__chips">
        <button
          className={`theme-chip ${selectedEventId === null ? 'is-active' : ''}`}
          type="button"
          disabled={locked}
          onClick={() => onSelect(null)}
        >
          <span>No event</span>
        </button>
        {activeEvents.map((eventMode) => (
          <button
            key={eventMode.id}
            className={`theme-chip ${selectedEventId === eventMode.id ? 'is-active' : ''}`}
            type="button"
            disabled={locked}
            onClick={() => onSelect(eventMode.id)}
          >
            <span>{eventMode.title}</span>
            <strong>{eventMode.playerCount}</strong>
          </button>
        ))}
      </div>

      {locked ? (
        <div className="event-panel__hint">Event selection locks after the first guess.</div>
      ) : null}

      {hasActiveEvents ? (
        <div className="event-panel__grid">
          {activeEvents.map((eventMode) => (
            <article
              key={eventMode.id}
              className={`event-card ${selectedEventId === eventMode.id ? 'is-selected' : ''}`}
              style={{ '--event-accent': eventMode.accentColor } as CSSProperties}
            >
              <div className="event-card__topline">
                <span className="event-card__tag">Active now</span>
                <span className="event-card__countdown">
                  Ends in {formatDurationCompact(eventMode.countdownMs)}
                </span>
              </div>
              <strong>{eventMode.title}</strong>
              <p>{eventMode.subtitle}</p>
              <span className="event-card__rule">{eventMode.specialRuleText ?? eventMode.description}</span>
              <div className="event-card__footer">
                <span>{eventMode.playerCount} eligible players</span>
                {eventMode.badgeRewardId ? <span>Badge reward</span> : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="event-panel__empty">
          <strong>No active event window right now.</strong>
          <span>The board stays on the full live roster unless you wait for the next calendar slot.</span>
        </div>
      )}

      {upcomingEvents.length > 0 ? (
        <div className="event-panel__upcoming">
          <span className="settings-panel__label">Upcoming</span>
          <div className="event-panel__upcoming-list">
            {upcomingEvents.map((eventMode) => (
              <article key={eventMode.id} className="event-panel__upcoming-card">
                <strong>{eventMode.title}</strong>
                <span>{eventMode.subtitle}</span>
                <span>Starts in {formatDurationCompact(eventMode.countdownMs)}</span>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
