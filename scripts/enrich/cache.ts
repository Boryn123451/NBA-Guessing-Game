import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

interface ProgressTracker {
  tick(increment?: number): void
  finish(): void
}

interface ProgressTrackerOptions {
  initialMsPerItem?: number
  warmupItems?: number
}

export async function ensureDirectory(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const rawValue = await readFile(filePath, 'utf8')
    return JSON.parse(rawValue) as T
  } catch {
    return null
  }
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await ensureDirectory(filePath)
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function readTextFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8')
  } catch {
    return null
  }
}

export async function writeTextFile(filePath: string, value: string): Promise<void> {
  await ensureDirectory(filePath)
  await writeFile(filePath, value, 'utf8')
}

export async function getFileAgeMs(filePath: string): Promise<number | null> {
  try {
    const metadata = await stat(filePath)
    return Date.now() - metadata.mtimeMs
  } catch {
    return null
  }
}

export async function isFileFresh(filePath: string, maxAgeMs: number): Promise<boolean> {
  const ageMs = await getFileAgeMs(filePath)
  return ageMs !== null && ageMs <= maxAgeMs
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1

      if (currentIndex >= items.length) {
        return
      }

      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}

export async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function formatEta(milliseconds: number): string {
  const safeMilliseconds = Math.max(0, Math.round(milliseconds))
  const totalSeconds = Math.ceil(safeMilliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }

  return `${seconds}s`
}

export function createProgressTracker(
  label: string,
  total: number,
  options: ProgressTrackerOptions = {},
): ProgressTracker {
  const startTime = Date.now()
  const initialMsPerItem = Math.max(1, options.initialMsPerItem ?? 1000)
  const warmupItems = Math.max(1, options.warmupItems ?? 8)
  let completed = 0
  let lastRenderAt = 0
  let lastLineLength = 0
  let finished = false

  function render(force = false): void {
    if (finished) {
      return
    }

    const now = Date.now()

    if (!force && now - lastRenderAt < 250) {
      return
    }

    lastRenderAt = now
    const progress = total === 0 ? 1 : completed / total
    const elapsedMs = Math.max(1, now - startTime)
    const remaining = Math.max(0, total - completed)
    const observedMsPerItem =
      completed <= 0 ? initialMsPerItem : elapsedMs / completed
    const blendedMsPerItem =
      completed >= warmupItems
        ? observedMsPerItem
        : ((observedMsPerItem * completed) + (initialMsPerItem * (warmupItems - completed))) /
          warmupItems
    const etaMs = remaining * blendedMsPerItem
    const message =
      `${label}: ${completed}/${total}` +
      ` (${Math.round(progress * 100)}%)` +
      ` ETA ${formatEta(etaMs)}`

    if (process.stdout.isTTY) {
      const paddedMessage = message.padEnd(lastLineLength, ' ')
      process.stdout.write(`\r${paddedMessage}`)
      lastLineLength = Math.max(lastLineLength, paddedMessage.length)
    } else if (force || completed === total) {
      console.log(message)
    }
  }

  if (total === 0) {
    console.log(`${label}: 0/0 (100%) ETA 0s`)
    return {
      tick() {},
      finish() {},
    }
  }

  render(true)

  return {
    tick(increment = 1) {
      completed = Math.min(total, completed + increment)
      render()
    },
    finish() {
      completed = total
      render(true)

      if (process.stdout.isTTY) {
        process.stdout.write('\n')
      }

      finished = true
    },
  }
}
