import { expect, test } from 'claude-code/testing'
import type { CommandRunInput, On, PromptSubmitInput } from 'claude-code'

import { CLIPBOARD_READERS, clipboardLines, isAttached, kindOf, pastedPaths } from './register'

const run = (args: string) => ({ command: 'adjuntos', args }) as CommandRunInput
const ask = (text: string) => ({ text, wait: false, origin: { kind: 'composer' } }) as PromptSubmitInput

const engine = (on: On) => {
  on('fs.stat', (_$, e) => ({
    value: e.path.includes('falta')
      ? { kind: 'other', size: 0, mtimeMs: 0, isLink: false }
      : { kind: /\.\w+$/.test(e.path) ? 'file' : 'dir', size: 2 * 1024 ** 2, mtimeMs: 0, isLink: false },
  }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('prompt.submit', (_$, e) => ({ text: e.text, context: e.context }))
  on('tool.check', () => ({ decision: 'ask' }))
}

test('reconoce rutas arrastradas en Windows, macOS y file://', async () => {
  expect(pastedPaths('"C:\\Mis docs\\informe.pdf" D:\\tmp\\demo.mp4')).toEqual([
    'C:\\Mis docs\\informe.pdf',
    'D:\\tmp\\demo.mp4',
  ])
  expect(pastedPaths('/Users/ana/Mis\\ fotos/plano.png ')).toEqual(['/Users/ana/Mis fotos/plano.png'])
  expect(pastedPaths('file:///C:/datos/ventas%202026.xlsx')).toEqual(['C:/datos/ventas 2026.xlsx'])
  expect(pastedPaths("& 'C:\\Mis docs\\informe de O''Neil.pdf' ")).toEqual(["C:\\Mis docs\\informe de O'Neil.pdf"])
  expect(pastedPaths("& 'C:\\a.txt' 'D:\\b c\\d.mp4'")).toEqual(['C:\\a.txt', 'D:\\b c\\d.mp4'])
  expect(pastedPaths('revisa informe.pdf')).toBeNull()
  expect(pastedPaths('a & b')).toBeNull()
})

test('clasifica por extensión', async () => {
  expect(kindOf('a.PDF')).toEqual({ label: 'PDF', isReference: false })
  expect(kindOf('a.mp4')).toEqual({ label: 'video', isReference: true })
  expect(kindOf('a.md')).toEqual({ label: 'texto', isReference: false })
})

test('/adjuntos con rutas las añade y abre el panel', async ($, on) => {
  engine(on)

  const { text } = await $.command.run(run('"C:\\Mis docs\\informe.pdf" C:\\tmp\\falta.txt'))

  expect(text).toContain('Añadidos: informe.pdf.')
  expect(text).toContain('No encontrados: C:\\tmp\\falta.txt.')
  expect(text).toContain('1 adjunto.')
})

test('cada petición lleva la lista de adjuntos como contexto', async ($, on) => {
  engine(on)
  await $.command.run(run('C:/docs/informe.pdf C:/media/demo.mp4 C:/datos'))

  const result = await $.prompt.submit(ask('resume los adjuntos'))
  const context = result.context?.join('\n') ?? ''

  expect(context).toContain('- C:/docs/informe.pdf (PDF, 2.0 MB)')
  expect(context).toContain('- C:/media/demo.mp4 (video, 2.0 MB): no puedes verlo')
  expect(context).toContain('- C:/datos/ (carpeta')
})

test('sin adjuntos la petición no cambia', async ($, on) => {
  engine(on)

  const result = await $.prompt.submit(ask('hola'))

  expect(result.context ?? []).toEqual([])
})

test('leer un adjunto no pide permiso; otra ruta sí', async ($, on) => {
  engine(on)
  await $.command.run(run('C:/docs/informe.pdf C:/datos'))

  expect((await $.tool.check({ tool: 'Read', input: { file_path: 'c:\\docs\\informe.pdf' } })).decision).toBe('allow')
  expect((await $.tool.check({ tool: 'Grep', input: { pattern: 'x', path: 'C:/datos/sub' } })).decision).toBe('allow')
  expect((await $.tool.check({ tool: 'Read', input: { file_path: 'C:/docs/otro.pdf' } })).decision).toBe('ask')
  expect((await $.tool.check({ tool: 'Read', input: { file_path: 'C:/datos-2/a.txt' } })).decision).toBe('ask')
})

test('vaciar quita todo', async ($, on) => {
  engine(on)
  await $.command.run(run('C:/docs/informe.pdf'))

  expect((await $.command.run(run('vaciar'))).text).toBe('Adjuntos vaciados.')
  expect((await $.prompt.submit(ask('hola'))).context ?? []).toEqual([])
})

test('/adjuntos pegar añade lo copiado en el explorador (Windows)', async ($, on) => {
  engine(on)
  on('process.run', (_$, e) => ({
    value: {
      exitCode: 0,
      stdout: e.argv[0] === 'powershell.exe' ? 'C:\\Mis docs\\informe.pdf\r\nC:\\Mis docs\\ventas.xlsx\r\n' : '',
      stderr: '',
      isStdoutTruncated: false,
      isStderrTruncated: false,
    },
  }))

  const { text } = await $.command.run(run('pegar'))

  expect(text).toContain('Añadidos: informe.pdf, ventas.xlsx.')
  expect(text).toContain('2 adjuntos.')
})

test('/adjuntos pegar sin archivos en el portapapeles lo dice', async ($, on) => {
  engine(on)
  on('process.run', () => ({
    value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))

  const { text } = await $.command.run(run('pegar'))

  expect(text).toContain('El portapapeles no tiene archivos')
  expect(text).toContain('0 adjuntos.')
})

test('lee las listas de archivos de macOS y Linux', async () => {
  expect(clipboardLines('/Users/ana/plano.pdf\n')).toEqual(['/Users/ana/plano.pdf'])
  expect(clipboardLines('# copiado\nfile:///home/ana/Mis%20docs/a.txt\r\n')).toEqual(['/home/ana/Mis docs/a.txt'])
  expect(clipboardLines('hola')).toEqual([])
})

test('isAttached no confunde carpetas con prefijo común', async () => {
  const list = [{ path: 'C:/datos', name: 'datos', kind: 'dir' as const, label: 'carpeta', isReference: false, size: 0 }]

  expect(isAttached(list, 'C:/datos/a.txt')).toBe(true)
  expect(isAttached(list, 'C:/datos2/a.txt')).toBe(false)
  expect(isAttached(list, 'C:/datos/../secreto.txt')).toBe(false)
})

test('el script de PowerShell no separa elseif de su if con ;', async () => {
  const ps = CLIPBOARD_READERS[0]?.at(-1) ?? ''

  expect(ps).toContain('} elseif (')
  expect(ps).not.toMatch(/;\s*elseif/)
})
