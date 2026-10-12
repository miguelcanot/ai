# Personalizaciones de Claude Code

Skills y mods propios para [Claude Code](https://claude.com/claude-code). Este repositorio es la fuente; lo que Claude Code usa son las copias instaladas en `~/.claude/`.

## Contenido

### Skills (`skills/`)

| Skill | Para qué sirve |
|---|---|
| [`mobile-legal-audit`](skills/mobile-legal-audit/SKILL.md) | Auditoría de cumplimiento legal y de políticas de tienda (Google Play, App Store) de apps móviles, contrastando el código real contra GDPR, CCPA, LGPD, Ley 172-13 de RD, consentimiento de anuncios, suscripciones y propiedad intelectual. Incluye scripts de inventario de SDKs y de medios externos. |
| [`perf-audit`](skills/perf-audit/SKILL.md) | Auditoría de rendimiento: consultas al backend (Express/MongoDB/Mongoose: N+1, índices, `.lean()`, payloads) y tamaño del bundle (Flutter, assets, dependencias sin uso, R8). Mide primero y entrega un informe con cifras y orden sugerido. Incluye scripts de inventario de assets, optimización de imágenes, dependencias sin uso y desglose de `.aab`/`.apk`. |
| [`web-analytics-consent`](skills/web-analytics-consent/SKILL.md) | Instala Google Analytics 4 con banner de cookies (Consent Mode v2) en un sitio estático y actualiza la política de privacidad. |
| [`web-design-guidelines`](skills/web-design-guidelines/SKILL.md) | Revisión de UI contra las Web Interface Guidelines de Vercel (de terceros). |

### Mods (`mods/`)

| Mod | Para qué sirve |
|---|---|
| [`session-info`](mods/session-info) | Comando `/session-info`: panel en vivo con modelo, rama de git, herramientas usadas, agentes en curso (tipo, tarea, estado, herramienta actual, tokens), tokens, costo, límites del plan, archivos modificados y actividad de la sesión. |

## Instalación

### Skills globales

`mobile-legal-audit`, `web-analytics-consent` y `web-design-guidelines` se instalan en `~/.claude/skills/` y quedan disponibles en cualquier proyecto:

```bash
cp -r skills/mobile-legal-audit ~/.claude/skills/
cp -r skills/web-analytics-consent ~/.claude/skills/
cp -r skills/web-design-guidelines ~/.claude/skills/
```

- `mobile-legal-audit` llama a sus scripts desde `~/.claude/skills/mobile-legal-audit/scripts/`, así que debe quedar en esa ruta. Los scripts requieren Python 3 y reciben la raíz del proyecto auditado:
  - `sdk_inventory.py <raíz>` — SDKs, permisos y piezas de cumplimiento.
  - `external_media.py <raíz> [--all]` — medios cargados desde dominios de terceros (`--all` incluye también APIs y documentación).
- `web-analytics-consent` copia `consent.template.js` al sitio; el Measurement ID, la clave de `localStorage` y los estilos del banner se editan dentro de ese archivo.
- `web-design-guidelines` (de Vercel) descarga sus reglas de GitHub en cada revisión: necesita red y la herramienta WebFetch.

### Skill por proyecto: `perf-audit`

`perf-audit` llama a sus scripts con una ruta relativa al proyecto (`.claude/skills/perf-audit/scripts/`), así que se instala **dentro del proyecto auditado**, no en `~/.claude/skills/`:

```bash
cp -r skills/perf-audit <proyecto>/.claude/skills/
```

Solo aparece en los proyectos donde se copió; en los demás Claude Code no la ofrece. Requisitos: Python 3 (`optimize_images.py` además necesita Pillow: `pip install Pillow`) y bash para `unused_deps.sh`. Scripts:

| Script | Uso |
|---|---|
| `asset_inventory.py <dir> [--top N]` | Peso, dimensiones reales y total de las imágenes (lista las `N` más pesadas, 30 por defecto). |
| `optimize_images.py <dir> [--max-width N] [--max-height N] [--quality Q] [--quantize] [--dry-run] [--backup-dir D]` | Redimensiona y recomprime, y reporta la pérdida (PSNR). Guarda los originales salvo con `--no-backup`; `--dry-run` solo reporta. |
| `unused_deps.sh [ruta-al-proyecto]` | Dependencias de `pubspec.yaml` que nada en `lib/` parece usar (por defecto, el directorio actual). |
| `aab_breakdown.py <aab-o-apk> [--assets] [--abi ABI]` | Desglose del artefacto y tamaño que descarga de verdad el usuario (`--abi` por defecto `arm64-v8a`). |

Los comandos de ejemplo del backend asumen el código en `server/src`; ajústalo a la carpeta real del proyecto.

### Mod `session-info`

1. Copia el mod a `~/.claude/mods/session-info`.
2. Agrega el marketplace local e instala el plugin:

   ```bash
   claude plugin marketplace add ~/.claude/mods/session-info
   claude plugin install session-info@mcanot-mods
   ```

   (o lo mismo desde Claude Code con `/plugin marketplace add …` y `/plugin install …`).

#### Actualizar tras un cambio

Claude Code usa una copia en caché por versión (`~/.claude/plugins/cache/mcanot-mods/session-info/<versión>`), así que copiar los archivos no basta:

1. Sube `version` en `.claude-plugin/plugin.json`.
2. Copia el mod a `~/.claude/mods/session-info`.
3. Refresca el marketplace y actualiza el plugin:

   ```bash
   claude plugin marketplace update mcanot-mods
   claude plugin update session-info@mcanot-mods
   ```

4. Reinicia Claude Code. `claude plugin list` muestra la versión cargada.

#### Uso

| Comando | Efecto |
|---|---|
| `/session-info` | Abre el panel **Sesión** y escribe un resumen en el chat. |
| `/session-info cerrar` | Cierra el panel (también acepta `close`, o el botón **Cerrar** del panel). |

En el panel, pulsar una herramienta despliega para qué se usó (archivos, comandos, skills); pulsarla otra vez la pliega. Si la terminal es demasiado estrecha el panel no se coloca y el resumen lo avisa: ensancha la ventana y vuelve a ejecutar el comando.

## Desarrollo del mod

Claude Code genera las declaraciones de tipos en `.claude-plugin/types/` al cargar el mod (no se versionan). Con ellas presentes:

```bash
claude plugin validate mods/session-info   # valida el manifiesto y el módulo de hooks
claude plugin test mods/session-info       # ejecuta hooks/*.test.ts
npx tsc -p mods/session-info               # verificación de tipos
```
