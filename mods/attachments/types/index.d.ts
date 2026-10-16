/** One file or folder the person attached in the pane. */
export type Attachment = {
  /** Absolute path, forward slashes. */
  path: string
  name: string
  /** `file` or `dir`, as `$.fs.stat` saw it when attached. */
  kind: 'file' | 'dir'
  /** What it is, in Spanish (`PDF`, `video`, `carpeta`…). */
  label: string
  /** True when the model cannot read it as text or image (video, audio, Office…). */
  isReference: boolean
  /** Bytes, for a file. */
  size: number
}

declare module 'claude-code' {
  interface PluginState {
    attachments: { files: Attachment[] }
  }
}
