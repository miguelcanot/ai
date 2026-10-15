# Términos de uso / licencia

Los términos regulan la relación comercial y de uso. Deben ser coherentes con el modelo real: una app con clave de licencia no puede tener términos de suscripción de tienda, y un SaaS no puede hablar de "desinstalar".

## Identifica el modelo

| Modelo | Señales | Cláusulas que lo distinguen |
|---|---|---|
| **Licencia con clave** (escritorio) | Activación, `license/validate`, vencimiento, revocación | Concesión de licencia, uso por persona/organización, no compartir la clave, validación y gracia sin conexión, revocación, condiciones comerciales |
| **Suscripción SaaS** | Stripe/Paddle, planes, cuenta | Precio y período antes de pagar, renovación automática, cancelación, reembolsos, cambios de precio con aviso |
| **Gratuito / open source** | Sin pagos; LICENSE en el repo | La licencia de código (MIT, GPL…) rige el código; los términos solo el servicio/sitio. No contradecirla |
| **B2B / interno** | Uso por empresa, SSO, despliegue | Quien acepta lo hace en nombre de la empresa; DPA; usuarios autorizados |
| **Tienda móvil** | Play/App Store | Usar `mobile-legal-audit` (reglas de tienda, EULA de Apple) |

## Estructura recomendada

1. **Aceptación**: a qué aplica, que usar implica aceptar, enlace a la política de privacidad; aceptación en nombre de una empresa.
2. **Qué es el producto**: una frase funcional. **Descargo de no afiliación** con cada marca integrada ("no está afiliada, patrocinada ni respaldada por Microsoft, Atlassian ni Google; las marcas son de sus dueños").
3. **Licencia / cuenta**: concesión (personal, no exclusiva, intransferible, revocable), alcance de la clave, validación y **gracia sin conexión con el plazo real del código**, condiciones comerciales ("las acordadas al emitir la licencia" si no hay precio público), causas de revocación y aviso previo.
4. **Servicios de terceros que necesitas**: el usuario aporta sus cuentas; rigen los términos de cada proveedor; el usuario responde de tener permiso y de lo que hace desde la app (sobre todo si la app **escribe**: publica horas, crea tareas, envía comentarios).
5. **Revisa antes de publicar**: la app calcula/propone/redacta; puede equivocarse; el contenido generado por IA puede ser inexacto; lo publicado es responsabilidad del usuario. Mencionar la vista previa si existe.
6. **Uso aceptable**: no descompilar ni evadir la licencia "salvo donde la ley lo permita expresamente" (la Directiva europea de programas permite descompilar para interoperabilidad: no prohibir lo irrenunciable), no usarla para fraude (horas no trabajadas, acceso indebido), no atacar el servidor.
7. **Datos de otras personas**: si hay funciones de equipo, usarlas solo para coordinar el trabajo y según la organización; responsabilidad al enviarlos a IA.
8. **Actualizaciones**: aviso de versiones; posibilidad de exigir actualizar cuando una versión deja de ser compatible (si el código tiene versión mínima).
9. **Propiedad intelectual**: el software es del autor; **los datos del usuario son del usuario o su organización**.
10. **Garantía y responsabilidad**: "tal cual"; sin garantía de funcionamiento continuo, en especial ante cambios de terceros; exclusión de daños indirectos y pérdida de datos "en la medida que lo permita la ley"; tope (lo pagado en 12 meses); **frase de salvaguarda** de los derechos del consumidor irrenunciables, citando la ley local.
11. **Terminación**: cómo deja el usuario de usarla (desinstalar + borrar carpeta, o borrar cuenta); cuándo termina la licencia; aviso razonable si se discontinúa el producto.
12. **Ley aplicable y foro**: país del responsable; intento de solución amistosa por correo primero; "salvo que la ley de tu país te dé derecho a otro fuero" (los consumidores de la UE pueden demandar en su país).
13. **Cambios y contacto**: fecha, aviso en novedades si es importante, correo.

## Cláusulas por tema

### IA generativa
- El usuario revisa el resultado antes de usarlo; puede ser inexacto o incompleto.
- La IA es opcional y usa la clave del usuario (si es BYOK): sus términos los pone el proveedor.
- No usar la función para generar contenido ilícito (solo si la función es abierta; en una herramienta acotada no hace falta).

### Integraciones que escriben en sistemas de terceros
- Responsabilidad del usuario sobre lo que publica; la app muestra vista previa.
- No garantía ante cambios de API del tercero; posibilidad de exigir actualización.

### Licencias y activación
- Gracia sin conexión = el número del código (la constante de días de gracia, p. ej. `OFFLINE_GRACE_DAYS`). Si cambia el código, cambia el texto.
- Revocación: causas concretas (compartir, incumplir, impago), con aviso salvo abuso evidente.
- No prometas reembolsos si no hay una política; si hay ley del consumidor aplicable, remite a ella.

## Consumidor vs. profesional

- Si el producto se vende a **consumidores**, las limitaciones de responsabilidad y la elección de foro tienen límites legales; siempre incluir la salvaguarda.
- Si es **solo B2B**, se puede ser más estricto, pero conviene igualmente la salvaguarda para no invalidar la cláusula entera.

Leyes de consumo de referencia: República Dominicana Ley 358-05; UE Directiva 2011/83 y 2019/770 (contenidos y servicios digitales); México LFPC; Colombia Ley 1480 de 2011. Si el mercado no está aquí, marcar "verificar con abogado local".

## Errores que evitar

- Copiar términos de un SaaS para una app de escritorio (o al revés).
- Cláusulas de tienda (renovación 24 h antes, Apple como tercero beneficiario) en un producto que no está en tiendas.
- Prohibir absolutamente la ingeniería inversa o eximirse de toda responsabilidad "en cualquier caso": en muchos países es nulo y puede arrastrar la cláusula entera.
- Plazos que no coinciden con el código (gracia offline, retención, vencimiento).
- Olvidar el descargo de marcas cuando el nombre de terceros aparece en la landing.
