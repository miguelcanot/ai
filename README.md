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
| [`session-info`](mods/session-info) | Comando `/session-info`: panel en vivo con modelo, rama de git, herramientas usadas, tokens, costo, límites del plan, archivos modificados y actividad de la sesión. |

## Instalación

### Skills

Copia la carpeta de la skill a `~/.claude/skills/`:

```bash
cp -r skills/mobile-legal-audit ~/.claude/skills/
```

`mobile-legal-audit` llama a sus scripts desde `~/.claude/skills/mobile-legal-audit/scripts/`, así que debe quedar en esa ruta. Los scripts requieren Python 3.

`perf-audit`, en cambio, llama a sus scripts con una ruta relativa al proyecto (`.claude/skills/perf-audit/scripts/`), así que se instala como skill del proyecto auditado:

```bash
cp -r skills/perf-audit <proyecto>/.claude/skills/
```

Sus scripts requieren Python 3 (`optimize_images.py` además necesita Pillow: `pip install Pillow`) y bash para `unused_deps.sh`.

### Mod `session-info`

1. Copia el mod a `~/.claude/mods/session-info`.
2. Agrega el marketplace local y instala el plugin desde Claude Code:

   ```
   /plugin marketplace add ~/.claude/mods/session-info
   /plugin install session-info@mcanot-mods
   ```

Al cambiar el código, sube `version` en `.claude-plugin/plugin.json` para que Claude Code actualice la copia instalada.

## Desarrollo del mod

Claude Code genera las declaraciones de tipos en `.claude-plugin/types/` al cargar el mod (no se versionan). Con ellas presentes:

```bash
claude plugin validate mods/session-info   # valida el manifiesto y el módulo de hooks
claude plugin test mods/session-info       # ejecuta hooks/*.test.ts
npx tsc -p mods/session-info               # verificación de tipos
```
