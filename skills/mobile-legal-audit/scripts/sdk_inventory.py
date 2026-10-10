#!/usr/bin/env python3
"""Inventario legal de SDKs, permisos y piezas de cumplimiento de una app móvil.

Uso:  python sdk_inventory.py <raíz-del-proyecto>

Lee dependencias de Flutter (pubspec.yaml), React Native / Node (package.json),
Android (build.gradle[.kts]), iOS (Podfile, Package.resolved) y el backend
(package.json, requirements.txt), y las cruza con un catálogo de SDKs conocidos
para decir qué datos recoge cada uno y qué obligación legal o de tienda dispara.
Después lista permisos de Android, claves de uso de iOS y la presencia de las
piezas de cumplimiento (manifiesto de privacidad, entitlements, enlaces
legales, borrado de cuenta).

Es un punto de partida: un SDK que no esté en el catálogo aparece igual en la
lista de "sin clasificar" para revisarlo a mano.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

SKIP_DIRS = {
    "node_modules", ".git", "build", ".dart_tool", "Pods", ".gradle", "dist",
    ".next", "lib/generated", ".venv", "venv", "__pycache__", ".idea", "DerivedData",
}

# patrón (regex sobre el nombre del paquete) → (categoría, datos, obligación)
CATALOG: list[tuple[str, str, str, str]] = [
    # Anuncios
    (r"google_mobile_ads|play-services-ads|Google-Mobile-Ads-SDK|react-native-google-mobile-ads",
     "Anuncios (AdMob)", "ID de publicidad, IP, datos del dispositivo, interacción con anuncios",
     "Data Safety 'contiene anuncios' + ID de dispositivo compartido; consentimiento UMP (EEE/RU/CH, estados EE. UU.); ATT en iOS; política debe nombrar a Google como receptor"),
    (r"applovin|unity_ads|unityads|ironsource|facebook_audience|audience_network|vungle|chartboost|inmobi|mintegral|pangle",
     "Anuncios (red / mediación)", "ID de publicidad, IP, dispositivo",
     "Mismo que AdMob; listar cada red en la política"),
    (r"app_tracking_transparency|AppTrackingTransparency",
     "ATT (iOS)", "Estado de autorización de rastreo",
     "NSUserTrackingUsageDescription en Info.plist; pedir después del consentimiento UMP"),
    # Analítica / crash
    (r"firebase_analytics|FirebaseAnalytics|@react-native-firebase/analytics",
     "Analítica (Firebase)", "Eventos de uso, ID de instancia, dispositivo",
     "Declarar analítica en Data Safety / etiqueta de privacidad; consentimiento en UE si es no esencial"),
    (r"firebase_crashlytics|Crashlytics|sentry|bugsnag|instabug|datadog",
     "Crash / diagnóstico", "Trazas, dispositivo, a veces userId",
     "Declarar 'diagnóstico' en Data Safety; política: proveedor y retención"),
    (r"amplitude|mixpanel|segment|posthog|appsflyer|adjust|branch|kochava|singular|clevertap|onesignal_analytics",
     "Analítica / atribución", "Eventos, IDs de dispositivo y publicidad",
     "Probable 'rastreo' (ATT); consentimiento; listar en la política"),
    # Auth
    (r"google_sign_in|GoogleSignIn|@react-native-google-signin",
     "Login con Google", "Email, nombre, foto, ID de Google",
     "iOS: obliga a ofrecer Sign in with Apple (4.8); minimizar campos guardados (¿se usa la foto?)"),
    (r"flutter_facebook_auth|FBSDKLoginKit|react-native-fbsdk|facebook_login|facebook-android-sdk",
     "Login / SDK de Facebook", "Email, nombre, ID de Facebook; el SDK puede enviar eventos a Meta",
     "iOS: Sign in with Apple obligatorio; declarar a Meta como receptor; si no se usa, ELIMINAR"),
    (r"sign_in_with_apple|AuthenticationServices|react-native-apple-authentication",
     "Sign in with Apple", "Email (o relay privado), nombre la primera vez, ID de Apple",
     "Verificar identityToken contra llaves de Apple; revocar el token al borrar la cuenta (5.1.1(v))"),
    (r"firebase_auth|FirebaseAuth|@react-native-firebase/auth|supabase_flutter|@supabase|auth0|amplify_auth|cognito",
     "Proveedor de autenticación", "Credenciales, email, IDs",
     "Proveedor en la política; borrar el usuario del proveedor al eliminar la cuenta"),
    # Push
    (r"firebase_messaging|FirebaseMessaging|@react-native-firebase/messaging|onesignal|pushwoosh|airship",
     "Push", "Token de dispositivo",
     "Declarar ID de dispositivo; iOS: aps-environment + UIBackgroundModes remote-notification; vaciar tokens al borrar la cuenta"),
    (r"flutter_local_notifications|notifee",
     "Notificaciones locales", "—", "Android 13+: permiso POST_NOTIFICATIONS"),
    # Pagos
    (r"purchases_flutter|RevenueCat|react-native-purchases",
     "Suscripciones (RevenueCat)", "ID de usuario, historial de compras",
     "Divulgaciones en el paywall; política: RevenueCat como receptor; borrar customer al eliminar la cuenta"),
    (r"in_app_purchase|react-native-iap|billing-ktx|com\.android\.billingclient|StoreKit",
     "Compras in-app (tienda)", "Historial de compras",
     "Divulgaciones en el paywall; 'historial de compras' en Data Safety"),
    (r"stripe|braintree|paypal|mercadopago|square",
     "Pagos externos", "Datos de pago (en el proveedor)",
     "Solo bienes físicos/servicios fuera de la app; contenido digital debe usar la facturación de la tienda"),
    # Datos sensibles del dispositivo
    (r"geolocator|location|react-native-geolocation|play-services-location|CoreLocation",
     "Ubicación", "Ubicación precisa/aproximada",
     "Permiso + justificación; Data Safety 'ubicación'; Info.plist NSLocation*UsageDescription"),
    (r"image_picker|camera|react-native-image-picker|react-native-vision-camera|photo_manager",
     "Cámara / fotos", "Fotos y videos",
     "Info.plist NSCameraUsageDescription / NSPhotoLibraryUsageDescription; UGC: moderación y reporte"),
    (r"contacts_service|flutter_contacts|react-native-contacts",
     "Contactos", "Agenda del usuario",
     "Permiso sensible: justificación fuerte y declaración explícita"),
    (r"record|flutter_sound|speech_to_text|react-native-voice|audio_recorder",
     "Micrófono", "Audio", "NSMicrophoneUsageDescription; declarar"),
    (r"health|HealthKit|google_fit|health_connect",
     "Salud", "Datos de salud", "Categoría especial (GDPR art. 9); políticas específicas de tienda"),
    (r"local_auth|biometric",
     "Biometría", "Resultado de autenticación (no la biometría)", "NSFaceIDUsageDescription"),
    # Chat / UGC
    (r"stream_chat|sendbird|cometchat|twilio_conversations|socket_io|firebase_database|cloud_firestore",
     "Mensajería / tiempo real (posible UGC)", "Mensajes y contenido del usuario si hay chat",
     "Si hay UGC: términos de conducta, reportar/bloquear (Apple 1.2), moderación"),
    # Almacenamiento local
    (r"shared_preferences|NSUserDefaults|async-storage",
     "Almacenamiento local", "Preferencias, tokens",
     "iOS: declarar NSPrivacyAccessedAPICategoryUserDefaults (CA92.1) en PrivacyInfo.xcprivacy"),
]

ANDROID_SENSITIVE = {
    "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "ACCESS_BACKGROUND_LOCATION",
    "READ_CONTACTS", "READ_SMS", "SEND_SMS", "RECEIVE_SMS", "READ_CALL_LOG", "CAMERA",
    "RECORD_AUDIO", "READ_EXTERNAL_STORAGE", "READ_MEDIA_IMAGES", "READ_MEDIA_VIDEO",
    "QUERY_ALL_PACKAGES", "BIND_ACCESSIBILITY_SERVICE", "SYSTEM_ALERT_WINDOW",
    "REQUEST_INSTALL_PACKAGES", "MANAGE_EXTERNAL_STORAGE", "BODY_SENSORS", "AD_ID",
}


def walk(root: Path, names: set[str] | None = None, suffixes: tuple[str, ...] = ()):
    for dirpath, dirnames, filenames in os.walk(root):
        rel = Path(dirpath).relative_to(root).as_posix()
        # `lib/` junto a un tsconfig.json es salida compilada de TypeScript: duplica src/.
        compiled = {"lib", "out"} if (Path(dirpath) / "tsconfig.json").exists() else set()
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and d not in compiled and not d.startswith(".")]
        if any(part in SKIP_DIRS for part in Path(rel).parts):
            continue
        for f in filenames:
            if (names and f in names) or (suffixes and f.endswith(suffixes)):
                yield Path(dirpath) / f


def read(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def deps_from_file(p: Path) -> list[str]:
    text = read(p)
    name = p.name
    out: list[str] = []
    if name == "pubspec.yaml":
        block = re.search(r"^dependencies:\s*\n((?:[ \t]+.*\n|\s*\n)+)", text, re.M)
        if block:
            out += re.findall(r"^[ ]{2}([a-zA-Z0-9_]+):", block.group(1), re.M)
    elif name == "package.json":
        try:
            data = json.loads(text)
            for key in ("dependencies", "devDependencies"):
                out += list((data.get(key) or {}).keys())
        except json.JSONDecodeError:
            pass
    elif name.startswith("build.gradle"):
        out += re.findall(r"""(?:implementation|api)\s*\(?\s*["']([^"':]+:[^"':]+)""", text)
    elif name in ("Podfile", "Podfile.lock"):
        out += re.findall(r"""pod\s+['"]([^'"]+)""", text)
        out += re.findall(r"^\s*-\s+([A-Za-z0-9_\-/]+)", text, re.M)
    elif name == "Package.resolved":
        out += re.findall(r'"identity"\s*:\s*"([^"]+)"', text)
    elif name == "requirements.txt":
        out += [re.split(r"[<>=~!;\[ ]", l.strip())[0] for l in text.splitlines() if l.strip() and not l.startswith("#")]
    return sorted(set(out))


