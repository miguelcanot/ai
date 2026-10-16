import { atom, read, update } from 'claude-code'
import type { EngineInterface, FsStat, Register } from 'claude-code'

import type { Attachment } from '../types'

const PANE = 'attachments'
const TITLE = 'Adjuntos'
const files = atom({ plugin: 'attachments', key: 'files' } as const, [] as Attachment[])

// Tipo de cada extensión; `true` = solo por referencia (el modelo no lo lee).
const KINDS: [RegExp, string, boolean][] = [
  [/\.pdf$/i, 'PDF', false],
  [/\.(png|jpe?g|gif|webp|bmp)$/i, 'imagen', false],
  [/\.(mp4|mov|m4v|avi|mkv|webm|wmv|flv|mpe?g|3gp)$/i, 'video', true],
  [/\.(mp3|wav|m4a|aac|flac|ogg|opus|wma|aiff?)$/i, 'audio', true],
  [/\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf|pages|numbers|key)$/i, 'Office', true],
  [/\.(zip|rar|7z|tar|gz|tgz|bz2|xz)$/i, 'comprimido', true],
  [/\.(exe|dll|msi|dmg|pkg|apk|aab|ipa|bin|iso)$/i, 'binario', true],
  [/\.(psd|ai|sketch|fig|xd|tiff?|heic|raw|cr2|nef)$/i, 'diseño', true],
]

const HINTS: Record<string, string> = {
  video: 'no puedes verlo; si hace falta, propón extraer fotogramas o audio (p. ej. con ffmpeg)',
  audio: 'no puedes oírlo; si hace falta, propón transcribirlo con una herramienta',
  Office: 'léelo con una herramienta o skill que entienda el formato (docx, xlsx, pptx)',
}

/** El tipo de un archivo por su extensión: etiqueta y si va solo por referencia. */
export const kindOf = (path: string): { label: string; isReference: boolean } => {
  const hit = KINDS.find(([re]) => re.test(path))

  return hit ? { label: hit[1], isReference: hit[2] } : { label: 'texto', isReference: false }
}

const isAbsolute = (p: string) => /^([A-Za-z]:[\\/]|\\\\|\/|~\/)/.test(p)

/**
 * Las rutas de lo que soltó la terminal al arrastrar: entre comillas (Windows
 * Terminal, iTerm), con `& '...'` delante (terminal de VS Code con PowerShell),
 * con espacios escapados (macOS) o como `file://`. null si el texto no es solo
 * una lista de rutas absolutas.
 */
export const pastedPaths = (text: string): string[] | null => {
  const tokens = text.trim().replace(/^&\s+/, '').match(/"[^"]+"|'(?:[^']|'')+'|(?:\\ |\S)+/g)
  if (!tokens) {
    return null
  }

  const paths = tokens.map(t => {
    let p = t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1)
      : t.startsWith("'") && t.endsWith("'") ? t.slice(1, -1).replace(/''/g, "'")
        : t.replace(/\\ /g, ' ')
    if (/^file:\/\//i.test(p)) {
      try {
        p = decodeURIComponent(p.replace(/^file:\/\/(localhost)?/i, ''))
      } catch {
        return ''
      }
      if (/^\/[A-Za-z]:\//.test(p)) {
        p = p.slice(1)
      }
    }

    return p
  })

  return paths.every(isAbsolute) ? paths : null
}

/** Barras normales y sin barra final: la forma con la que se guarda y compara. */
export const normalize = (p: string) => p.replace(/\\/g, '/').replace(/(.)\/+$/, '$1')

