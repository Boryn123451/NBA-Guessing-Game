import currentPlayerPool from '../../data/generated/player-pool.json'
import type { PlayerPoolData } from '../nba/types'

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
      this.historyPoolPromise = import('../../data/generated/history-player-pool.json').then(
        (module) => module.default as unknown as PlayerPoolData,
      )
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
