import { enrichConfig } from './config'
import { readJsonFile } from './cache'
import type { EnrichmentReport } from './types'

const report = await readJsonFile<EnrichmentReport>(enrichConfig.reportPath)

if (!report) {
  throw new Error('Enrichment report is missing. Run an enrich command first.')
}

console.log(`Generated: ${report.generatedAt}`)
console.log(`Complete: ${report.completePlayers}`)
console.log(`Partial: ${report.partialPlayers}`)
console.log(`Unresolved: ${report.unresolvedPlayers}`)
console.log(
  `Missing fields: birthDate=${report.missingFieldCounts.birthDate}, entryDraftYear=${report.missingFieldCounts.entryDraftYear}, imageFallback=${report.missingFieldCounts.imageFallback}`,
)
console.log(
  `Sources: nba=${report.scrapings.nba}, br:http=${report.scrapings.basketballReferenceHttp}, br:playwright=${report.scrapings.basketballReferencePlaywright}, images=${report.scrapings.fallbackImages}`,
)
console.log(`Failures: ${report.failures.length}`)

