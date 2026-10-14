import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren, Timer } from 'claude-code'

import type { Activity, AgentRun, AgentState, Live, PlanLimit, ToolUse, View } from '../types'

const PANE = 'session-info'
const MAX_EVENTS = 200
const MAX_AGENTS = 50
const MAX_AGENT_ROWS = 6

const initial: Live = {
  startedAt: 0,
  now: 0,
  model: '',
  changes: 0,
  turns: 0,
  subagents: 0,
  isBusy: false,
  tokensIn: 0,
  tokensOut: 0,
  tokensCache: 0,
  tokensCacheWrite: 0,
  steps: 0,
  contextWindow: 0,
  limits: [],
  tools: {},
  toolDetails: {},
  errors: 0,
  files: {},
  events: [],
  agents: {},
}
const live = atom({ plugin: 'session-info', key: 'live' } as const, initial)
const expanded = atom({ plugin: 'session-info', key: 'expanded' } as const, null)
const view = atom({ plugin: 'session-info', key: 'view' } as const, 'compact' as View)
const MAX_DETAILS = 10
const MAX_TASK = 400

const git = async ($: EngineInterface, argv: string[]) => {
  try {
    const r = await $.process.run(['git', ...argv], { timeoutMs: 5000 })
    return r.exitCode === 0 ? r.stdout.trim() : undefined
  } catch {
    return undefined
  }
}

const refreshGit = async ($: EngineInterface) => {
  const branch = await git($, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const status = await git($, ['status', '--short'])
  const changes = status ? status.split('\n').filter(Boolean).length : 0
  await update($, live, l => ({ ...l, branch, changes }))
}

const toLimit = (r: PlanLimit): PlanLimit => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt })

const LIMIT_NAME: Record<string, string> = { five_hour: 'Sesión (5 h)', seven_day: 'Semana (7 d)', spend_limit: 'Límite de gasto' }
const limitName = (kind: string) => LIMIT_NAME[kind] ?? kind.replace(/_/g, ' ')
const limitColor = (pct: number) => (pct >= 90 ? 'error' : pct >= 70 ? 'warning' : 'success')

/** Time left until an ISO reset, as `2h 13m` or `3d 4h`. */
const fmtResetIn = (iso: string | undefined, now: number) => {
  if (!iso) return ''
  const ms = Date.parse(iso) - now
  if (!Number.isFinite(ms)) return ''
  if (ms <= 0) return 'ya se restablece'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** Cost and context window as the status line has them; skipped where the host keeps none. */
const refreshUsage = async ($: EngineInterface) => {
  try {
    const u = await $.session.usage()
    await update($, live, l => ({
      ...l,
      costUsd: u.cost?.usd ?? l.costUsd,
      contextTokens: u.context.tokens ?? l.contextTokens,
      contextWindow: u.context.window,
      contextPct: u.context.percent ?? l.contextPct,
      limits: u.rateLimits.length ? u.rateLimits.map(toLimit) : l.limits,
    }))
  } catch {
    // usage is a nicety; the pane draws without it
  }
}

const base = (path: string) => path.split(/[\\/]/).pop() ?? path
const short = (s: string, n: number) => {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > n ? `${one.slice(0, n - 1)}…` : one
}

/** A short, human line for what a tool call is about. */
const describe = (input: Record<string, unknown>) => {
  const s = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : undefined)
  const path = s('file_path') ?? s('notebook_path') ?? s('path')
  const what =
    s('description') ?? s('command') ?? (path && base(path)) ?? s('pattern') ??
    s('skill') ?? s('url') ?? s('query') ?? s('prompt') ?? ''
  return short(what, 60)
}

/** What groups a tool's calls in its breakdown: the skill, the file, the command. */
const detailKey = (tool: string, input: Record<string, unknown>) => {
  const s = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : undefined)
  const pick =
    tool === 'Skill' ? s('skill')
    : tool === 'Agent' ? [s('subagent_type'), s('description')].filter(Boolean).join(': ')
    : tool === 'Bash' || tool === 'PowerShell' ? s('command')
    : s('file_path') ?? s('notebook_path') ?? s('pattern') ?? s('url') ?? s('query') ?? s('skill') ?? describe(input)
  return short(pick || '(sin detalle)', 120)
}

const addUse = (map: Record<string, ToolUse>, key: string, at: number): Record<string, ToolUse> => {
  const was = map[key] ?? { count: 0, errors: 0, lastAt: at }
  return { ...map, [key]: { ...was, count: was.count + 1, lastAt: at } }
}

const fmtMs = (ms: number) =>
  ms < 1000 ? `${ms}ms`
  : ms < 60_000 ? `${(ms / 1000).toFixed(1)}s`
  : `${Math.floor(ms / 60_000)}m${Math.round((ms % 60_000) / 1000)}s`
