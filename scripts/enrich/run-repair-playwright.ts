import { runEnrichment } from './engine'

const report = await runEnrichment('repair-playwright')

console.log(
  `Complete: ${report.completePlayers}. Partial: ${report.partialPlayers}. Unresolved: ${report.unresolvedPlayers}.`,
)