def classify(dep: str):
    for pattern, cat, data, obligation in CATALOG:
        if re.search(pattern, dep, re.I):
            return cat, data, obligation
    return None


def main() -> None:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    print(f"# Inventario legal — {root.name}\n")

    dep_files = list(walk(root, names={
        "pubspec.yaml", "package.json", "build.gradle", "build.gradle.kts",
        "Podfile", "Package.resolved", "requirements.txt",
    }))
    found: dict[str, tuple[str, str, str, set[str]]] = {}
    unclassified: dict[str, set[str]] = {}
    for f in dep_files:
        rel = f.relative_to(root).as_posix()
        for dep in deps_from_file(f):
            c = classify(dep)
            if c:
                cat, data, obl = c
                key = f"{cat}::{dep}"
                found.setdefault(key, (cat, data, obl, set()))[3].add(rel)
            else:
                unclassified.setdefault(dep, set()).add(rel)

    print("## SDKs con implicaciones legales\n")
    if not found:
        print("_Ninguno del catálogo._\n")
    else:
        print("| Categoría | Paquete | Datos | Obligación | Declarado en |")
        print("|---|---|---|---|---|")
        for key in sorted(found):
            cat, data, obl, files = found[key]
            dep = key.split("::", 1)[1]
            print(f"| {cat} | `{dep}` | {data} | {obl} | {', '.join(sorted(files))} |")
        print()

    # Permisos Android
    print("## Permisos Android declarados\n")
    perms: dict[str, set[str]] = {}
    for f in walk(root, names={"AndroidManifest.xml"}):
        for p in re.findall(r'uses-permission[^>]*android:name="([^"]+)"', read(f)):
            perms.setdefault(p.split(".")[-1], set()).add(f.relative_to(root).as_posix())
    if perms:
        for p in sorted(perms):
            flag = " **(sensible)**" if p in ANDROID_SENSITIVE else ""
            print(f"- `{p}`{flag} — {', '.join(sorted(perms[p]))}")
    else:
        print("_Ninguno declarado a mano (los plugins pueden agregarlos al manifiesto fusionado: revisar el de release)._")
    print()

    # iOS
    print("## iOS\n")
    plists = [p for p in walk(root, names={"Info.plist"}) if "/ios/" in p.as_posix() or p.parent.name not in ("Flutter",)]
    for f in plists:
        keys = re.findall(r"<key>(NS\w+UsageDescription|NSUserTrackingUsageDescription|UIBackgroundModes|GADApplicationIdentifier|GIDClientID)</key>", read(f))
        if keys:
            print(f"- `{f.relative_to(root).as_posix()}`: {', '.join(sorted(set(keys)))}")
    manifests = list(walk(root, names={"PrivacyInfo.xcprivacy"}))
    ents = list(walk(root, suffixes=(".entitlements",)))
    print(f"- Manifiesto de privacidad (PrivacyInfo.xcprivacy): {'sí — ' + ', '.join(m.relative_to(root).as_posix() for m in manifests) if manifests else '**NO** (obligatorio en App Store)'}")
    if ents:
        for e in ents:
            t = read(e)
            caps = [c for c in ("aps-environment", "com.apple.developer.applesignin", "com.apple.developer.associated-domains") if c in t]
            print(f"- Entitlements `{e.relative_to(root).as_posix()}`: {', '.join(caps) or '(vacío)'}")
    else:
        print("- Entitlements: **ninguno** (Sign in with Apple y push los necesitan)")
    has_gsi = any((root / p).exists() for p in ("ios/Runner/GoogleService-Info.plist", "ios/GoogleService-Info.plist"))
    print(f"- GoogleService-Info.plist: {'sí' if has_gsi else 'no (necesario si se usa Firebase en iOS)'}")
    print()

    # Piezas de cumplimiento en el código
    print("## Piezas de cumplimiento encontradas en el código\n")
    code_suffixes = (".dart", ".ts", ".tsx", ".js", ".kt", ".swift", ".java", ".html", ".py")
    checks = {
        "Enlace a política de privacidad": r"privacy|privacidad",
        "Enlace a términos": r"/terms\b|terms[-_ ]?of[-_ ]?service|términos",
        "Borrado de cuenta": r"delete[-_ ]?account|deleteAccount|account[-_]?deletion|eliminar cuenta|/account\b.*delete|router\.delete\([\"']/account",
        "Consentimiento UMP": r"ConsentInformation|UserMessagingPlatform|requestConsentInfoUpdate",
        "Opciones de privacidad de anuncios": r"showPrivacyOptionsForm|privacyOptionsRequirementStatus",
        "Registro de aceptación de términos": r"termsAccepted|acceptedTerms|terms_accepted",
        "Restaurar compras": r"restorePurchases|restore\(\)|Restaurar compras",
        "Revocación Sign in with Apple": r"appleid\.apple\.com/auth/revoke|auth/revoke",
    }
    files = [f for f in walk(root, suffixes=code_suffixes)]
    for label, pattern in checks.items():
        hits = []
        rx = re.compile(pattern, re.I)
        for f in files:
            if rx.search(read(f)):
                hits.append(f.relative_to(root).as_posix())
            if len(hits) >= 4:
                break
        status = ("sí — " + ", ".join(hits)) if hits else "**no encontrado**"
        print(f"- {label}: {status}")
    print()

    # Sin clasificar (filtrar ruido de frameworks)
    noise = re.compile(r"^(flutter|cupertino_icons|riverpod|freezed|json_|build_runner|lints|flutter_lints|very_good|go_router|intl|dio|http|equatable|@types/|typescript|eslint|prettier|ts-node|nodemon|jest|vitest|react$|react-dom|react-native$|expo$|@babel|babel|kotlin|androidx\.|com\.android\.tools|org\.jetbrains)", re.I)
    rest = sorted(d for d in unclassified if not noise.search(d))
    if rest:
        print("## Dependencias sin clasificar (revisar si recogen o envían datos)\n")
        print(", ".join(f"`{d}`" for d in rest))
        print()


if __name__ == "__main__":
    main()
