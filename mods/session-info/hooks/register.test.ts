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
