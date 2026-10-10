---
name: mobile-legal-audit
description: Auditoría de cumplimiento legal y de políticas de tienda para apps móviles (Flutter, React Native, Android nativo, iOS nativo) y su backend. Determina qué cumple y qué incumple contrastando el CÓDIGO real contra leyes de protección de datos (GDPR, CCPA y estados de EE. UU., LGPD, leyes latinoamericanas como la Ley 172-13 de RD), protección al consumidor, Google Play, App Store, AdMob/UMP/ATT, suscripciones, juegos de azar, propiedad intelectual (fotos, logos, marcas, datos de terceros) y borrado de cuenta. Úsala cuando el usuario pida "verificar el cumplimiento legal", "qué leyes aplican", "estamos listos para publicar en Play/App Store", "revisar la política de privacidad", "Data Safety", "etiqueta de privacidad", "términos y condiciones", "derechos de autor de las imágenes", "consentimiento de anuncios", o antes de un lanzamiento, una nueva funcionalidad de monetización, o un rechazo de tienda.
---

# Auditoría legal de una app móvil

El producto de esta skill es un **informe de cumplimiento verificado contra el código**: qué norma aplica, qué hace realmente la app, dónde está la evidencia (`archivo:línea`), qué riesgo hay y cómo mitigarlo. No es asesoría legal y el informe lo dice; pero sí es la parte técnica que un abogado no puede hacer: saber qué datos se recogen de verdad, con quién se comparten y si lo que dicen los textos legales coincide con el código.

## Principio central: el código manda, los textos se contrastan

El incumplimiento más común no es "falta una política" sino **una política que contradice al código**: dice "solo iniciamos sesión con Google" y hay registro con correo; dice "no compartimos datos con redes de publicidad" y hay AdMob; dice "no tratamos pagos" y hay RevenueCat; promete borrar todo al eliminar la cuenta y quedan logs con la IP. Las tiendas comparan la política con el formulario de datos, y una autoridad de protección de datos la compara con la realidad.

Por eso el orden es siempre:

1. **Inventario desde el código** (qué se recoge, de dónde, a quién va). Nunca desde la documentación del proyecto ni desde lo que el usuario cree que hace la app.
2. **Determinar el marco aplicable** (mercados, tiendas, modelo de negocio).
3. **Contrastar** inventario ↔ textos legales ↔ requisitos. Cada discrepancia es un hallazgo.
4. **Informe priorizado.** Si el usuario solo pidió análisis, parar ahí.
5. **Aplicar** (solo si lo pide) y **verificar** después.

## Fase 1 — Inventario

Corre los scripts antes de leer código a mano; los números dicen dónde mirar:

```bash
# SDKs y permisos → qué datos recoge cada uno y qué obligaciones dispara
python ~/.claude/skills/mobile-legal-audit/scripts/sdk_inventory.py <raíz-del-proyecto>

# Imágenes y medios cargados desde dominios de terceros (fotos, logos, CDNs)
python ~/.claude/skills/mobile-legal-audit/scripts/external_media.py <raíz-del-proyecto>
```

Después completa a mano lo que los scripts no ven. La guía detallada de qué buscar y cómo está en **`references/data-inventory.md`** — léela siempre. En resumen, hay que llegar a una tabla con:

| Dato | Origen (código) | Dónde se guarda | Con quién se comparte | Retención | ¿Se borra al eliminar la cuenta? |

Cosas que casi siempre faltan en el inventario y hay que buscar explícitamente:
- **Logs del servidor** con IP / user agent / userId (middleware de acceso, logs de errores).
- **Colecciones/tablas fuera del modelo de usuario** que guardan el email o el id: listas de espera/beta, newsletters, tickets, analíticas propias.
- **Clientes en terceros**: RevenueCat/Stripe customer, perfil en el proveedor de push, en el CRM.
- **Datos que se recogen y no se usan** (p. ej. guardar la foto de perfil de Google cuando la app nunca la muestra). Minimización de datos: lo correcto es dejar de recogerlos, no declararlos.
- **Proveedores de red** que ven tráfico (Cloudflare, CDN, túneles) y transferencias internacionales.
- **Proveedores de login declarados pero muertos** (botón "Facebook" sin implementar, ruta rota). Si no se usa, se elimina; si queda, la política tiene que mencionarlo.

## Fase 2 — Marco aplicable

Pregunta (o deduce del proyecto) solo lo que cambia el resultado:
- **Mercados de distribución** (país de la empresa, países de la tienda). Define qué leyes de datos aplican.
- **Tiendas**: Google Play, App Store, ambas, o una ahora y otra después.
- **Monetización**: anuncios, suscripciones, compras únicas, premios, nada.
- **Público**: ¿puede haber menores? ¿hay contenido generado por usuarios (chat, fotos, nombres libres)?
- **Contenido de terceros**: ¿usa datos, nombres, imágenes o marcas de ligas, artistas, marcas, APIs?

Con eso, lee las referencias que correspondan:

