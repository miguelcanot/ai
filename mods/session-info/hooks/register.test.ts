import { expect, mock, test } from 'claude-code/testing'
import type { CommandRunInput, On } from 'claude-code'

const RUN = { command: 'session-info', args: '' } as CommandRunInput

const engine = (on: On) => {
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('process.run', (_$, e) => ({
    value: {
      exitCode: 0,
      stdout: e.argv.includes('status') ? ' M src/Root.tsx\n' : 'main\n',
      stderr: '',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    },
  }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  mock.clock(on)
}

test('/session-info opens the pane and summarizes model and git', async ($, on) => {
  engine(on)

  const { text } = await $.command.run(RUN)

  expect(text).toContain('claude-opus-5-5')
  expect(text).toContain('main (1 cambios)')
  expect(text).toContain('Herramientas 0')
})

test('tool calls and edited files are counted', async ($, on) => {
  engine(on)
  on('tool.call', () => ({ result: { ok: true }, text: 'ok' }))

  await $.tool.call({ tool: 'Edit', file_path: 'src/Root.tsx', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Bash', command: 'npm run lint' })
  const { text } = await $.command.run(RUN)

  expect(text).toContain('Herramientas 2 (0 errores)')
  expect(text).toContain('Archivos modificados: 1')
})

test('tokens and cost update on every model response', async ($, on) => {
  engine(on)
  on('session.usage', () => ({
    value: { startedAt: 0, context: { tokens: 50_000, window: 200_000, percent: 25 }, rateLimits: [], cost: { usd: 0.42 } },
  }))
  on('turn.step', async function* () {
    yield* []
    return {
      turnId: 't1',
      index: 0,
      answer: '',
      toolUses: [],
      stopReason: 'tool_use' as const,
      usage: { model: 'claude-opus-5-5', input_tokens: 1200, output_tokens: 300, cache_read_input_tokens: 40_000, cache_creation_input_tokens: 0 },
    }
  })

  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 3 })
  for await (const _chunk of stream) {
    // drained: the step's usage lands once the stream ends
  }
  const { text } = await $.command.run(RUN)

  expect(text).toContain('↓1.2k ↑300 caché 40.0k')
  expect(text).toContain('Costo $0.420 · contexto 25% de 200.0k')
})

const PANE_PROPS = {
  title: 'Sesión',
  isFocused: true,
  bodyColumns: 100,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`clicking a tool row lists what it was used for (${surface})`, async ($, on) => {
    engine(on)
    on('tool.call', () => ({ result: { ok: true }, text: 'ok' }))

    await $.tool.call({ tool: 'Skill', skill: 'remotion-render' })
    await $.tool.call({ tool: 'Skill', skill: 'remotion-docs' })
    await $.tool.call({ tool: 'Skill', skill: 'remotion-render' })

    const pane = await $.ui.mount({
      plugin: 'session-info',
      surface,
      component: 'Pane',
      props: PANE_PROPS,
      requestId: 'session-info',
    })
    // the tool breakdown lives in the detail view
    await pane.press({ key: 'view' })
    // the activity log already names each call; expanding adds the breakdown rows (findAll counts their ancestors too)
    const docs = async () => (await pane.findAll({ text: /remotion-docs/ })).length
    const before = await docs()
    expect(await pane.find({ text: /×2/ })).toBeUndefined()

    await pane.press({ key: 'tool-Skill' })
    expect(await docs()).toBeGreaterThan(before)
    expect(await pane.find({ text: /×2/ })).toBeDefined()

    await pane.press({ key: 'tool-Skill' })
    expect(await docs()).toBe(before)
  })
}

test('the pane opens as compact cards and switches to the detail list', async ($, on) => {
  engine(on)

  await $.command.run(RUN)
  const pane = await $.ui.mount({ plugin: 'session-info', surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'session-info' })

  expect(await pane.find({ text: /Contexto/ })).toBeDefined()
  expect(await pane.find({ text: /Detalle/ })).toBeDefined()
  expect(await pane.find({ text: /Uso del plan|Tokens/ })).toBeDefined()

  await pane.press({ key: 'view' })
  expect(await pane.find({ text: /Compacta/ })).toBeDefined()
  expect(await pane.find({ text: /llamadas/ })).toBeDefined()
})

test('/session-info detalle opens the detail list', async ($, on) => {
  engine(on)

  await $.command.run({ ...RUN, args: 'detalle' })
  const pane = await $.ui.mount({ plugin: 'session-info', surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'session-info' })

  expect(await pane.find({ text: /Compacta/ })).toBeDefined()
})

test('the last chat request shows as the task, not the pane command', async ($, on) => {
  engine(on)
  on('prompt.submit', (_$, e) => ({ text: e.text }))

  const typed = { wait: false, origin: { kind: 'composer' as const } }
  await $.prompt.submit({ ...typed, text: 'Agrega   paginación al listado de pedidos' })
  await $.prompt.submit({ ...typed, text: '/session-info' })
  await $.prompt.submit({ wait: false, origin: { kind: 'task-notification' }, text: '<task-notification>agente terminó</task-notification>' })
  const { text } = await $.command.run(RUN)
  expect(text).toContain('Tarea: Agrega paginación al listado de pedidos')

  const pane = await $.ui.mount({ plugin: 'session-info', surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'session-info' })
  expect(await pane.find({ text: /paginación al listado/ })).toBeDefined()
})

test('plan windows show used and available for the session and the week', async ($, on) => {
  engine(on)
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { window: 200_000 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 42, resetsAt: '2099-01-01T00:00:00Z' },
        { kind: 'seven_day', percentUsed: 87.5 },
      ],
    },
  }))

  const { text } = await $.command.run(RUN)

  expect(text).toContain('Sesión (5 h): 42% usado, 58% disponible · se restablece en')
  expect(text).toContain('Semana (7 d): 87.5% usado, 12.5% disponible')
})

