export type ActivityStatus = 'run' | 'ok' | 'err' | 'deny'

export type Activity = {
  id: string
  at: number
  kind: 'prompt' | 'tool' | 'turn'
  label: string
  detail: string
  status: ActivityStatus
  ms?: number
}

export type ToolUse = { count: number; errors: number; lastAt: number }

/** A plan window as the last API response reported it (`five_hour`, `seven_day`, ...). */
export type PlanLimit = { kind: string; percentUsed: number; resetsAt?: string }

export type Live = {
  startedAt: number
  now: number
  model: string
  branch?: string
  changes: number
  turns: number
  subagents: number
  isBusy: boolean
  tokensIn: number
  tokensOut: number
  tokensCache: number
  tokensCacheWrite: number
  steps: number
  costUsd?: number
  contextTokens?: number
  contextWindow: number
  contextPct?: number
  limits: PlanLimit[]
  tools: Record<string, number>
  /** Per tool, what each call was about (a skill's name, a file, a command) and how often. */
  toolDetails: Record<string, Record<string, ToolUse>>
  errors: number
  files: Record<string, number>
  events: Activity[]
}

declare module 'claude-code' {
  interface PluginState {
    'session-info': { live: Live; expanded: string | null }
  }
}
