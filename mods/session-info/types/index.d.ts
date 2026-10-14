export type ActivityStatus = 'run' | 'ok' | 'err' | 'deny'

export type Activity = {
  id: string
  at: number
  kind: 'prompt' | 'tool' | 'turn' | 'agent'
  label: string
  detail: string
  status: ActivityStatus
  ms?: number
  /** The subagent whose loop it happened in; absent on the main loop. */
  agentId?: string
}

/** Where an agent's loop stands, as `$.agent.list()` reports it. */
export type AgentState = 'pending' | 'running' | 'waiting' | 'idle' | 'completed' | 'failed' | 'killed'

/** One subagent or teammate of this session, as the pane tracks it. */
export type AgentRun = {
  id: string
  type: string
  description: string
  name?: string
  model?: string
  parentId?: string
  background: boolean
  isTeammate: boolean
  status: AgentState
  startedAt: number
  endedAt?: number
  tools: number
  errors: number
  tokensIn: number
  tokensOut: number
  /** The tool it is running right now (`Grep foo`), if any. */
  current?: string
  currentAt?: number
  /** Seen in `$.agent.list()` at least once: leaving it then means it ended. */
  listed: boolean
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
  /** The last request typed in the chat: the task being worked on. */
  task?: { text: string; at: number }
  /** Subagents and teammates by id, in spawn order. */
  agents: Record<string, AgentRun>
}

/** How the pane is laid out: compact cards (default) or the full detail list. */
export type View = 'compact' | 'detail'

declare module 'claude-code' {
  interface PluginState {
    'session-info': { live: Live; expanded: string | null; view: View }
  }
}
