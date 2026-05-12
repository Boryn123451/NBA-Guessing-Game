import type { MemorialTribute } from '../lib/nba/events'

interface MemorialTributePanelProps {
  tribute: MemorialTribute
}

export function MemorialTributePanel({ tribute }: MemorialTributePanelProps) {
  return (
    <section className="tribute-panel">
      <div className="panel-heading">
        <span className="eyebrow">Temporary tribute</span>
        <h3>{tribute.title}</h3>
      </div>
      <div className="tribute-panel__body">
        {tribute.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <strong className="tribute-panel__expiry">{tribute.expiresLabel}</strong>
    </section>
  )
}