test('agents show while running and once they finish', async ($, on) => {
  engine(on)
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'ag1' }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('turn.step', async function* () {
    yield* []
    return {
      turnId: 's1',
      index: 0,
      answer: '',
      toolUses: [],
      stopReason: 'end_turn' as const,
      usage: { model: 'claude-haiku-5-5', input_tokens: 800, output_tokens: 2500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    }
  })

  await $.agent.spawn({
    tool_use_id: 'tu1',
    prompt: 'Busca las rutas',
    description: 'buscar rutas',
    subagentType: 'Explore',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: true,
    fork: false,
  })
  for await (const _chunk of $.turn.step({ turnId: 's1', index: 0, model: 'claude-haiku-5-5', messageCount: 1, agentId: 'ag1' })) {
    // drained: the step's usage lands once the stream ends
  }
  let { text } = await $.command.run(RUN)

  expect(text).toContain('Agentes: 1 activos de 1')
  expect(text).toContain('Explore: buscar rutas · corriendo')
  // the main model stays the session's, not the subagent's
  expect(text).toContain('Sesión  claude-opus-5-5')

  await $.turn.complete({ turnId: 't9', agentId: 'ag1', answer: 'listo', durationMs: 1200, isAborted: false, reason: 'answer' })
  ;({ text } = await $.command.run(RUN))

  expect(text).toContain('Agentes: 0 activos de 1')
})

test('the engine list adds agents the pane missed and ends the ones it drops', async ($, on) => {
  engine(on)
  let listed = [{ id: 'ag2', description: 'revisar tests', type: 'general-purpose', status: 'running' as const }]
  on('agent.list', () => ({ value: listed }))

  let { text } = await $.command.run(RUN)
  expect(text).toContain('general-purpose: revisar tests · corriendo')

  listed = []
  ;({ text } = await $.command.run(RUN))
  expect(text).toContain('Agentes: 0 activos de 1')
})