const fmtClock = (at: number) => {
  const d = new Date(at)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
const fmtK = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
const fmtElapsed = (ms: number) => {
  const m = Math.floor(ms / 60_000)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m ${Math.floor((ms % 60_000) / 1000)}s`
}

const fmtUsd = (usd?: number) => (usd === undefined ? '—' : `$${usd.toFixed(usd < 1 ? 3 : 2)}`)

const ICON: Record<Activity['status'], string> = { run: '●', ok: '✓', err: '✗', deny: '⊘' }
const COLOR: Record<Activity['status'], string> = { run: 'warning', ok: 'success', err: 'error', deny: 'error' }

const AGENT_ICON: Record<AgentState, string> = {
  pending: '○', running: '●', waiting: '◐', idle: '◌', completed: '✓', failed: '✗', killed: '⊘',
}
const AGENT_COLOR: Record<AgentState, string> = {
  pending: 'subtle', running: 'warning', waiting: 'suggestion', idle: 'subtle', completed: 'success', failed: 'error', killed: 'error',
}
const AGENT_WORD: Record<AgentState, string> = {
  pending: 'en cola', running: 'corriendo', waiting: 'esperando', idle: 'inactivo', completed: 'terminó', failed: 'falló', killed: 'detenido',
}
const isActive = (a: AgentRun) => a.status === 'pending' || a.status === 'running' || a.status === 'waiting'
const activeAgents = (l: Live) => Object.values(l.agents).filter(isActive)

/** Merges a change into one agent, adding it first when the pane has not seen it yet. */
const withAgent = (l: Live, id: string, change: (a: AgentRun) => AgentRun, at: number): Live => {
  const was: AgentRun = l.agents[id] ?? {
    id, type: 'agente', description: '', background: false, isTeammate: false, status: 'running',
    startedAt: at, tools: 0, errors: 0, tokensIn: 0, tokensOut: 0, listed: false,
  }
  const agents = { ...l.agents, [id]: change(was) }
  const ids = Object.keys(agents)
  if (ids.length > MAX_AGENTS) {
    // drop the oldest finished ones first; active agents always stay
    for (const old of ids.filter(k => { const a = agents[k]; return a !== undefined && !isActive(a) }).slice(0, ids.length - MAX_AGENTS)) delete agents[old]
  }
  return { ...l, agents }
}

const agentLabel = (a: AgentRun) => a.name ?? a.type

/** Brings statuses in line with the engine's list; one that left it after being listed has ended. */
const syncAgents = async ($: EngineInterface) => {
  let list
  try {
    list = await $.agent.list()
  } catch {
    return
  }
  const now = await $.clock.now()
  await update($, live, l => {
    let next = l
    const seen = new Set<string>()
    for (const info of list) {
      seen.add(info.id)
      next = withAgent(next, info.id, a => ({
        ...a,
        type: a.type === 'agente' ? info.type : a.type,
        description: a.description || info.description,
        name: a.name ?? info.name,
        parentId: a.parentId ?? info.parentId,
        isTeammate: a.isTeammate || info.teammateId !== undefined,
        status: info.status,
        endedAt: isActive(a) && !['pending', 'running', 'waiting'].includes(info.status) ? a.endedAt ?? now : a.endedAt,
        current: ['pending', 'running', 'waiting'].includes(info.status) ? a.current : undefined,
        listed: true,
      }), now)
    }
    for (const a of Object.values(next.agents)) {
      if (a.listed && !seen.has(a.id) && isActive(a)) {
        next = withAgent(next, a.id, x => ({ ...x, status: 'completed', endedAt: x.endedAt ?? now, current: undefined }), now)
      }
    }
    return next
  })
}

const push = (l: Live, a: Activity): Live => ({ ...l, events: [...l.events, a].slice(-MAX_EVENTS) })
const countTools = (l: Live) => Object.values(l.tools).reduce((a, b) => a + b, 0)
/** The main loop's tool in flight; agents' tools show in their own rows. */
const runningTool = (l: Live) => l.events.filter(a => a.status === 'run' && a.kind === 'tool' && a.agentId === undefined).at(-1)

const statusLine = (l: Live) => {
  const running = runningTool(l)
  const state = running ? `● ${running.label}` : l.isBusy ? '● pensando' : '○ en espera'
  const plan = l.limits
    .filter(x => x.kind === 'five_hour' || x.kind === 'seven_day')
    .map(x => `${x.kind === 'five_hour' ? '5h' : 'sem'} ${Math.round(x.percentUsed)}%`)
    .join(' ')
  const agents = activeAgents(l).length
  return `${state} · ${fmtK(l.tokensOut)} tok salida · ${fmtUsd(l.costUsd)}${plan ? ` · ${plan}` : ''} · ${countTools(l)} herr.${agents ? ` · ${agents} ag.` : ''}`
}

const summary = (l: Live) =>
  [
    `Sesión  ${l.model} · ${l.branch ?? 'sin git'} (${l.changes} cambios) · ${fmtElapsed(l.now - l.startedAt)} · ${l.turns} turnos`,
    `Herramientas ${countTools(l)} (${l.errors} errores) · tokens ↓${fmtK(l.tokensIn)} ↑${fmtK(l.tokensOut)} caché ${fmtK(l.tokensCache)}`,
    `Costo ${fmtUsd(l.costUsd)} · contexto ${l.contextPct ?? 0}% de ${fmtK(l.contextWindow)}`,
    ...l.limits.map(
      x => `${limitName(x.kind)}: ${x.percentUsed}% usado, ${Math.max(0, Math.round((100 - x.percentUsed) * 10) / 10)}% disponible${x.resetsAt ? ` · se restablece en ${fmtResetIn(x.resetsAt, l.now)}` : ''}`,
    ),
    `Archivos modificados: ${Object.keys(l.files).length}`,
    ...(l.task ? [`Tarea: ${short(l.task.text, 120)}`] : []),
    ...(Object.keys(l.agents).length
      ? [
          `Agentes: ${activeAgents(l).length} activos de ${Object.keys(l.agents).length}`,
          ...activeAgents(l).map(
            a => `  ${AGENT_ICON[a.status]} ${agentLabel(a)}: ${a.description || '(sin descripción)'} · ${AGENT_WORD[a.status]} ${fmtElapsed(l.now - a.startedAt)} · ${a.tools} herr.${a.current ? ` · ${a.current}` : ''}`,
          ),
        ]
      : []),
  ].join('\n')

const tick = async ($: EngineInterface) => {
  const now = await $.clock.now()
  await update($, live, l => ({ ...l, now }))
  await syncAgents($)
}

// the clock runs while the main loop works or any agent does (background ones outlive the turn)
let ticker: Timer | undefined
const startTicker = ($: EngineInterface) => {
  ticker ??= $.clock.every(1000, () => void tick($))
}
const stopTickerIfIdle = async ($: EngineInterface) => {
  const l = await read($, live)
  if (l.isBusy || activeAgents(l).length) return
  ticker?.cancel()
  ticker = undefined
}

export const register: Register = on => {

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'session-info',
      description: 'Panel en vivo de la sesión: modelo, git, herramientas, agentes, tokens, archivos y actividad',
      argumentHint: '[detalle|cerrar]',
      immediate: true,
    })
    const now = await $.clock.now()
    const model = await $.session.model()
    // spread over initial: a state kept from an older version gains the new fields
    await update($, live, l => ({ ...initial, ...l, startedAt: l.startedAt || now, now, model }))
    await refreshGit($)
    await refreshUsage($)

    return next(e)
  })

  on('command.run', { command: 'session-info' }, async ($, e) => {
    if (/^(cerrar|close)$/i.test(e.args.trim())) {
      await $.ui.close({ id: PANE })
      return { text: 'Panel de sesión cerrado.' }
    }
    // compact unless asked for the detail list
    await update($, view, () => (/^(detalle|detail)$/i.test(e.args.trim()) ? 'detail' : 'compact'))
    const now = await $.clock.now()
    const model = await $.session.model()
    // spread over initial: a state kept from an older version gains the new fields
    await update($, live, l => ({ ...initial, ...l, startedAt: l.startedAt || now, now, model }))
    await refreshGit($)
    await refreshUsage($)
    await syncAgents($)
    const { isPlaced } = await $.ui.open({ id: PANE, title: 'Sesión' })
    const l = await read($, live)

    return { text: `${summary(l)}${isPlaced ? '' : '\n(ensancha la terminal para ver el panel)'}` }
  })

  on('prompt.submit', async ($, e, next) => {
    const now = await $.clock.now()
    const text = e.text.replace(/\s+/g, ' ').trim()
    // only what the person typed (here or remotely) is the task: not agent notices, plugins or the pane's own command
    const typed = e.origin.kind === 'composer' || e.origin.kind === 'bridge'
    const task = typed && text && !/^\/session-info\b/.test(text) ? { text: short(text, MAX_TASK), at: now } : undefined
    await update($, live, l =>
      push(
        { ...l, now, isBusy: true, task: task ?? l.task },
        { id: `p${now}`, at: now, kind: 'prompt', label: 'prompt', detail: short(e.text, 60), status: 'ok' },
      ),
    )
    startTicker($)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('agent.spawn', async ($, e, next) => {
    const ran = await next(e)
    if (ran.agentId === undefined) return ran
    const id = ran.agentId
    const now = await $.clock.now()
    await update($, live, l => {
      const after = push(
        withAgent(l, id, a => ({
          ...a,
          type: e.fork ? 'fork' : e.subagentType,
          description: e.description,
          name: e.name ?? a.name,
          model: ran.model,
          parentId: e.parentAgentId,
          background: e.background,
          isTeammate: e.isTeammate === true,
          status: 'running',
          startedAt: now,
        }), now),
        {
          id: `a${id}`,
          at: now,
          kind: 'agent',
          label: `agente ${e.name ?? (e.fork ? 'fork' : e.subagentType)}`,
          detail: `${short(e.description, 50)}${e.background ? ' · en segundo plano' : ''}`,
          status: 'run',
        },
      )
      $.ui.status(statusLine(after))
      return after
    })
    startTicker($)

    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const started = await $.clock.now()
    const input = e as unknown as Record<string, unknown>
    const path = typeof input.file_path === 'string' ? input.file_path : undefined
    const writes = e.tool === 'Edit' || e.tool === 'Write' || e.tool === 'NotebookEdit'
    const key = detailKey(e.tool, input)

    await update($, live, l => {
      const after = push(
        {
          ...l,
          now: started,
          tools: { ...l.tools, [e.tool]: (l.tools[e.tool] ?? 0) + 1 },
          toolDetails: { ...l.toolDetails, [e.tool]: addUse(l.toolDetails[e.tool] ?? {}, key, started) },
        },
        { id: e.tool_use_id, at: started, kind: 'tool', label: e.tool, detail: describe(input), status: 'run', agentId: e.agentId },
      )
      const tracked =
        e.agentId === undefined
          ? after
          : withAgent(after, e.agentId, a => ({ ...a, current: `${e.tool} ${describe(input)}`.trim(), currentAt: started }), started)
      $.ui.status(statusLine(tracked))
      return tracked
    })

    const ran = await next(e)
    const ended = await $.clock.now()
    const status = ran.deny !== undefined ? 'deny' : ran.isError ? 'err' : 'ok'

    await update($, live, l => {
      const after: Live = {
        ...l,
        now: ended,
        errors: l.errors + (status === 'ok' ? 0 : 1),
        toolDetails:
          status === 'ok'
            ? l.toolDetails
            : (() => {
                const map = l.toolDetails[e.tool] ?? {}
                const was = map[key]
                return was ? { ...l.toolDetails, [e.tool]: { ...map, [key]: { ...was, errors: was.errors + 1 } } } : l.toolDetails
              })(),
        subagents: l.subagents + (e.tool === 'Agent' ? 1 : 0),
        files: writes && path && status === 'ok' ? { ...l.files, [path]: (l.files[path] ?? 0) + 1 } : l.files,
        events: l.events.map(a => (a.id === e.tool_use_id ? { ...a, status, ms: ended - started } : a)),
      }
      const tracked =
        e.agentId === undefined
          ? after
          : withAgent(after, e.agentId, a => ({
              ...a,
              tools: a.tools + 1,
              errors: a.errors + (status === 'ok' ? 0 : 1),
              // a later call may already have replaced it
              current: a.currentAt === started ? undefined : a.current,
            }), ended)
      $.ui.status(statusLine(tracked))
      return tracked
    })

    return ran
  }).catch(($, e, next) => next(e))

  // Each API response of any loop (main or subagent) adds its usage as it lands.
  on('turn.step', async function* ($, e, next) {
    const step = yield* next(e)
    const u = step?.usage
    if (u) {
      await update($, live, l => {
        const after: Live = {
          ...l,
          steps: l.steps + 1,
          tokensIn: l.tokensIn + u.input_tokens,
          tokensOut: l.tokensOut + u.output_tokens,
          tokensCache: l.tokensCache + u.cache_read_input_tokens,
          tokensCacheWrite: l.tokensCacheWrite + u.cache_creation_input_tokens,
          model: e.agentId === undefined ? u.model : l.model,
        }
        if (e.agentId === undefined) {
          $.ui.status(statusLine(after))
          return after
        }
        const tracked = withAgent(after, e.agentId, a => ({
          ...a,
          model: a.model ?? u.model,
          tokensIn: a.tokensIn + u.input_tokens,
          tokensOut: a.tokensOut + u.output_tokens,
        }), l.now)
        $.ui.status(statusLine(tracked))
        return tracked
      })
    }
    if (e.agentId === undefined) await refreshUsage($)

    return step
  })

  // The engine pushes plan windows when they move a whole point (and after each turn).
  on('session.measure', async ($, e, next) => {
    if (e.rateLimits.length) {
      await update($, live, l => ({ ...l, limits: e.rateLimits.map(toLimit) }))
    }
    if (e.cost) await update($, live, l => ({ ...l, costUsd: e.cost?.usd ?? l.costUsd }))

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      const id = e.agentId
      const now = await $.clock.now()
      await update($, live, l => {
        const was = l.agents[id]
        // a teammate goes idle between turns; any other agent is done
        const status: AgentState = e.isAborted ? 'killed' : was?.isTeammate ? 'idle' : 'completed'
        const after = withAgent(l, id, a => ({ ...a, status, endedAt: now, current: undefined }), now)
        const done = after.agents[id]
        if (!done) return after
        const ended = push(
          { ...after, now, events: after.events.map(x => (x.id === `a${id}` ? { ...x, status: e.isAborted ? 'err' : 'ok', ms: now - done.startedAt } : x)) },
          {
            id: `${e.turnId}-${id}`,
            at: now,
            kind: 'agent',
            label: `agente ${agentLabel(done)}`,
            detail: `${AGENT_WORD[status]} · ${done.tools} herr. · ↑${fmtK(done.tokensOut)} tokens`,
            status: e.isAborted ? 'err' : 'ok',
            ms: e.durationMs,
          },
        )
        $.ui.status(statusLine(ended))
        return ended
      })
      await stopTickerIfIdle($)
      return next(e)
    }
    const now = await $.clock.now()
    const u = e.usage
    await update($, live, l => {
      const after = push(
        {
          ...l,
          now,
          isBusy: false,
          turns: l.turns + 1,
          model: u?.model ?? l.model,
          // a tool of the main loop still marked running never returned; agents keep their own
          events: l.events.map(a => (a.status === 'run' && a.kind === 'tool' && a.agentId === undefined ? { ...a, status: 'err' as const } : a)),
        },
        {
          id: e.turnId,
          at: now,
          kind: 'turn',
          label: 'turno',
          detail: e.isAborted ? 'interrumpido' : `fin · ↑${fmtK(u?.output_tokens ?? 0)} tokens`,
          status: e.isAborted ? 'err' : 'ok',
          ms: e.durationMs,
        },
      )
      $.ui.status(statusLine(after))
      return after
    })
    await stopTickerIfIdle($)
    await refreshGit($)
    await refreshUsage($)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const l = await read($, live)
    const open = await read($, expanded)
    const mode = await read($, view)
    const cols = e.viewport?.columns ?? 80
    const rows = e.viewport?.rows ?? 30

    const tools = Object.entries(l.tools).sort((a, b) => b[1] - a[1])
    const max = tools[0]?.[1] ?? 1
    const nameW = Math.max(4, ...tools.map(([t]) => t.length))
    const barW = Math.max(6, Math.min(30, cols - nameW - 12))
    const files = Object.entries(l.files).sort((a, b) => b[1] - a[1])
    const running = runningTool(l)
    const ctxPct = l.contextPct ?? 0
    const ctxFill = Math.min(barW, Math.round((ctxPct / 100) * barW))
    const ctxColor = ctxPct >= 80 ? 'error' : ctxPct >= 60 ? 'warning' : 'success'
    const details = open
      ? Object.entries(l.toolDetails[open] ?? {}).sort((a, b) => b[1].count - a[1].count || b[1].lastAt - a[1].lastAt)
      : []
    const shownDetails = Math.min(details.length, MAX_DETAILS) + (details.length > MAX_DETAILS ? 1 : 0)
    const planRows = l.limits.length ? l.limits.length + 2 : 0
    const allAgents = Object.values(l.agents)
    const active = allAgents.filter(isActive)
    const finished = allAgents.filter(a => !isActive(a)).sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
    const agentRows = [...active, ...finished].slice(0, Math.max(MAX_AGENT_ROWS, active.length))
    const agentW = Math.max(4, ...agentRows.map(a => agentLabel(a).length))
    const agentLines = agentRows.length ? agentRows.length + agentRows.filter(a => a.current).length + 2 : 0
    const fixed = (l.task ? 4 : 0) + planRows + shownDetails + agentLines + 16 + Math.min(tools.length, 8) + (files.length ? Math.min(files.length, 5) + 2 : 0)
    const room = Math.max(3, rows - fixed)

    if (mode === 'compact') {
      // cards side by side from 70 columns, stacked below
      const narrow = cols < 70
      const half = narrow ? cols - 2 : Math.floor((cols - 3) / 2)
      const inner = Math.max(10, half - 4)
      const fullInner = Math.max(10, cols - 6)
      const bar = (pct: number, w: number, color: string) => {
        const fill = Math.min(w, Math.max(0, Math.round((pct / 100) * w)))
        return [<Text color={color}>{'█'.repeat(fill)}</Text>, <Text dimColor>{'░'.repeat(w - fill)}</Text>]
      }
      // paired cards take a fixed half so both columns line up; a lone card fills its row
      const card = (key: string, title: string, accent: string, body: RenderChildren[], extra?: string, paired = true) => (
        <Box key={key} flexDirection="column" flexGrow={1} width={paired && !narrow ? half : undefined} borderStyle="round" borderColor={accent} paddingX={1}>
          <Text bold color={accent} wrap="truncate-end">
            {title}{extra !== undefined && <Text dimColor> {extra}</Text>}
          </Text>
          {body}
        </Box>
      )
      const row = (key: string, cards: RenderChildren[]) => (
        <Box key={key} flexDirection={narrow ? 'column' : 'row'} columnGap={1}>{cards}</Box>
      )
      const state = running ? (
        <Text color="warning" bold wrap="truncate-end">
          ● {running.label} <Text dimColor>{running.detail} · {fmtMs(Math.max(0, l.now - running.at))}</Text>
        </Text>
      ) : l.isBusy ? (
        <Text color="claude">● pensando…</Text>
      ) : active.length ? (
        <Text color="suggestion">◐ esperando a {active.length === 1 ? '1 agente' : `${active.length} agentes`}</Text>
      ) : (
        <Text dimColor>○ en espera</Text>
      )
      const toolW = Math.max(4, ...tools.slice(0, 5).map(([t]) => t.length))
      const toolBar = Math.max(3, inner - toolW - 6)
      const ctxBar = Math.max(5, inner - 6)
      const limitBar = Math.max(5, fullInner - 40)
      const compactAgents = agentRows.slice(0, Math.max(4, active.length))
      const used = 22 + (l.task ? 5 : 0) + (l.limits.length ? l.limits.length + 3 : 0) + (compactAgents.length ? compactAgents.length + 3 : 0) + (narrow ? 20 : 0)
      const feed = Math.max(3, Math.min(8, rows - used))

      return (
        <Box flexDirection="column">
          <Box justifyContent="space-between" paddingX={1}>
            <Text bold>Sesión</Text>
            <Box columnGap={1}>
              <Button key="view" label="Detalle" onPress={() => update($, view, () => 'detail')} />
              <Button key="close" label="Cerrar" onPress={() => $.ui.close({ id: PANE })} />
            </Box>
          </Box>

          {l.task && row('r0', [
            card('c-task', 'Tarea', 'suggestion', [
              <Text wrap="wrap">{short(l.task.text, fullInner * 3)}</Text>,
            ], `hace ${fmtElapsed(l.now - l.task.at)}`, false),
          ])}

          {row('r1', [
            card('c-session', 'Sesión', 'claude', [
              <Text bold wrap="truncate-end">{l.model || '—'}</Text>,
              <Text wrap="truncate-end">
                <Text color="suggestion">⎇ {l.branch ?? 'sin git'}</Text>
                <Text color={l.changes ? 'warning' : 'subtle'}> · {l.changes} cambios</Text>
              </Text>,
              state,
            ]),
            card('c-time', 'Tiempo', 'suggestion', [
              <Text bold>⏱ {fmtElapsed(l.now - l.startedAt)}</Text>,
              <Text dimColor>{l.turns} turnos · {l.steps} respuestas</Text>,
              <Text dimColor>{countTools(l)} herramientas{l.errors ? ` · ${l.errors} errores` : ''}</Text>,
            ]),
          ])}

          {row('r2', [
            card('c-tokens', 'Tokens', 'success', [
              <Text>
                <Text dimColor>costo </Text><Text color="success" bold>{fmtUsd(l.costUsd)}</Text>
              </Text>,
              <Text wrap="truncate-end">
                <Text dimColor>↓</Text>{fmtK(l.tokensIn)} <Text dimColor>↑</Text><Text color="claude">{fmtK(l.tokensOut)}</Text>
              </Text>,
              <Text dimColor wrap="truncate-end">caché {fmtK(l.tokensCache)} · escrita {fmtK(l.tokensCacheWrite)}</Text>,
            ]),
            card('c-context', 'Contexto', ctxColor, [
              <Text>{bar(ctxPct, ctxBar, ctxColor)}</Text>,
              <Text>
                <Text bold color={ctxColor}>{ctxPct}%</Text>
                <Text dimColor> · {fmtK(l.contextTokens ?? 0)}/{fmtK(l.contextWindow)}</Text>
              </Text>,
            ]),
          ])}

          {l.limits.length > 0 && row('r3', [
            card('c-plan', 'Uso del plan', limitColor(Math.max(...l.limits.map(x => x.percentUsed))), l.limits.map(x => {
              const reset = fmtResetIn(x.resetsAt, l.now)
              return (
                <Text wrap="truncate-end">
                  <Text>{limitName(x.kind).padEnd(16)}</Text>
                  {bar(x.percentUsed, limitBar, limitColor(x.percentUsed))}
                  <Text bold color={limitColor(x.percentUsed)}> {x.percentUsed}%</Text>
                  <Text dimColor>{reset ? ` · reinicia en ${reset}` : ''}</Text>
                </Text>
              )
            }), undefined, false),
          ])}

          {row('r4', [
            card('c-tools', 'Herramientas', 'claude', tools.length === 0 ? [<Text dimColor>sin llamadas todavía</Text>] : tools.slice(0, 5).map(([tool, n]) => (
              <Text wrap="truncate-end">
                <Text>{tool.padEnd(toolW)} </Text>
                <Text color="claude">{'█'.repeat(Math.max(1, Math.round((n / max) * toolBar)))}</Text>
                <Text dimColor> {n}</Text>
              </Text>
            )), `${countTools(l)}${l.errors ? ` · ${l.errors} err` : ''}`),
            card('c-files', 'Archivos', 'diffAdded', files.length === 0 ? [<Text dimColor>sin cambios todavía</Text>] : files.slice(0, 5).map(([path, n]) => (
              <Text wrap="truncate-start">
                <Text color="diffAdded">✎</Text> {path} <Text dimColor>×{n}</Text>
              </Text>
            )), String(files.length)),
          ])}

          {compactAgents.length > 0 && row('r5', [
            card('c-agents', 'Agentes', active.length ? 'warning' : 'subtle', [
              ...compactAgents.map(a => (
                <Text wrap="truncate-end">
                  <Text color={AGENT_COLOR[a.status]}>{AGENT_ICON[a.status]} </Text>
                  <Text bold={isActive(a)}>{agentLabel(a)} </Text>
                  <Text>{a.description || '(sin descripción)'}</Text>
                  <Text dimColor> · {AGENT_WORD[a.status]} {fmtElapsed((a.endedAt ?? l.now) - a.startedAt)} · {a.tools} herr.</Text>
                  {a.current && <Text color="warning"> · {a.current}</Text>}
                </Text>
              )),
              ...(allAgents.length > compactAgents.length ? [<Text dimColor>… y {allAgents.length - compactAgents.length} más</Text>] : []),
            ], `${active.length} activos de ${allAgents.length}`, false),
          ])}

          {row('r6', [
            card('c-activity', 'Actividad', 'subtle', l.events.length === 0 ? [<Text dimColor>nada aún</Text>] : l.events.slice(-feed).map(a => (
              <Text wrap="truncate-end">
                <Text dimColor>{fmtClock(a.at)} </Text>
                <Text color={a.kind === 'prompt' ? 'suggestion' : COLOR[a.status]}>{a.kind === 'prompt' ? '▶' : ICON[a.status]} </Text>
                <Text bold={a.kind !== 'tool'}>{a.label} </Text>
                <Text dimColor>{a.detail}</Text>
              </Text>
            )), undefined, false),
          ])}
        </Box>
      )
    }

    return (
      <Box flexDirection="column" paddingX={1}>
        <Box justifyContent="space-between">
          <Text wrap="truncate-end">
            <Text bold color="claude">{l.model || '—'}</Text>
            <Text dimColor> · </Text>
            <Text color="suggestion">⎇ {l.branch ?? 'sin git'}</Text>
            <Text color={l.changes ? 'warning' : 'subtle'}> ({l.changes} cambios)</Text>
            <Text dimColor> · ⏱ {fmtElapsed(l.now - l.startedAt)} · {l.turns} turnos</Text>
          </Text>
          <Box columnGap={1}>
            <Button key="view" label="Compacta" onPress={() => update($, view, () => 'compact')} />
            <Button key="close" label="Cerrar" onPress={() => $.ui.close({ id: PANE })} />
          </Box>
        </Box>

        <Box marginTop={1}>
          {running ? (
            <Text color="warning" bold wrap="truncate-end">
              ● {running.label} <Text dimColor>{running.detail} · {fmtMs(Math.max(0, l.now - running.at))}</Text>
            </Text>
          ) : l.isBusy ? (
            <Text color="claude">● pensando…</Text>
          ) : active.length ? (
            <Text color="suggestion">◐ esperando a {active.length === 1 ? '1 agente' : `${active.length} agentes`}</Text>
          ) : (
            <Text dimColor>○ en espera</Text>
          )}
        </Box>

        {l.task && (
          <Box marginTop={1} flexDirection="column">
            <Text bold>Tarea <Text dimColor>hace {fmtElapsed(l.now - l.task.at)}</Text></Text>
            <Box marginLeft={2}>
              <Text wrap="wrap" color="suggestion">{short(l.task.text, Math.max(40, (cols - 4) * 2))}</Text>
            </Box>
          </Box>
        )}

        {agentRows.length > 0 && (
          <Box marginTop={1} flexDirection="column">
            <Text bold>
              Agentes <Text color={active.length ? 'warning' : 'subtle'}>{active.length} activos</Text>
              <Text dimColor> de {allAgents.length}</Text>
            </Text>
            {agentRows.map(a => (
              <Box key={`agent-${a.id}`} flexDirection="column">
                <Text wrap="truncate-end">
                  {a.parentId ? '    ' : '  '}
                  <Text color={AGENT_COLOR[a.status]}>{AGENT_ICON[a.status]} </Text>
                  <Text bold={isActive(a)}>{agentLabel(a).padEnd(agentW)} </Text>
                  <Text>{a.description || '(sin descripción)'}</Text>
                  <Text dimColor>
                    {' · '}{AGENT_WORD[a.status]} {fmtElapsed((a.endedAt ?? l.now) - a.startedAt)}
                    {' · '}{a.tools} herr.{a.tokensOut ? ` · ↑${fmtK(a.tokensOut)}` : ''}
                    {a.model ? ` · ${a.model}` : ''}{a.background ? ' · 2º plano' : ''}
                  </Text>
                  {a.errors > 0 && <Text color="error"> · {a.errors} err</Text>}
                </Text>
                {a.current && (
                  <Text wrap="truncate-end">
                    {a.parentId ? '      ' : '    '}<Text color="suggestion">└ </Text>
                    <Text color="warning">{a.current}</Text>
                    {a.currentAt !== undefined && <Text dimColor> · {fmtMs(Math.max(0, l.now - a.currentAt))}</Text>}
                  </Text>
                )}
              </Box>
            ))}
            {allAgents.length > agentRows.length && (
              <Text dimColor>  … y {allAgents.length - agentRows.length} terminados más</Text>
            )}
          </Box>
        )}

        <Box marginTop={1} flexDirection="column">
          <Text bold>
            Herramientas <Text dimColor>{countTools(l)} llamadas</Text>
            {l.errors > 0 && <Text color="error"> · {l.errors} errores</Text>}
            {l.subagents > 0 && <Text color="suggestion"> · {l.subagents} subagentes</Text>}
          </Text>
          {tools.length === 0 && <Text dimColor>  sin llamadas todavía</Text>}
          {tools.slice(0, 8).map(([tool, n], i) => {
            const isOpen = open === tool
            const kinds = Object.keys(l.toolDetails[tool] ?? {}).length
            return (
              <Box key={`row-${tool}`} flexDirection="column">
                <Button
                  key={`tool-${tool}`}
                  plain
                  hotkey={String(i + 1)}
                  onPress={() => update($, expanded, was => (was === tool ? null : tool))}
                >
                  <Text color={isOpen ? 'claude' : 'subtle'}>{isOpen ? '▾' : '▸'} </Text>
                  <Text bold={isOpen}>{tool.padEnd(nameW)} </Text>
                  <Text color="claude">{'█'.repeat(Math.max(1, Math.round((n / max) * barW)))}</Text>
                  <Text dimColor> {n}{kinds > 1 ? ` · ${kinds} distintos` : ''}</Text>
                </Button>
                {isOpen && (
                  <Box flexDirection="column" marginLeft={4}>
                    {details.slice(0, MAX_DETAILS).map(([what, use]) => (
                      <Text wrap="truncate-middle">
                        <Text color="suggestion">└ </Text>
                        <Text>{what}</Text>
                        <Text dimColor> ×{use.count} · {fmtClock(use.lastAt)}</Text>
                        {use.errors > 0 && <Text color="error"> · {use.errors} err</Text>}
                      </Text>
                    ))}
                    {details.length > MAX_DETAILS && (
                      <Text dimColor>  … y {details.length - MAX_DETAILS} más</Text>
                    )}
                  </Box>
                )}
              </Box>
            )
          })}
          {tools.length > 0 && <Text dimColor>  clic o 1-{Math.min(tools.length, 8)} para ver el detalle</Text>}
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text>
            <Text bold>Tokens </Text>
            <Text dimColor>{l.steps} respuestas · costo </Text>
            <Text color="success" bold>{fmtUsd(l.costUsd)}</Text>
          </Text>
          <Text>
            {'  '}<Text dimColor>entrada </Text>{fmtK(l.tokensIn)}
            <Text dimColor> · salida </Text><Text color="claude">{fmtK(l.tokensOut)}</Text>
            <Text dimColor> · caché leída </Text>{fmtK(l.tokensCache)}
            <Text dimColor> · escrita </Text>{fmtK(l.tokensCacheWrite)}
          </Text>
          <Text>
            {'  '}<Text dimColor>{'contexto'.padEnd(nameW)} </Text>
            <Text color={ctxColor}>{'█'.repeat(ctxFill)}</Text>
            <Text dimColor>{'░'.repeat(barW - ctxFill)}</Text>
            <Text dimColor> {ctxPct}% · {fmtK(l.contextTokens ?? 0)}/{fmtK(l.contextWindow)}</Text>
          </Text>
        </Box>

        {l.limits.length > 0 && (
          <Box marginTop={1} flexDirection="column">
            <Text bold>Uso del plan</Text>
            {l.limits.map(x => {
              const used = Math.min(100, Math.max(0, x.percentUsed))
              const fill = Math.round((used / 100) * barW)
              const left = Math.max(0, Math.round((100 - x.percentUsed) * 10) / 10)
              const reset = fmtResetIn(x.resetsAt, l.now)
              return (
                <Text wrap="truncate-end">
                  {'  '}<Text>{limitName(x.kind).padEnd(16)}</Text>
                  <Text color={limitColor(x.percentUsed)}>{'█'.repeat(fill)}</Text>
                  <Text dimColor>{'░'.repeat(barW - fill)}</Text>
                  <Text> {x.percentUsed}%</Text>
                  <Text dimColor> usado · </Text>
                  <Text color={limitColor(x.percentUsed)} bold>{left}%</Text>
                  <Text dimColor> libre{reset ? ` · reinicia en ${reset}` : ''}</Text>
                </Text>
              )
            })}
          </Box>
        )}

        {files.length > 0 && (
          <Box marginTop={1} flexDirection="column">
            <Text bold>Archivos modificados <Text dimColor>{files.length}</Text></Text>
            {files.slice(0, 5).map(([path, n]) => (
              <Text wrap="truncate-start">
                {'  '}<Text color="diffAdded">✎</Text> {path} <Text dimColor>×{n}</Text>
              </Text>
            ))}
          </Box>
        )}

        <Box marginTop={1} flexDirection="column">
          <Text bold>Actividad</Text>
          {l.events.length === 0 && <Text dimColor>  nada aún</Text>}
          {l.events.slice(-room).map(a => (
            <Text wrap="truncate-end">
              <Text dimColor>{fmtClock(a.at)} </Text>
              <Text color={a.kind === 'prompt' ? 'suggestion' : COLOR[a.status]}>
                {a.kind === 'prompt' ? '▶' : ICON[a.status]}{' '}
              </Text>
              <Text bold={a.kind !== 'tool'}>{a.label} </Text>
              <Text dimColor>{a.detail}</Text>
              {a.ms !== undefined && <Text dimColor> · {fmtMs(a.ms)}</Text>}
            </Text>
          ))}
        </Box>
      </Box>
    )
  })
}
