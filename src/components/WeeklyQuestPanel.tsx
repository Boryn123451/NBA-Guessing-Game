import type { WeeklyQuestBoard } from '../lib/nba/types'

interface WeeklyQuestPanelProps {
  board: WeeklyQuestBoard
  countdown: string
  isCompact?: boolean
  onClaim: (questId: string) => void
}

export function WeeklyQuestPanel({
  board,
  countdown,
  isCompact = false,
  onClaim,
}: WeeklyQuestPanelProps) {
  const completedCount = board.quests.filter((quest) => quest.completedAt !== null).length

  return (
    <section className={`quest-panel ${isCompact ? 'is-compact' : ''}`}>
      <div className="panel-heading">
        <span className="eyebrow">Weekly Quests</span>
        <h3>Local season grind</h3>
      </div>
      <p className="quest-panel__copy">
        Deterministic weekly quests reset in {countdown}. Completed quests stay local to this
        device.
      </p>
      <div className="quest-panel__summary">
        <span>{completedCount}/{board.quests.length} completed</span>
        <span>{board.currentWinStreak} win streak this week</span>
      </div>
      <div className="quest-panel__list">
        {board.quests.map((quest) => {
          const progress = Math.min((quest.progress / quest.target) * 100, 100)
          const isClaimable = Boolean(quest.completedAt && !quest.claimedAt)

          return (
            <article key={quest.id} className={`quest-card ${quest.completedAt ? 'is-complete' : ''}`}>
              <div className="quest-card__header">
                <div>
                  <strong>{quest.title}</strong>
                  <p>{quest.description}</p>
                </div>
                <span className="quest-card__reward">+{quest.rewardPoints} rep</span>
              </div>
              <div className="quest-card__progress">
                <div className="quest-card__bar">
                  <span style={{ width: `${progress}%` }} />
                </div>
                <span>
                  {Math.min(quest.progress, quest.target)}/{quest.target}
                </span>
              </div>
              <div className="quest-card__footer">
                {quest.claimedAt ? (
                  <span className="quest-card__state is-claimed">Claimed</span>
                ) : quest.completedAt ? (
                  <span className="quest-card__state is-ready">Ready to claim</span>
                ) : (
                  <span className="quest-card__state">In progress</span>
                )}
                {isClaimable ? (
                  <button className="action-button" type="button" onClick={() => onClaim(quest.id)}>
                    Claim reward
                  </button>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
