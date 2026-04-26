import { defineStore } from 'pinia'

type SimMode = 'FIXED' | 'RANDOM'

interface PersistedState {
  selectedChains: string[]
  selectedSubsystems: string[]
  mode: SimMode
  intervalMs: number
  isRunning: boolean
}

const HASH_NAME = 'GUI_STATE:tm/chain-simulator'

let redisSaveQueue: Promise<void> = Promise.resolve()

const DEFAULT_STATE: PersistedState = {
  selectedChains: [],
  selectedSubsystems: [],
  mode: 'FIXED',
  intervalMs: 1000,
  isRunning: false,
}

export const useTmChainSimulatorStateStore = defineStore('tmChainSimulatorState', {
  state: (): PersistedState => ({ ...DEFAULT_STATE }),

  actions: {
    async loadFromRedis() {
      if (!import.meta.client)
        return

      const apiBase = `http://${window.location.host}/api/go/v1`
      try {
        const resp = await $fetch<{ hash: string, values: Record<string, string> }>(
          `${apiBase}/redis/hash/read`,
          {
            method: 'POST',
            body: {
              hash: HASH_NAME,
              keys: ['selectedChains', 'selectedSubsystems', 'mode', 'intervalMs', 'isRunning'],
            },
          },
        )

        const values = resp?.values ?? {}

        this.selectedChains = parseArray(values.selectedChains, DEFAULT_STATE.selectedChains)
        this.selectedSubsystems = parseArray(values.selectedSubsystems, DEFAULT_STATE.selectedSubsystems)
        this.mode = parseMode(values.mode, DEFAULT_STATE.mode)
        this.intervalMs = parseInterval(values.intervalMs, DEFAULT_STATE.intervalMs)
        this.isRunning = parseBool(values.isRunning, DEFAULT_STATE.isRunning)
      }
      catch (e) {
        console.error('[tm/chain-simulator] failed to load redis state', e)
      }
    },

    async saveToRedis() {
      if (!import.meta.client)
        return

      const apiBase = `http://${window.location.host}/api/go/v1`
      const snapshot = {
        selectedChains: [...this.selectedChains],
        selectedSubsystems: [...this.selectedSubsystems],
        mode: this.mode,
        intervalMs: this.intervalMs,
        isRunning: this.isRunning,
      }

      redisSaveQueue = redisSaveQueue
        .catch(() => {
          // Keep queue alive after a failure so later saves still run.
        })
        .then(async () => {
          try {
            await $fetch(`${apiBase}/redis/hash/write`, {
              method: 'POST',
              body: {
                hash: HASH_NAME,
                values: {
                  selectedChains: JSON.stringify(snapshot.selectedChains),
                  selectedSubsystems: JSON.stringify(snapshot.selectedSubsystems),
                  mode: snapshot.mode,
                  intervalMs: String(snapshot.intervalMs),
                  isRunning: String(snapshot.isRunning),
                },
              },
            })
          }
          catch (e) {
            console.error('[tm/chain-simulator] failed to save redis state', e)
          }
        })

      return redisSaveQueue
    },
  },
})

function parseArray(v: string | undefined, fallback: string[]): string[] {
  if (!v)
    return fallback
  try {
    const parsed = JSON.parse(v)
    if (Array.isArray(parsed))
      return parsed.map(String)
  }
  catch {
    // ignore parse errors and use fallback
  }
  return fallback
}

function parseMode(v: string | undefined, fallback: SimMode): SimMode {
  return v === 'RANDOM' || v === 'FIXED' ? v : fallback
}

function parseInterval(v: string | undefined, fallback: number): number {
  if (!v)
    return fallback
  const n = Number(v)
  if (!Number.isFinite(n))
    return fallback
  return Math.max(100, Math.floor(n))
}

function parseBool(v: string | undefined, fallback: boolean): boolean {
  if (!v)
    return fallback
  if (v === 'true')
    return true
  if (v === 'false')
    return false
  return fallback
}
