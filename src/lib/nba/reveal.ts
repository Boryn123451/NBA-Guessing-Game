import type { DifficultyConfig } from './difficulty'
import type { GameOutcome } from './types'

export interface RevealStage {
  badgeLabel: string
  blurPx: number
  brightness: number
  grayscale: number
  overlay: number
  scale: number
  clipInset: string
  translateY: string
}

const STAGE_PRESETS: Record<DifficultyConfig['id'], RevealStage[]> = {
  easy: [
    {
      badgeLabel: 'Silhouette',
      blurPx: 34,
      brightness: 0.08,
      grayscale: 1,
      overlay: 0.94,
      scale: 1.22,
      clipInset: '8% 18% 30% 18%',
      translateY: '-4%',
    },
    {
      badgeLabel: 'Heavy Blur',
      blurPx: 26,
      brightness: 0.18,
      grayscale: 0.92,
      overlay: 0.82,
      scale: 1.16,
      clipInset: '4% 12% 18% 12%',
      translateY: '-2%',
    },
    {
      badgeLabel: 'Partial Read',
      blurPx: 20,
      brightness: 0.28,
      grayscale: 0.8,
      overlay: 0.7,
      scale: 1.12,
      clipInset: '0% 10% 10% 10%',
      translateY: '0%',
    },
    {
      badgeLabel: 'Face Crop',
      blurPx: 14,
      brightness: 0.42,
      grayscale: 0.6,
      overlay: 0.56,
      scale: 1.08,
      clipInset: '6% 18% 20% 18%',
      translateY: '-8%',
    },
    {
      badgeLabel: 'Open File',
      blurPx: 8,
      brightness: 0.62,
      grayscale: 0.35,
      overlay: 0.34,
      scale: 1.04,
      clipInset: '0% 4% 0% 4%',
      translateY: '0%',
    },
  ],
  medium: [
    {
      badgeLabel: 'Silhouette',
      blurPx: 40,
      brightness: 0.05,
      grayscale: 1,
      overlay: 0.96,
      scale: 1.24,
      clipInset: '10% 20% 34% 20%',
      translateY: '-4%',
    },
    {
      badgeLabel: 'Blur Pass',
      blurPx: 30,
      brightness: 0.14,
      grayscale: 0.95,
      overlay: 0.86,
      scale: 1.18,
      clipInset: '8% 16% 24% 16%',
      translateY: '-3%',
    },
    {
      badgeLabel: 'Partial Read',
      blurPx: 22,
      brightness: 0.24,
      grayscale: 0.82,
      overlay: 0.76,
      scale: 1.14,
      clipInset: '4% 12% 16% 12%',
      translateY: '-2%',
    },
    {
      badgeLabel: 'Face Crop',
      blurPx: 16,
      brightness: 0.36,
      grayscale: 0.66,
      overlay: 0.64,
      scale: 1.1,
      clipInset: '8% 20% 20% 20%',
      translateY: '-9%',
    },
    {
      badgeLabel: 'Closer Read',
      blurPx: 12,
      brightness: 0.48,
      grayscale: 0.48,
      overlay: 0.52,
      scale: 1.08,
      clipInset: '0% 8% 6% 8%',
      translateY: '0%',
    },
  ],
  hard: [
    {
      badgeLabel: 'Locked File',
      blurPx: 44,
      brightness: 0.03,
      grayscale: 1,
      overlay: 0.98,
      scale: 1.26,
      clipInset: '14% 24% 40% 24%',
      translateY: '-6%',
    },
    {
      badgeLabel: 'Narrow Window',
      blurPx: 30,
      brightness: 0.12,
      grayscale: 0.96,
      overlay: 0.88,
      scale: 1.18,
      clipInset: '10% 20% 28% 20%',
      translateY: '-6%',
    },
    {
      badgeLabel: 'Partial Window',
      blurPx: 22,
      brightness: 0.22,
      grayscale: 0.84,
      overlay: 0.76,
      scale: 1.14,
      clipInset: '8% 18% 20% 18%',
      translateY: '-4%',
    },
  ],
  impossible: [
    {
      badgeLabel: 'Locked File',
      blurPx: 48,
      brightness: 0.02,
      grayscale: 1,
      overlay: 0.99,
      scale: 1.28,
      clipInset: '16% 26% 42% 26%',
      translateY: '-6%',
    },
  ],
  'elite-ball-knowledge': [
    {
      badgeLabel: 'Sealed File',
      blurPx: 52,
      brightness: 0.02,
      grayscale: 1,
      overlay: 0.995,
      scale: 1.28,
      clipInset: '18% 28% 44% 28%',
      translateY: '-6%',
    },
  ],
}

export function getRevealStage(
  difficulty: DifficultyConfig,
  wrongGuessCount: number,
  status: GameOutcome,
  silhouetteRevealed: boolean,
): RevealStage {
  if (status !== 'in_progress') {
    return {
      badgeLabel: 'File Open',
      blurPx: 0,
      brightness: 1,
      grayscale: 0,
      overlay: 0.08,
      scale: 1,
      clipInset: '0% 0% 0% 0%',
      translateY: '0%',
    }
  }

  if (silhouetteRevealed) {
    return {
      badgeLabel: 'Silhouette',
      blurPx: Math.max(STAGE_PRESETS[difficulty.id][0]?.blurPx ?? 42, 42),
      brightness: 0.03,
      grayscale: 1,
      overlay: 0.98,
      scale: 1.24,
      clipInset: '10% 18% 26% 18%',
      translateY: '-3%',
    }
  }

  const stages = STAGE_PRESETS[difficulty.id]

  if (difficulty.image.revealEveryMisses === null) {
    return stages[0]
  }

  const stageIndex = Math.min(
    Math.floor(wrongGuessCount / difficulty.image.revealEveryMisses),
    stages.length - 1,
  )

  return stages[stageIndex]
}
