import type { Celebration } from '../lib/nba/types'

interface CelebrationToastsProps {
  celebrations: Celebration[]
  onDismiss: (celebrationId: string) => void
}

const LABEL_BY_TYPE: Record<Celebration['type'], string> = {
  badge: 'Badge unlocked',
  quest: 'Quest update',
  record: 'New record',
}

export function CelebrationToasts({
  celebrations,
  onDismiss,
}: CelebrationToastsProps) {
  if (celebrations.length === 0) {
    return null
  }

  return (
    <div className="toast-stack" aria-live="polite">
      {celebrations.slice(-3).map((celebration) => (
        <article key={celebration.id} className={`toast-card is-${celebration.type}`}>
          <div>
            <span className="toast-card__label">{LABEL_BY_TYPE[celebration.type]}</span>
            <strong>{celebration.title}</strong>
            <p>{celebration.body}</p>
          </div>
          <button type="button" onClick={() => onDismiss(celebration.id)}>
            Dismiss
          </button>
        </article>
      ))}
    </div>
  )
}
