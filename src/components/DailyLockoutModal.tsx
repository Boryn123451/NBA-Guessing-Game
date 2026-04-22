interface DailyLockoutModalProps {
  countdown: string
  onClose: () => void
  onSwitchToPractice: () => void
}

export function DailyLockoutModal({
  countdown,
  onClose,
  onSwitchToPractice,
}: DailyLockoutModalProps) {
  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        aria-modal="true"
        aria-label="Daily board completed"
        className="modal-sheet modal-sheet--compact"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" type="button" onClick={onClose}>
          Close
        </button>
        <div className="panel-heading">
          <span className="eyebrow">Daily complete</span>
          <h3>Today's board is already finished</h3>
        </div>
        <p>You already completed the Daily puzzle on this device. The next Daily board unlocks in {countdown}.</p>
        <div className="status-panel__actions">
          <button className="action-button" type="button" onClick={onSwitchToPractice}>
            Switch to Practice
          </button>
          <button className="action-button action-button--ghost" type="button" onClick={onClose}>
            Stay here
          </button>
        </div>
      </div>
    </div>
  )
}
