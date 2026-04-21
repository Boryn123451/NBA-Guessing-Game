import type { BonusClue } from '../lib/nba/bonusClues'

interface BonusCluesPanelProps {
  clues: BonusClue[]
  canReveal: boolean
  onReveal: () => void
}

export function BonusCluesPanel({
  clues,
  canReveal,
  onReveal,
}: BonusCluesPanelProps) {
  if (clues.length === 0 && !canReveal) {
    return null
  }

  return (
    <section className="bonus-panel">
      <div className="panel-heading">
        <span className="eyebrow">Bonus clues</span>
        <h3>Controlled extra reads</h3>
      </div>
      <div className="bonus-panel__header">
        <p className="bonus-panel__copy">
          Extra clues stay broad on purpose. They narrow the lane without handing you the player.
        </p>
        {canReveal ? (
          <button className="action-button action-button--ghost" type="button" onClick={onReveal}>
            Reveal bonus clue
          </button>
        ) : null}
      </div>
      <div className="bonus-panel__grid">
        {clues.map((clue) => (
          <article key={clue.id} className="bonus-card is-revealed">
            <span className="clue-grid__label">{clue.label}</span>
            <strong>{clue.value}</strong>
          </article>
        ))}
      </div>
    </section>
  )
}

