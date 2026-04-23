import { runEnrichment } from './engine'

const report = await runEnrichment('full')

console.log(
  `Complete: ${report.completePlayers}. Partial: ${report.partialPlayers}. Unresolved: ${report.unresolvedPlayers}.`,
)