const sameOrUnder = (path: string, root: string, isDir: boolean) => {
  const fold = (s: string) => (/^[A-Za-z]:\//.test(s) ? s.toLowerCase() : s)
  const p = fold(normalize(path))
  const r = fold(root)

  return p === r || (isDir && p.startsWith(r + '/'))
}

/** Si la ruta que pide una herramienta está adjunta (o dentro de una carpeta adjunta). */
export const isAttached = (list: Attachment[], path: string) =>
  !/(^|[\\/])\.\.([\\/]|$)/.test(path) && list.some(a => sameOrUnder(path, a.path, a.kind === 'dir'))

export const sizeOf = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
    : bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`

/** Lo que lee el modelo con cada petición mientras haya adjuntos. */
export const contextOf = (list: Attachment[]) => {
  const lines = list.map(a => {
    if (a.kind === 'dir') {
      return `- ${a.path}/ (carpeta: búscala con Glob/Grep y lee lo que haga falta)`
    }
    const hint = a.isReference ? `: ${HINTS[a.label] ?? 'no se puede leer como texto; úsalo por su ruta'}` : ''

    return `- ${a.path} (${a.label}, ${sizeOf(a.size)})${hint}`
  })

  return [
    'La persona tiene estos archivos en su panel de Adjuntos. Úsalos cuando la petición se refiera a ellos, a "los adjuntos" o a su contenido.',
    'Léelos con Read (también imágenes y PDF) desde su ruta, sin copiarlos al proyecto salvo que te lo pida; tienes permiso de lectura sobre ellos.',
    ...lines,
  ].join('\n')
}

const nameOf = (path: string) => normalize(path).split('/').pop() || path

// Windows: archivos copiados en el Explorador o, si no hay, una imagen copiada
// (captura, imagen del navegador), que se guarda como PNG en la carpeta temporal.
// `elseif` va en la misma sentencia que su `if`: sin `;` entre ellos.
const PS_CLIPBOARD = 'Add-Type -AssemblyName System.Windows.Forms, System.Drawing; '
  + '$c = [Windows.Forms.Clipboard]; '
  + 'if ($c::ContainsFileDropList()) { $c::GetFileDropList() } '
  + "elseif ($c::ContainsImage()) { $p = Join-Path $env:TEMP ('adjunto-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.png'); $c::GetImage().Save($p, [Drawing.Imaging.ImageFormat]::Png); $p }"

// Se prueban en orden; en cada sistema los que no existen fallan enseguida.
export const CLIPBOARD_READERS: string[][] = [
  ['powershell.exe', '-NoProfile', '-STA', '-Command', PS_CLIPBOARD],
  ['osascript', '-e', 'POSIX path of (the clipboard as «class furl»)'],
  ['wl-paste', '--no-newline', '--type', 'text/uri-list'],
  ['xclip', '-selection', 'clipboard', '-o', '-t', 'text/uri-list'],
]

/** Una línea por archivo, como la dan los lectores del portapapeles (`file://` o ruta). */
export const clipboardLines = (stdout: string) =>
  stdout.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(l => pastedPaths(`"${l}"`)?.[0] ?? '').filter(isAbsolute)

/** Las rutas de los archivos que hay en el portapapeles; vacío si no hay ninguno. */
const clipboardPaths = async ($: EngineInterface) => {
  for (const argv of CLIPBOARD_READERS) {
    const ran = await $.process.run(argv).catch(() => null)
    const paths = ran && ran.exitCode === 0 ? clipboardLines(ran.stdout) : []
    if (paths.length) {
      return paths
    }
  }

  return []
}

/** Añade las rutas que existan; devuelve los nombres añadidos y las que no se encontraron. */
const attach = async ($: EngineInterface, paths: string[]) => {
  const stats = await Promise.all(paths.map(p => $.fs.stat(p).catch((): FsStat | null => null)))
  const added: Attachment[] = []
  const missing: string[] = []
  paths.forEach((p, i) => {
    const s = stats[i]
    if (s?.kind === 'file' || s?.kind === 'dir') {
      const path = normalize(p)
      const kind = s.kind === 'dir' ? { label: 'carpeta', isReference: false } : kindOf(path)
      added.push({ path, name: nameOf(path), kind: s.kind, size: s.size, ...kind })
    } else {
      missing.push(p)
    }
  })
  if (added.length) {
    await update($, files, list => [
      ...list.filter(a => !added.some(b => b.path === a.path)),
      ...added,
    ])
  }

  return { added, missing }
}

/** Añade lo que haya en el portapapeles y abre el panel; null si no había archivos. */
const attachClipboard = async ($: EngineInterface) => {
  const paths = await clipboardPaths($)
  if (!paths.length) {
    return null
  }
  const result = await attach($, paths)
  if (result.added.length) {
    $.ui.toast(`Adjuntado: ${result.added.map(a => a.name).join(', ')}`)
    void $.ui.open({ id: PANE, title: TITLE })
  }

  return result
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'adjuntos',
      description: 'Panel de adjuntos: arrastra archivos o carpetas a la terminal (o pasa rutas) para que Claude trabaje con ellos',
      argumentHint: '[ruta… | pegar | vaciar | cerrar]',
    })

    return next(e)
  })

  on('command.run', { command: 'adjuntos' }, async ($, e) => {
    const args = e.args.trim()
    if (/^(cerrar|close)$/i.test(args)) {
      await $.ui.close({ id: PANE })

      return { text: 'Panel de adjuntos cerrado; los adjuntos se mantienen.' }
    }
    if (/^(vaciar|clear)$/i.test(args)) {
      await update($, files, () => [])

      return { text: 'Adjuntos vaciados.' }
    }

    let note = ''
    if (/^(pegar|paste)$/i.test(args)) {
      const result = await attachClipboard($)
      note = result?.added.length
        ? `Añadidos: ${result.added.map(a => a.name).join(', ')}.`
        : 'El portapapeles no tiene archivos (copia uno en el explorador de archivos).'
    } else if (args) {
      const paths = pastedPaths(args)
      if (!paths) {
        return { text: 'Pasa rutas absolutas (entre comillas si tienen espacios), o "pegar" / "vaciar" / "cerrar".' }
      }
      const { added, missing } = await attach($, paths)
      note = [
        added.length ? `Añadidos: ${added.map(a => a.name).join(', ')}.` : '',
        missing.length ? `No encontrados: ${missing.join(', ')}.` : '',
      ].filter(Boolean).join(' ')
    }

    const { isPlaced } = await $.ui.open({ id: PANE, title: TITLE })
    const count = (await read($, files)).length

    return {
      text: [note, `${count} adjunto${count === 1 ? '' : 's'}.`, isPlaced ? '' : '(ensancha la terminal para ver el panel)']
        .filter(Boolean).join(' '),
    }
  })

  // Arrastrar a la terminal es pegar rutas: van al panel, no al texto. (Ctrl+V
  // con archivos copiados no llega aquí: la terminal se queda la tecla y, sin
  // texto en el portapapeles, no pega nada; para eso están /adjuntos pegar y Pegar.)
  on('prompt.edit', async ($, e, next) => {
    if (e.key || !e.inputText) {
      return next(e)
    }
    const paths = pastedPaths(e.inputText)
    if (!paths) {
      return next(e)
    }
    const stats = await Promise.all(paths.map(p => $.fs.stat(p).catch((): FsStat | null => null)))
    if (stats.some(s => s?.kind !== 'file' && s?.kind !== 'dir')) {
      return next(e)
    }

    const { added } = await attach($, paths)
    $.ui.toast(`Adjuntado: ${added.map(a => a.name).join(', ')}`)
    void $.ui.open({ id: PANE, title: TITLE })

    return { text: e.text, cursor: e.cursor }
  })

  on('prompt.submit', async ($, e, next) => {
    const list = await read($, files)
    if (!list.length) {
      return next(e)
    }

    return next({ ...e, context: [...(e.context ?? []), contextOf(list)] })
  })

  // Leer lo adjunto no pide permiso: la persona ya lo eligió.
  on('tool.check', async ($, e, next) => {
    if (e.tool !== 'Read' && e.tool !== 'Glob' && e.tool !== 'Grep') {
      return next(e)
    }
    const input = (e.input ?? {}) as { file_path?: unknown; path?: unknown }
    const path = e.tool === 'Read' ? input.file_path : input.path
    if (typeof path !== 'string' || !isAbsolute(path) || !isAttached(await read($, files), path)) {
      return next(e)
    }

    return { decision: 'allow', reason: 'Adjunto en el panel de Adjuntos' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, files)

    return (
      <Box flexDirection="column">
        {list.length === 0 && (
          <Text dimColor>Arrastra archivos o carpetas a la terminal, cópialos y pulsa Pegar, o usa /adjuntos "ruta".</Text>
        )}
        {list.map(a => (
          <Box key={a.path} flexDirection="row" gap={1}>
            <Button key={`rm:${a.path}`} label="Quitar" onPress={() => update($, files, l => l.filter(x => x.path !== a.path))} />
            <Text bold>{a.name}</Text>
            <Text dimColor>
              {a.label}
              {a.kind === 'file' ? ` · ${sizeOf(a.size)}` : ''}
              {a.isReference ? ' · por referencia' : ''}
            </Text>
          </Box>
        ))}
        <Box flexDirection="row" gap={1} marginTop={1}>
          <Button
            key="paste"
            label="Pegar"
            onPress={async () => {
              if (!(await attachClipboard($))) {
                $.ui.toast('El portapapeles no tiene archivos')
              }
            }}
          />
          {list.length > 0 && <Button key="clear" label="Vaciar" onPress={() => update($, files, () => [])} />}
          <Button key="close" label="Cerrar" onPress={() => $.ui.close({ id: PANE })} />
        </Box>
        {list.length > 0 && (
          <Text dimColor>Claude los ve en cada petición hasta que los quites.</Text>
        )}
      </Box>
    )
  })
}
