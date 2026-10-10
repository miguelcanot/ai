# Inventario de datos desde el código

Objetivo: una tabla que diga, para cada dato personal, de dónde sale, dónde vive, a quién va, cuánto dura y si se borra con la cuenta. Todo lo demás del informe depende de esta tabla.

## 1. Datos de cuenta y perfil

Busca el modelo/esquema de usuario y **todos** los caminos que lo crean o actualizan:

| Stack | Dónde mirar |
|---|---|
| Mongoose / Prisma / TypeORM / Sequelize | `models/User*`, `schema.prisma`, entidades |
| Firebase | colección `users` en Firestore, `auth` triggers en Functions, reglas |
| Supabase | tablas `auth.users` + `public.profiles`, triggers |
| Cliente | modelos de usuario (`freezed`, `data class`, `Codable`, interfaces TS) |

Para cada ruta de alta (`/register`, `/auth/google`, `/auth/apple`, callbacks OAuth, `signInWith*`): qué campos se guardan del proveedor (email, nombre, **foto**, locale) y si se usan después. Un campo guardado que la app nunca muestra ni usa (p. ej. `avatar` desde `payload.picture`) es un dato a **dejar de recoger** (minimización), no a declarar.

Busca también qué campos del perfil son **públicos para otros usuarios** (endpoints de perfil público, listas de miembros): la política debe decir qué ven los demás.

```bash
# Campos que llegan de proveedores OAuth
grep -rnE "payload\.(picture|email|name|locale)|getPayload|identityToken|photoURL|photoUrl" --include=*.{ts,js,dart,kt,swift} .
# Endpoints de perfil público
grep -rnE "users/:id|/profile/|publicProfile" --include=*.{ts,js} .
```

## 2. Datos técnicos y de uso

- **Logs de acceso / request logging** (`morgan`, middleware propio, nginx, Cloudflare): IP, user agent, ruta, userId. ¿Tienen TTL? ¿Se borran por usuario?
- **Logs de errores / crash** (Sentry, Crashlytics, Bugsnag): suelen llevar device id, userId, breadcrumbs con datos.
- **Analítica** (Firebase Analytics, Amplitude, Mixpanel, Segment, propia).
- **Identificadores**: advertising ID / IDFA, Android ID, FCM/APNs tokens, installation IDs.
- **Ubicación**: plugins de geolocalización, y "ubicación aproximada" vía IP si se guarda.

```bash
grep -rnE "remoteAddress|x-forwarded-for|cf-connecting-ip|req\.ip|userAgent|user-agent" --include=*.{ts,js} .
grep -rnE "expires|expireAfterSeconds|TTL" --include=*.{ts,js} . | grep -i -E "log|index"
```

## 3. Colecciones o tablas satélite

Todo lo que guarde email, nombre o id de usuario fuera del modelo principal:

```bash
# Modelos que referencian al usuario o guardan email
grep -rlnE "ref: ?['\"]User|userId|email" server/src/models src/models prisma 2>/dev/null
```

Ejemplos habituales: lista de espera/beta, newsletter, invitaciones, tickets de soporte, notificaciones persistidas, compras/transacciones, logs de auditoría. Cada uno es una fila del inventario y una pregunta: **¿qué pasa con esto al borrar la cuenta?**

## 4. Terceros (salida de datos)

Combina la salida de `scripts/sdk_inventory.py` con lo que el backend manda por HTTP:

```bash
# Llamadas salientes del backend
grep -rnE "fetch\(|axios\.|got\(|https://api\." --include=*.{ts,js} server/ src/ 2>/dev/null
```

Para cada tercero: qué recibe, para qué, y si al borrar la cuenta hay que borrar algo allá (RevenueCat/Stripe customer, perfil de CRM, contacto de email marketing) o revocar algo (tokens de Sign in with Apple).

No olvides la **infraestructura de red**: CDN, Cloudflare, túneles, balanceadores, hosting en otro país → transferencia internacional.

## 5. Borrado de cuenta: el cruce que más falla

Lee el handler de borrado completo y compáralo fila por fila contra el inventario. Patrones:

- **Anonimizar vs borrar**: anonimizar el registro de usuario para no romper datos compartidos (ligas, chats) es válido, pero tiene que quitar todo lo identificable, y la política tiene que explicar qué se conserva y por qué.
- **Sesiones**: el token existente debe quedar inválido de inmediato (p. ej. el middleware de auth rechaza usuarios con `deletedAt`).
- **Tokens de push**: vaciarlos.
- **Avatares/archivos** en storage: borrarlos.
- **Terceros**: borrar customer de pagos (no cancela la suscripción: avisar al usuario), revocar Apple.
- **Logs**: borrar los asociados al userId o justificar la retención en la política.

## 6. Salida esperada

| Dato | Origen | Almacenamiento | Compartido con | Retención | Borrado con la cuenta |
|---|---|---|---|---|---|
| Email | Google / Apple / registro | `users.email` | — | mientras exista la cuenta | sí (anonimizado) |
| IP + user agent | middleware `accessLog.ts` | `accesslogs` (TTL 30 d) | Cloudflare (tránsito) | 30 días | **no** → hallazgo |
| … | | | | | |

Las celdas "no" o "?" de la última columna, y cualquier fila que la política no mencione, son hallazgos.
