---
name: legal-pages
description: Redacta y publica las páginas legales de un producto de software (política de privacidad, términos de uso o licencia, política de cookies) a partir de lo que el CÓDIGO hace de verdad, para apps de escritorio, web/SaaS, extensiones, CLIs y landings, y las enlaza desde el sitio y la app. Cubre apps local-first, servidores de licencias, integraciones con cuentas del usuario (OAuth, tokens), IA con clave propia (Gemini, OpenAI, Anthropic), telemetría, pagos y sitios sin cookies. Úsala cuando el usuario pida "crea los términos", "política de privacidad", "política de cookies", "páginas legales", "aviso legal", "EULA", "términos de licencia", "necesito privacidad para publicar", o al lanzar o cambiar qué datos envía o guarda una app. Para auditorías de tiendas móviles (Data Safety, App Store) usar mobile-legal-audit; para instalar Google Analytics con banner, web-analytics-consent.
---

# Páginas legales desde el código

El producto de esta skill son **tres páginas publicables** (privacidad, términos, cookies), enlazadas desde el sitio y desde la app, que **dicen exactamente lo que el software hace**, más una lista corta de decisiones que solo el dueño del producto puede confirmar. No es asesoría legal y la entrega lo dice; sí es la parte que un abogado no puede hacer solo: saber qué datos salen, a dónde, y qué se queda en el equipo.

## Principio central: el texto describe el código, no una plantilla

Una política genérica copiada ("podemos recopilar tu nombre, correo, ubicación…") es peor que ninguna: promete o confiesa cosas que no pasan y omite las que sí. Los errores reales están en los detalles:

- La app guarda todo localmente, pero el texto dice "almacenamos tus datos en nuestros servidores".
- Hay un servidor de licencias que registra versión, plataforma y último uso, y nadie lo menciona.
- Un botón de IA envía **datos de terceras personas** (compañeros, clientes) a un proveedor de IA con la clave del usuario.
- La web "no usa cookies" pero carga Google Fonts o un CDN que reciben la IP del visitante.
- La política promete borrar algo que el código no borra.

Por eso el orden es siempre: **inventario → decisiones → redacción → integración → verificación**. Si el usuario solo pidió análisis, entregar el inventario y las decisiones y parar.

## Fase 1: Inventario (desde el código)

Corre el script primero; dice dónde mirar:

```bash
python "${CLAUDE_SKILL_DIR}/scripts/inventory.py" <raíz> \
  --exclude <carpetas de maquetas/diseño> --exclude <textos legales ya escritos>
```

Excluir maquetas y textos legales existentes evita que el inventario se alimente de lo que ya se afirma. Después **lee el código** de cada señal: el script encuentra, no decide. La guía de qué buscar por tipo de producto y cómo llenar la tabla está en **`references/data-inventory.md`**: léela siempre.

Hay que llegar a estas tres tablas (en tu cabeza o en la respuesta):

1. **Lo que recibe el responsable** (servidor propio, licencias, telemetría, formularios): dato · cuándo · para qué · retención · evidencia `archivo:línea`.
2. **Lo que se queda en el dispositivo**: archivo/carpeta · contenido · cifrado sí/no · cómo se borra.
3. **Terceros con los que habla el software**: servicio · qué hace la app · qué recibe el tercero · con qué cuenta/clave (la del usuario o la del responsable).

Y para la web: cookies, storage del navegador y **todo recurso cargado desde otro dominio** (fuentes, CDNs, embeds, analítica).

Si el inventario revela un problema (datos recogidos sin uso, una IP guardada sin motivo, Google Fonts remotas en un sitio que dice no usar terceros), **dilo antes de redactar** y propone arreglar el código; es mejor que declararlo.

## Fase 2: Decisiones que no salen del código

Pregunta solo lo que cambia el texto; para el resto usa un valor razonable y márcalo como "a confirmar" en la entrega:

| Decisión | Por qué importa | Valor por defecto razonable |
|---|---|---|
| Responsable legal (persona/empresa, país) y **correo de contacto** que exista | Lo exigen todas las leyes de datos | Buscar en otras páginas del mismo dueño (`grep -ri "privacidad\|privacy" ` en proyectos vecinos) y reutilizar el mismo correo |
| Mercados / ley aplicable | Define derechos y foro | País del responsable + "otros derechos si te aplican" (RGPD, etc.) |
| Modelo comercial: gratis, licencia, suscripción, B2B | Cambia los términos por completo | Lo que muestre el código (clave de licencia, paywall, Stripe) |
| Retención de lo que guarda el servidor | Obligatorio informarla | Vigencia + 12 meses para licencias/cuentas; 30 días para logs técnicos |
| Edad mínima | Menores = régimen especial | 18+ en herramientas profesionales |
| Límite de responsabilidad | Términos | Lo pagado en los últimos 12 meses, sin limitar derechos irrenunciables del consumidor |

Si hay **páginas legales del mismo dueño en otros proyectos**, léelas: reutiliza correo, ley aplicable, tono y estructura para que todo el portafolio sea coherente.

