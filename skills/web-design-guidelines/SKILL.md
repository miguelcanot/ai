---
name: web-design-guidelines
description: Revisa código de UI contra las Web Interface Guidelines de Vercel (accesibilidad, foco, formularios, animación, tipografía, rendimiento, i18n). Úsala cuando el usuario pida "revisar mi UI", "revisar la accesibilidad", "auditar el diseño", "revisar la UX", "comprobar el sitio contra buenas prácticas", o en inglés "review my UI", "check accessibility", "audit design", "review UX", "check my site against best practices".
argument-hint: <archivo-o-patrón>
metadata:
  author: vercel
  version: "1.0.0"
---

# Web Interface Guidelines

Revisa archivos de UI contra las Web Interface Guidelines de Vercel.

## Cómo funciona

1. Lee las reglas en **`references/guidelines.md`** (copia local; no hace falta red).
2. Lee los archivos indicados en el argumento. Si no se indicó ninguno, pregunta cuáles revisar.
3. Contrasta cada archivo con todas las reglas.
4. Entrega los hallazgos con el formato que define la sección "Output Format" de las reglas: agrupados por archivo, en formato `archivo:línea`, breves.

## Origen

Las reglas vienen de [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) (`command.md`, commit `434b7f9`), con licencia MIT (ver `LICENSE`). Para actualizarlas, vuelve a copiar ese archivo en `references/guidelines.md`, quitando el frontmatter y la línea `$ARGUMENTS`.
