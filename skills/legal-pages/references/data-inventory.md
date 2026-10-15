# Inventario de datos para textos legales

El inventario es la fuente de verdad de las tres páginas. Se arma leyendo código, no documentación ni lo que el usuario recuerda. Cada fila lleva evidencia (`archivo:línea`).

## 1. Clasifica el producto (arquetipos)

La mayoría de productos es una combinación de estos. Identifícalos primero: cada uno trae sus preguntas.

| Arquetipo | Señales en el código | Preguntas clave |
|---|---|---|
| **Local-first (escritorio, CLI, extensión)** | Rutas `LocalApplicationData`, `Application Support`, `app.getPath('userData')`, SQLite/JSON locales | ¿Qué se guarda y dónde? ¿Cifrado? ¿Algo sale del equipo además de las APIs del usuario? |
| **Cliente de APIs con cuenta del usuario** | OAuth (PKCE, `redirect_uri` a localhost), PAT/tokens, `Authorization: Bearer` | ¿La app actúa en nombre del usuario? ¿Qué escribe (no solo lee)? ¿Ve contraseñas? |
| **IA con clave propia (BYOK)** | `generativelanguage.googleapis.com`, `api.openai.com`, `api.anthropic.com`, prompts armados en código | ¿Qué texto exacto va en el prompt? ¿Incluye datos de **otras personas**? ¿Se dispara solo o a petición? |
| **Servidor de licencias / activación** | Endpoint `/license/validate`, claves, `machineId`, `fingerprint` | ¿Qué se envía en cada validación? ¿Qué se persiste? ¿Clave en claro o hash? ¿IP? |
| **Comprobación de actualizaciones** | Descarga de `version.json`/`appcast.xml`/`latest.yml` al arrancar | Solo datos técnicos de conexión, salvo que la URL lleve parámetros (versión, id de instalación) |
| **SaaS con cuentas** | Tabla/colección de usuarios, sesiones, correo transaccional | Todo el ciclo: alta, datos de perfil, logs, borrado, backups, subencargados |
| **Telemetría / errores** | Sentry, App Insights, PostHog, `crash.log` subido, `TelemetryClient` | ¿Se envía o se queda local? ¿Incluye IP, usuario, contenido del error (que puede llevar datos)? |
| **Pagos** | Stripe, Paddle, Lemon Squeezy, RevenueCat | ¿Quién es el comerciante (merchant of record)? ¿El responsable ve datos de tarjeta? (casi nunca) |
| **Sitio web / landing** | HTML, CSS, `<script>`, `<link>`, `fetch` | Cookies, storage, recursos de terceros, formularios, logs del hosting |

## 2. Dónde buscar (por señal)

### Lo que sale hacia servidores propios
- Todas las URLs a dominios del responsable (`miapp.com`, `api.miapp.com`): ¿qué cuerpo/parámetros llevan? Buscar el `HttpClient`/`fetch` y leer el payload completo.
- En el servidor: qué campos **persiste** (no solo cuáles recibe). Abrir el modelo/almacén y los `save`. Distinguir "lo recibe y lo descarta" de "lo guarda".
- IP: `x-forwarded-for`, `remoteAddress`, `RemoteIpAddress`. ¿Se guarda o solo se usa en memoria (rate limiting)? ¿Cuánto vive el mapa en memoria?
- Logs del servidor propio (`console.log(req...)`, middleware de acceso) y **logs de la plataforma** (App Service, Vercel, Cloudflare, Nginx): no están en el repo, pero existen; mencionarlos como del proveedor de hosting.

### Lo que se queda en el dispositivo
- Cada `Path.Combine(<carpeta de app>, "x.json")` o equivalente: un ítem de la lista. Anotar retención si el código poda (p. ej. "180 días").
- Credenciales: cómo se cifran (DPAPI, Keychain, `safeStorage`, `flutter_secure_storage`) o si están en claro (hallazgo: arreglar antes de redactar).
- Caches de imágenes de perfil, logs de errores, historiales.
- Cómo se borra todo: normalmente "desinstalar y borrar la carpeta X". Verificar que la ruta es la real en cada SO.

### Terceros
- Cada host externo del inventario: ¿con qué credencial? Si es la del usuario, el tercero trata los datos bajo **su relación con el usuario** (el responsable no es intermediario). Si es la del responsable (una API key embebida), el tercero es **encargado del responsable** y hay que declararlo como tal.
- IA: abrir la función que arma el prompt y listar cada campo que entra. Prestar atención a nombres, correos, notas libres escritas por el usuario y contenido de tickets de clientes.
- Avatares/fotos de perfil: ¿de dónde se descargan?

### Web
- `document.cookie`, `Set-Cookie`, `localStorage`, `sessionStorage`, `indexedDB`.
- Cada `<script src>`, `<link href>`, `<img src>`, `<iframe>`, `@import url()`, `url()` en CSS y `fetch` a otro dominio.
- Fuentes: ¿autoalojadas (`assets/fonts`) o de Google Fonts/Adobe?
- Formularios: ¿a dónde envían? (Formspree, Netlify Forms, backend propio, `mailto:`).

## 3. Trampas habituales

- **Maquetas y prototipos en el repo** (carpetas `design/`, `mockups/`, `prototype/`) con Google Fonts o CDNs: no se publican; excluirlos del inventario pero confirmar que no se despliegan.
- **Los propios textos legales y la landing** contienen las palabras que el script busca: excluirlos para no validar el texto consigo mismo.
- **Código muerto**: un SDK en el `csproj`/`package.json` que no se inicializa. Si no se usa, proponer quitarlo; si queda, no declararlo como activo pero sí verificar que no envía nada por defecto.
- **Datos de terceras personas**: herramientas para líderes, CRMs, gestores de tickets. El usuario de la app no es el único titular de datos. Hay que decirlo y orientar ("úsalo según las reglas de tu organización").
- **"No guardamos la IP"** cuando la plataforma de hosting sí la registra: decir "nosotros no la guardamos; el proveedor de hosting puede registrarla en sus registros técnicos".
- **Parámetros en la comprobación de actualizaciones** (`?v=1.2&id=<guid>`): convierte una descarga anónima en un identificador de instalación.
- **Mensajes de error** enviados a telemetría pueden incluir rutas con el nombre del usuario del SO o contenido de documentos.

## 4. Formato del inventario

```
Lo que recibe <responsable>
| Dato | Cuándo | Para qué | Se guarda | Retención | Evidencia |

En el dispositivo
| Archivo / carpeta | Contenido | Cifrado | Cómo se borra | Evidencia |

Terceros
| Servicio | Qué hace la app | Qué recibe | Credencial (usuario/responsable) | Evidencia |

Web
| Recurso / tecnología | Dominio | Cookie/storage | Evidencia |
```

Cuando el inventario esté completo, cada fila tiene que convertirse en una frase o fila de tabla de la política. Lo que no esté en el inventario no se afirma.