## Fase 3: Redacción

Lee la referencia de cada página antes de escribirla:

| Página | Referencia |
|---|---|
| Política de privacidad (estructura, roles, bases legales, IA, datos de terceras personas, patrones por arquetipo) | `references/privacy-policy.md` |
| Términos de uso / licencia (cláusulas por modelo comercial, IA, integraciones, consumidor) | `references/terms.md` |
| Política de cookies (qué cuenta como cookie, cuándo hace falta banner, página "sin cookies") | `references/cookies.md` |
| Leyes por región y su núcleo común | `references/privacy-laws.md` |

Reglas de redacción, para las tres:

- **Idioma del mercado, lenguaje llano, segunda persona** ("tus datos", "puedes pedir"). Frases cortas. Sin "en ningún caso", "irrevocablemente", latinajos ni mayúsculas gritadas.
- **Abre con un "En resumen"** de 2-3 frases: qué sale del equipo, a quién, y qué no se hace (vender, publicidad, analítica).
- **Tablas para inventarios** (dato / cuándo / para qué), prosa para explicar decisiones.
- **Nombra los archivos y servicios reales**: rutas de carpetas, endpoints públicos, nombres de proveedores, nombres de botones tal como aparecen en la UI ("Resumir con IA"), para que el usuario pueda comprobarlo.
- **Di lo que no se hace** solo si es verdad y verificable ("no hay analítica" después de comprobar que no hay ningún SDK).
- **Nada de promesas que el código no cumple.** Si el texto dice "se borra a los 30 días", tiene que existir el proceso que lo borra, o decir "conservamos hasta… y luego los eliminamos" solo si el dueño se compromete a hacerlo.
- **"Última actualización: <fecha de hoy>"** con fecha absoluta en cada página.
- Mismo correo, mismo nombre del responsable y mismo pie en las tres páginas.

## Fase 4: Integración

1. **Formato**: si el sitio ya tiene hoja de estilos y layout, crear las páginas con ese layout (cabecera con "Volver", pie común). Si no, partir de `assets/legal-page.template.html` (autocontenido, tema claro/oscuro, tablas responsivas) y reemplazar los `{{...}}`.
2. **Nombres de archivo** en el idioma del sitio y estables (`privacidad.html`, `terminos.html`, `cookies.html` o `privacy.html`…): las URLs quedan enlazadas desde apps ya instaladas y no deben cambiar.
3. **Enlaces en el sitio**: pie de todas las páginas con las tres, `aria-current="page"` en la actual; junto a los botones de descarga o registro, "Al descargar y usar X aceptas los términos y la política de privacidad".
4. **Enlaces en la app**: en Acerca de / Ajustes, con **URLs de producción** abiertas en el navegador externo. Si hay registro o activación, el aviso de aceptación va ahí. Si la app tiene changelog o "novedades", agregar la línea.
5. **Nota de mantenimiento** en el README del sitio: "si la app o el servidor cambian qué datos envían o guardan, actualizar `privacidad.html` y su fecha".
6. No commitear salvo que lo pidan.

## Fase 5: Verificación

- Recorre las tres tablas del inventario contra la política: **cada fila aparece, y nada de la política las contradice**. Recorre también los terceros de la web contra la política de cookies.
- `grep` de cada afirmación verificable: "no usamos cookies" → no hay `document.cookie`/`Set-Cookie`/`localStorage`; "todo se sirve desde nuestro dominio" → no hay `<link|script src="https://otro">`.
- Abre las páginas en un navegador (headless sirve) en ancho de escritorio y móvil, y en tema claro y oscuro si el sitio los tiene; revisa que las tablas no rompan el ancho.
- Compila la app si tocaste su UI.
- Comprueba que los enlaces relativos entre páginas funcionan y que las URLs absolutas de la app coinciden con donde se van a publicar.

## Entrega

En el idioma del usuario, breve:

1. Qué páginas se crearon y dónde se enlazan.
2. **Lo que encontró el análisis**: 3-5 puntos con lo que sale del equipo y a quién, empezando por lo más delicado (p. ej. "el resumen con IA envía nombres de compañeros a Google").
3. **A confirmar**: cada valor que no salió del código (correo, retención, ley, límite de responsabilidad, edad, condiciones comerciales).
4. Una línea: *redactado a partir del código; antes de publicarlo conviene que lo revise un abogado del país*.
5. Lo pendiente fuera del repo: publicar los archivos, que el correo de contacto exista, versionar si los enlaces de la app apuntan a una URL aún no publicada.

## Cuándo usar otra skill

- App móvil que va a Google Play / App Store, anuncios, suscripciones de tienda, borrado de cuenta: **mobile-legal-audit** (incluye Data Safety, privacy labels y su propia guía de textos).
- El usuario quiere medir visitas con Google Analytics y necesita banner de consentimiento: **web-analytics-consent**, y después actualizar la política de cookies con `references/cookies.md`.
