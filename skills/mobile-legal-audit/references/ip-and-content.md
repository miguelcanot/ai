# Propiedad intelectual, marcas y contenido de terceros

## Imágenes y medios de terceros

El caso más común: el backend o un scraper siembra URLs a fotos o logos de un tercero (CDN de una liga, de un medio, de una marca) y la app las muestra. "Están públicas en internet" **no** es una licencia.

Cómo encontrarlo:
1. `scripts/external_media.py` lista dominios de imágenes en el código, seeds, scrapers y JSON.
2. Busca en los modelos campos tipo `photo`, `image`, `logo`, `avatar`, `headshot`, `thumbnail` y de dónde se llenan.
3. Mira la **base de datos real**, no solo el código: puede haber URLs viejas sembradas antes. Lo mismo con archivos generados (`output/`, `cache/`, exports JSON): aunque estén en `.gitignore`, si algún proceso los vuelve a cargar reintroducen las URLs. Regenerarlos o borrarlos.
4. Revisa las **capturas de marketing** (landing, ficha de tienda, redes): suelen mostrar esas mismas imágenes aunque la app ya no las use.

Mitigación en capas (todas, no una):
- El origen deja de sembrarlas (scraper/seed devuelve vacío).
- El backend deja de **servirlas** aunque sigan en la base (p. ej. `select: false` en el esquema, o quitarlas de la proyección). Ocultarlas solo en la app no basta: las versiones viejas publicadas las siguen pidiendo.
- La app tiene un fallback digno (iniciales, silueta propia, colores del equipo).
- Rehacer capturas de marketing y de la ficha de tienda.
- Documentar el motivo junto al campo, para que nadie lo "arregle" volviendo a activarlas.

## Marcas, ligas, equipos, personas

- **Nombres y datos factuales** (nombres de jugadores, estadísticas, resultados) suelen poder usarse para un juego de fantasy o una app informativa; **logos, escudos, uniformes, fotos oficiales y nombres comerciales usados como marca propia** no, sin licencia.
- Agrega en los términos (y en la ficha de tienda si aplica) un **descargo de no afiliación**: "no está afiliada, patrocinada ni respaldada por X; las marcas pertenecen a sus dueños".
- Identifica equipos con siglas y colores genéricos, no con escudos.
- Nombre e ícono de la app: no deben sugerir que es oficial.
- Derechos de imagen de personas reales: no usar su foto ni su imagen en publicidad sin autorización.

## Datos de terceros y scraping

- Revisa los **términos de uso** de cada fuente (APIs públicas no oficiales, sitios scrapeados): muchas prohíben uso comercial o redistribución.
- Prefiere APIs con licencia o datos factuales mínimos; no copies textos, fotos ni bases completas.
- Documenta la fuente de cada dato en el repo.

## Contenido generado por usuarios (UGC)

Si hay chat, nombres libres de equipo/liga, fotos de usuario o publicaciones:
- Términos con reglas de conducta y la facultad de editar/eliminar.
- **Mecanismo para reportar y bloquear** (Apple 1.2 y Google lo exigen para UGC), y alguien que lo atienda.
- Filtro mínimo para nombres ofensivos si los nombres son públicos.
- Licencia del usuario a la app para mostrar su contenido dentro del servicio.

## Código y assets propios

- Licencias de fuentes, íconos e imágenes generadas (verificar los términos de la herramienta de IA usada).
- Licencias de dependencias open source: GPL/AGPL en una app cerrada es un riesgo; la mayoría (MIT/BSD/Apache) solo pide atribución (una pantalla de licencias, en Flutter `showLicensePage`).
