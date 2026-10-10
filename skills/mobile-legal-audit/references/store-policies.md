# Políticas de Google Play y App Store

Los requisitos de tienda son los que **bloquean el lanzamiento**, así que se verifican uno por uno contra el código y la configuración.

## Google Play

| Requisito | Cómo verificar en el código | Mitigación típica |
|---|---|---|
| **Política de privacidad** pública, accesible sin login, coherente con la app | URL en Play Console + enlace dentro de la app; contrastar con el inventario | Página en el sitio/landing; enlace en login y ajustes |
| **Data Safety** | Inventario completo (incluye SDKs: anuncios, analítica, crash, pagos) | Llenar el formulario con la tabla del inventario; "compartido" = enviado a terceros (excepto proveedores de servicio que actúan en nombre de la app según las reglas de Google) |
| **Borrado de cuenta** (apps con cuentas) | Opción **dentro de la app** + **URL web** que funcione sin la app instalada | Endpoint de borrado + página web con instrucciones o formulario; listar qué se borra y qué se conserva |
| **Anuncios** | `google_mobile_ads` / `play-services-ads` en dependencias | Declarar "contiene anuncios"; permiso `AD_ID` (lo agrega el SDK); consentimiento UMP donde aplica |
| **Permisos** | `AndroidManifest.xml` + manifiesto fusionado de release | Quitar los que no se usan; justificar los sensibles (ubicación en segundo plano, SMS, contactos, accesibilidad) |
| **Pagos de contenido digital** | Compras dentro de la app | Usar Google Play Billing (directo o vía RevenueCat); no enlazar a pagos externos salvo programas permitidos |
| **Suscripciones** | Paywall | Precio, período, renovación automática, cómo cancelar, enlaces legales visibles antes de comprar |
| **Clasificación de contenido** (IARC) | Funcionalidades: chat, UGC, compras, apuestas simuladas | Responder el cuestionario de forma coherente con los términos (p. ej. 18+) |
| **Apps de deportes / fantasy / sorteos** | ¿Hay dinero real o premios? | Sin dinero real: declararlo. Con dinero real: política de juegos de azar con licencia por país |
| **Contacto del desarrollador** | Email público | Buzón real; el mismo que aparece en la política |

## App Store

| Requisito | Guideline | Cómo verificar | Mitigación |
|---|---|---|---|
| **Sign in with Apple** | 4.8 | Si hay login con Google/Facebook/otros terceros en iOS | Ofrecer SIWA en iOS (botón solo en iOS); en el server verificar el `identityToken` contra las llaves públicas de Apple (`aud` = bundle id) — **no** con Firebase Admin si no se usa Firebase Auth |
| **Revocar SIWA al borrar la cuenta** | 5.1.1(v) | Handler de borrado | Canjear el `authorizationCode` por refresh token al login, guardarlo y llamar a `/auth/revoke` al borrar (requiere key .p8, team id, key id) |
| **Borrado de cuenta dentro de la app** | 5.1.1(v) | Pantalla de ajustes | Igual que Play |
| **Suscripciones** | 3.1.2 | Paywall | Título, duración, precio por período, renovación automática, enlaces a Términos (EULA) y Privacidad **en el paywall** y en la ficha |
| **EULA** | — | Términos propios | Usar el EULA estándar de Apple o uno propio que incluya las cláusulas mínimas de Apple (ver `legal-texts.md`) |
| **ATT** | 5.1.2 | Uso de IDFA (SDK de anuncios) | `NSUserTrackingUsageDescription` + pedir el permiso antes de rastrear |
| **Manifiesto de privacidad** | Requisito desde 2024 | `ios/Runner/PrivacyInfo.xcprivacy` (o equivalente) incluido en los recursos del target | Declarar datos recogidos, tracking y APIs con razón requerida (UserDefaults CA92.1, file timestamp, etc.) |
| **Etiqueta de privacidad** | App Store Connect | Inventario | Copiar el inventario; coherente con el manifiesto |
| **Claves de uso** | — | `Info.plist` vs plugins (cámara, fotos, ubicación, micrófono) | Una clave `NS*UsageDescription` por cada permiso que se pida; si falta, crash al pedirlo |
| **Push** | — | `aps-environment` en entitlements + `UIBackgroundModes` | Agregar si se usan notificaciones |

## Cuando una plataforma se publica después

Patrón recomendado (p. ej. Android ahora, iOS después): dejar en el repo todo lo que no depende de consolas —flujo SIWA detrás de un flag de plataforma, entitlements, manifiesto de privacidad, claves de Info.plist, variables de entorno documentadas— y un checklist con lo que sí depende de consolas (App ID y capabilities, keys .p8, `GoogleService-Info.plist`, producto de suscripción, etiqueta de privacidad, notas para el revisor con cuenta de prueba).

## Verificaciones rápidas

```bash
# Login con terceros presente (dispara 4.8 en iOS)
grep -rnE "google_sign_in|GoogleSignIn|facebook|FBSDK|flutter_facebook_auth|twitter_login" pubspec.yaml package.json ios/Podfile android/app/build.gradle* 2>/dev/null
# ¿Hay Sign in with Apple?
grep -rnE "sign_in_with_apple|ASAuthorizationAppleID|@invertase/react-native-apple-authentication" . --include=*.{yaml,json,swift,dart,ts,tsx} 2>/dev/null | head
# Manifiesto de privacidad iOS y entitlements
find ios -name "PrivacyInfo.xcprivacy" -o -name "*.entitlements" 2>/dev/null
# Claves de uso en Info.plist
grep -n "UsageDescription" ios/Runner/Info.plist ios/*/Info.plist 2>/dev/null
# Borrado de cuenta
grep -rniE "delete.*account|account.*delet|deleteUser|eliminar cuenta" --include=*.{ts,js,dart,kt,swift,tsx} . | head
```
