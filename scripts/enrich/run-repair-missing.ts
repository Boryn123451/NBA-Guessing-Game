import { runEnrichment } from './engine'

const report = await runEnrichment('repair-missing')

console.log(
  `Complete: ${report.completePlayers}. Partial: ${report.partialPlayers}. Unresolved: ${report.unresolvedPlayers}.`,
)

