import currentPlayerPool from '../../data/generated/player-pool.json'
import type { PlayerPoolData } from '../nba/types'

const historyPoolUrl = new URL('../../data/generated/history-player-pool.json', import.meta.url).href

export interface PlayerDataProvider {
  loadCurrent(): PlayerPoolData
  loadHistory(): Promise<PlayerPoolData>
}

class BundledPlayerProvider implements PlayerDataProvider {
  private historyPoolPromise: Promise<PlayerPoolData> | null = null

  loadCurrent(): PlayerPoolData {
    return currentPlayerPool as unknown as PlayerPoolData
  }

  loadHistory(): Promise<PlayerPoolData> {
    if (!this.historyPoolPromise) {
      this.historyPoolPromise = fetch(historyPoolUrl).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load historical player pool: ${response.status}`)
        }

        return (await response.json()) as PlayerPoolData
      })
    }

    return this.historyPoolPromise
  }
}

export const playerDataProvider = new BundledPlayerProvider()

export function loadCurrentPlayerPool(): PlayerPoolData {
  return playerDataProvider.loadCurrent()
}

export function loadHistoricalPlayerPool(): Promise<PlayerPoolData> {
  return playerDataProvider.loadHistory()
}
