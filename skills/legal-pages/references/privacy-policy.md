# Política de privacidad

Objetivo: que una persona entienda en dos minutos qué pasa con sus datos, y que cada afirmación se pueda comprobar contra el código.

## Roles: quién es responsable de qué

Decidirlo antes de escribir, porque cambia todo el texto:

| Situación | Rol del dueño del software | Cómo decirlo |
|---|---|---|
| Datos que llegan a su servidor (licencias, cuentas, telemetría, formularios) | **Responsable** (controller) | "X es responsable de los datos que recibe su servidor" |
| Datos que la app guarda solo en el equipo del usuario | **Ninguno**: no tiene acceso | "No pasan por X. Sobre ellos decides tú o la organización que te dio acceso" |
| Datos que la app envía a un tercero **con la cuenta/clave del usuario** (GitHub, Jira, Gemini con clave propia) | Ninguno sobre ese envío: es una relación usuario ↔ tercero | "X se conecta directamente, con tus credenciales… cada servicio trata los datos según sus condiciones" |
| SaaS B2B que procesa datos de los clientes del cliente | **Encargado** (processor) del cliente | Política para usuarios + Acuerdo de tratamiento de datos (DPA) aparte; mencionar subencargados |
| Proveedor de hosting/CDN del responsable | Encargado del responsable | Nombrarlo (Azure, Vercel, Cloudflare) en "con quién compartimos" |

Separar estas capas es lo que hace creíble una política de una app local-first: no prometas proteger lo que nunca tienes, y no te desentiendas de lo que sí recibes.

## Estructura

1. **Introducción** (1 párrafo): qué producto, quién lo hace, a qué aplica (app + sitio), ley de referencia y "otros derechos si te aplican".
2. **En resumen** (callout destacado): qué sale del equipo, a quién; qué no se hace.
3. **Responsable y contacto**: nombre, sitio, correo que funcione. Aclarar qué datos NO controla (los locales y los de terceros con cuenta del usuario).
4. **Lo que recibe el responsable**: tabla dato / cuándo / para qué. Incluir lo técnico (IP, versión, SO) y decir si se guarda o no.
5. **Lo que se queda en tu equipo** (si aplica): rutas reales por SO, lista de contenido, cómo se cifran las credenciales, cómo se borra.
6. **Servicios con los que se conecta**: tabla servicio / qué hace la app / qué recibe. Enlazar sus políticas o términos cuando sea relevante.
7. **Inteligencia artificial** (si aplica): ver sección propia abajo.
8. **Datos de otras personas** (si la app muestra o guarda datos de compañeros, clientes, contactos).
9. **Sitio web**: una línea con enlace a la política de cookies.
10. **Bases legales** (si el mercado es UE o similar): ejecución del contrato/licencia, interés legítimo (seguridad, rate limiting, soporte), consentimiento (IA opcional, analítica), obligación legal. En productos pequeños puede ir integrado en la columna "para qué".
11. **Retención**: por tipo de dato, con plazo concreto.
12. **Transferencias internacionales** (si el servidor o los terceros están en otro país): nombrar el país/región del hosting y el mecanismo si aplica (cláusulas tipo, Data Privacy Framework). Si no se sabe la región del hosting, preguntar.
13. **Seguridad**: lo que realmente se hace (HTTPS, hash de claves, cifrado del SO, almacén fuera de carpetas públicas). Nada de "seguridad de nivel bancario".
14. **Tus derechos**: acceso, rectificación, supresión, oposición (y portabilidad en RGPD); cómo ejercerlos (correo), plazo (30 días es un buen estándar; RGPD exige 1 mes), autoridad ante la que reclamar. Para datos locales: "los controlas tú directamente".
15. **Menores**.
16. **Cambios** a la política: fecha y aviso en la app si el cambio es importante.

## Inteligencia artificial: cómo escribirla

Es la sección que más se hace mal. Debe responder:

1. **¿Es opcional y cuándo se ejecuta?** Ideal: solo al pulsar un botón, nombrado como en la UI. Si se ejecuta sola (al abrir, en segundo plano), decirlo claramente.
2. **¿Con qué clave?** Del usuario (BYOK) o del responsable. Con la del responsable, el proveedor es encargado del responsable y hay que revisar su DPA.
3. **¿Qué se envía exactamente?** Una viñeta por función, con los campos que entran en el prompt (leer el código que lo arma).
4. **¿Qué hace el proveedor con eso?** Enlazar sus condiciones y resumir lo relevante **verificando la versión vigente**:
   - Gemini API: en servicios no pagados Google puede usar el contenido para mejorar productos y puede revisarlo una persona; en pagados, no se usa para mejorar productos.
   - OpenAI API y Anthropic API: por defecto no entrenan con los datos enviados por API; conservan registros un tiempo limitado para abuso y seguridad.
   - Azure OpenAI / Vertex AI: dentro de la nube del cliente, sin entrenamiento.
   Si no puedes verificar las condiciones actuales, di "según el plan de tu clave, el proveedor puede conservar…" y enlaza.
5. **Recomendación práctica** cuando hay datos de terceras personas: confirmar que la organización lo permite, no escribir información sensible en notas libres, preferir una clave de plan de pago.
6. **Revisión humana del resultado**: el contenido generado puede ser inexacto (también va en términos).

## Patrones de frase que funcionan

- Resumen local-first: "X guarda tus datos en tu propio equipo y habla directamente con A, B y, si lo activas, C. A [responsable] solo le llega lo necesario para validar tu licencia y avisarte de actualizaciones. No vendemos datos, no hay publicidad ni analítica."
- Clave guardada como hash: "Guardamos solo su huella cifrada (hash SHA-256), nunca la clave en claro."
- IP en memoria: "Se usa solo en memoria durante un minuto para limitar intentos y no se guarda. El proveedor de hosting, <X>, puede registrarla en sus registros técnicos."
- Actualizaciones: "Al abrirse, X descarga `<url>` para saber si hay una versión nueva. Esa consulta no envía ningún dato tuyo, más allá de los técnicos de cualquier conexión." (Solo si la URL no lleva parámetros identificadores.)
- Borrado local: "Nada de esto se envía a [responsable]. Desinstalar X y borrar esa carpeta lo elimina por completo."
- Credenciales: "Se guardan cifradas con el sistema operativo (DPAPI en Windows, Llavero en macOS) y solo tu usuario puede descifrarlas."
- OAuth: "Inicias sesión en la página de <servicio>; X recibe un permiso, nunca tu contraseña."

## Errores que evitar

- Listar datos "que podríamos recopilar". Solo lo que se recoge.
- Bases legales sin finalidad concreta, o "consentimiento" para todo (si el servicio no funciona sin el dato, la base es el contrato).
- Retenciones vagas ("el tiempo necesario") cuando se puede dar un plazo.
- Prometer notificación de cambios por correo si no se tiene el correo de los usuarios.
- Dos correos de contacto distintos entre páginas, app y tiendas.
- Olvidar la fecha o dejar la de la plantilla.