| Tema | Referencia |
|---|---|
| Leyes de datos por región (GDPR, EE. UU., LGPD, LatAm/RD, menores) | `references/privacy-laws.md` |
| Google Play y App Store (Data Safety, privacy labels, borrado de cuenta, login, manifiesto de privacidad) | `references/store-policies.md` |
| Anuncios, consentimiento (UMP/ATT), suscripciones, compras, juegos de azar | `references/monetization.md` |
| Propiedad intelectual, marcas, datos de terceros, UGC, capturas de marketing | `references/ip-and-content.md` |
| Textos legales: qué debe tener cada uno y dónde enlazarlos en la app | `references/legal-texts.md` |

## Fase 3 — Contraste y criterios de severidad

Cada hallazgo se clasifica con estos criterios, no por intuición:

| Severidad | Criterio |
|---|---|
| **Bloqueante** | La tienda rechaza o retira la app (falta borrado de cuenta, falta Sign in with Apple cuando aplica, paywall sin divulgaciones, Data Safety inconsistente, permisos sin justificar), o hay un incumplimiento legal directo con exposición alta (datos de menores, apuestas sin licencia, contenido con copyright de un titular activo). |
| **Alto** | Incumplimiento legal claro pero sin bloqueo inmediato de tienda: política que contradice al código, borrado incompleto, falta consentimiento donde la ley lo exige, contacto de privacidad inexistente. |
| **Medio** | Riesgo real pero acotado o condicional: falta verificación de edad cuando los términos la exigen, aceptación de términos pasiva, falta registro de qué versión aceptó cada usuario, avisos que faltan en un flujo secundario. |
| **Bajo** | Buenas prácticas y robustez: textos inconsistentes entre páginas, documentación interna desactualizada, código muerto relacionado. |

Reglas que evitan los errores típicos:
- **Evidencia o no es hallazgo.** Cada uno lleva `archivo:línea` o el comando que lo demuestra. "Puede que no se borren los logs" no sirve; "`AccessLog` guarda `userId` + IP (`models/AccessLog.ts:10`) y `DELETE /account` no lo toca (`routes/auth.ts:344`)" sí.
- **Lo que está bien también va en el informe**, en una sección corta. El usuario necesita saber qué no tiene que tocar.
- **Busca la condición que rompe un cumplimiento actual.** Ej.: "sin dinero real ni premios queda fuera de la ley de juegos de azar — se rompe si se agregan ligas con cuota de entrada". Eso evita regresiones futuras.
- **No inventes requisitos.** Si no estás seguro de que una norma exija algo, dilo como "verificar" y no como incumplimiento.

## Fase 4 — Informe

Estructura (en el idioma del usuario):

1. Una línea: *esto no es asesoría legal; los textos finales debe revisarlos un abogado del país.*
2. **Prioridad alta / bloqueantes** — por hallazgo: qué norma, qué hace el código (evidencia), riesgo, mitigación concreta, esfuerzo.
3. **Prioridad media** y **baja**, más breves.
4. **Lo que ya está bien.**
5. **Pendiente fuera del repo** (consolas de tienda, AdMob, dashboards, buzones de correo, revisión legal).
6. Una pregunta de cierre ofreciendo aplicar los de mayor retorno.

Si el trabajo es largo o se va a repetir, propone guardar el resultado en el repo (`docs/NN-legal-compliance.md`) con: marco aplicable, tabla "riesgo → solución → dónde", pendientes fuera del repo y la sección **"Al cambiar los textos legales"** (qué más hay que actualizar a la vez).

## Fase 5 — Aplicar (solo si lo piden)

Orden recomendado, de mayor retorno a menor:
1. Corregir la **política de privacidad** para que coincida con el inventario (y los términos si faltan).
2. **Borrado de cuenta completo**: todo lo del inventario marcado "no se borra" — colecciones auxiliares, logs, clientes en terceros, revocación de tokens de login (Apple lo exige).
3. **Enlaces legales en la app**: login/registro, ajustes, paywall. Casilla de aceptación (con mayoría de edad si aplica) en el registro, y guardar `termsAcceptedAt` + versión.
4. **Paywall**: precio con período, renovación automática, cómo cancelar, que borrar la cuenta no cancela, enlaces legales.
5. **Consentimiento de anuncios** (UMP antes de inicializar el SDK de anuncios; ATT después en iOS; opción para cambiar la elección).
6. **Contenido de terceros**: dejar de servir/sembrar imágenes sin licencia en el backend (no solo ocultarlas en la app: builds viejas siguen pidiéndolas), y revisar capturas de marketing y de la ficha de tienda.
7. **Plataforma futura** (p. ej. iOS más adelante): dejar el código y la configuración listos y un checklist de lo que depende de consolas.

Detalles de implementación en las referencias de cada tema.

## Verificación

Después de aplicar:
- Recorre otra vez la tabla de inventario contra el texto nuevo de la política: cada fila tiene que estar, y nada de la política puede contradecirla.
- Prueba el borrado de cuenta contra la base real (o una copia): busca el id y el email del usuario borrado en **todas** las colecciones/tablas.
- Prueba los endpoints que cambiaron (p. ej. un registro sin la casilla debe fallar con un mensaje claro).
- Para consentimiento de anuncios, usa la geografía de depuración del SDK (ver `references/monetization.md`).
- Si cambiaste textos legales, confirma que las URLs públicas sirven la versión nueva (cuidado con cachés de CDN).
- Reporta lo que no pudiste verificar (dispositivo real, consola de tienda) como pendiente, no como hecho.
