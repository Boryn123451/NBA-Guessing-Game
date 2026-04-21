import playerPool from '../../data/generated/player-pool.json'
import type { PlayerPoolData } from '../nba/types'

export interface PlayerDataProvider {
  load(): PlayerPoolData
}

class BundledPlayerProvider implements PlayerDataProvider {
  load(): PlayerPoolData {
    return playerPool as unknown as PlayerPoolData
  }
}

export const playerDataProvider = new BundledPlayerProvider()

export function loadPlayerPool(): PlayerPoolData {
  return playerDataProvider.load()
}
