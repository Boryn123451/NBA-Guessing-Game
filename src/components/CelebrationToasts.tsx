import { useEffect } from 'react'

import type { Celebration } from '../lib/nba/types'

interface CelebrationToastsProps {
  celebrations: Celebration[]
  onDismiss: (celebrationId: string) => void
}

const LABEL_BY_TYPE: Record<Celebration['type'], string> = {
  badge: 'Badge unlocked',
  quest: 'Quest update',
  record: 'New record',
  status: 'Update',
}

export function CelebrationToasts({
  celebrations,
  onDismiss,
}: CelebrationToastsProps) {
  const visibleCelebration = celebrations[0] ?? null

  useEffect(() => {
    if (!visibleCelebration) {
      return
    }

    const timer = window.setTimeout(() => onDismiss(visibleCelebration.id), 4800)
    return () => window.clearTimeout(timer)
  }, [onDismiss, visibleCelebration])

  if (!visibleCelebration) {
    return null
  }

  return (
    <div className="toast-stack" aria-live="polite">
      <article className={`toast-card is-${visibleCelebration.type}`}>
        <div>
          <span className="toast-card__label">{LABEL_BY_TYPE[visibleCelebration.type]}</span>
          <strong>{visibleCelebration.title}</strong>
          <p>{visibleCelebration.body}</p>
        </div>
        <button type="button" onClick={() => onDismiss(visibleCelebration.id)}>
          Dismiss
        </button>
      </article>
    </div>
  )
}
