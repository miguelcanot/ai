#!/usr/bin/env python3
"""Inventario de datos para redactar textos legales (privacidad, términos, cookies).

Recorre un repositorio y lista, con archivo:línea, las señales que una política tiene que
cubrir: hosts externos a los que habla el código, almacenamiento local, cookies y storage
del navegador, registro de IPs, SDKs de analítica/errores/IA y recursos de terceros que
cargan las páginas web.

No decide nada: es el punto de partida para leer el código. Cada hallazgo hay que
confirmarlo abriendo el archivo.

Uso:
    python inventory.py <raíz-del-proyecto> [--max-hits N] [--exclude RUTA ...]
"""
import argparse
import os
import re
import sys
from collections import defaultdict

SKIP_DIRS = {
    '.git', 'node_modules', 'bin', 'obj', 'dist', 'build', 'out', '.next', '.nuxt', '.angular',
    'vendor', 'packages', '.venv', 'venv', '__pycache__', '.idea', '.vs', '.vscode', 'Pods',
    '.dart_tool', '.gradle', 'coverage', 'publish', 'release', '.svelte-kit', 'target',
}
CODE_EXT = {
    '.cs', '.axaml', '.xaml', '.razor', '.cshtml', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
    '.vue', '.svelte', '.py', '.go', '.rs', '.java', '.kt', '.swift', '.dart', '.php', '.rb',
    '.html', '.htm', '.json', '.yml', '.yaml', '.toml', '.xml', '.plist', '.csproj', '.gradle',
    '.env', '.config', '.ini', '.sh', '.ps1',
}
MAX_FILE_BYTES = 1_500_000

# host (subcadena) → (proveedor, qué suele implicar para la política)
KNOWN_HOSTS = [
    ('generativelanguage.googleapis.com', 'Google Gemini API', 'IA: el contenido enviado lo procesa Google; en el plan gratuito puede usarse para mejorar productos y revisarlo una persona'),
    ('aiplatform.googleapis.com', 'Google Vertex AI', 'IA (Google Cloud, sin entrenamiento con datos del cliente)'),
    ('api.openai.com', 'OpenAI API', 'IA: por defecto no entrena con datos de la API; retención para abuso'),
    ('openai.azure.com', 'Azure OpenAI', 'IA dentro de la suscripción Azure del cliente'),
    ('api.anthropic.com', 'Anthropic API', 'IA: por defecto no entrena con datos de la API'),
    ('api.mistral.ai', 'Mistral API', 'IA'),
    ('api.groq.com', 'Groq API', 'IA'),
    ('dev.azure.com', 'Azure DevOps', 'Integración con cuenta del usuario'),
    ('visualstudio.com', 'Azure DevOps (legacy)', 'Integración con cuenta del usuario'),
    ('graph.microsoft.com', 'Microsoft Graph', 'Datos de Microsoft 365 del usuario'),
    ('login.microsoftonline.com', 'Microsoft Entra ID', 'Inicio de sesión'),
    ('zoho', 'Zoho', 'Integración con cuenta del usuario (OAuth)'),
    ('atlassian.net', 'Atlassian (Jira/Confluence)', 'Integración con cuenta del usuario'),
    ('api.github.com', 'GitHub API', 'Integración con cuenta del usuario'),
    ('slack.com', 'Slack', 'Integración / mensajería'),
    ('accounts.google.com', 'Google Sign-In', 'Inicio de sesión'),
    ('oauth2.googleapis.com', 'Google OAuth', 'Inicio de sesión'),
    ('appleid.apple.com', 'Sign in with Apple', 'Inicio de sesión'),
    ('fonts.googleapis.com', 'Google Fonts (CSS)', 'Web: transfiere la IP del visitante a Google; mejor autoalojar'),
    ('fonts.gstatic.com', 'Google Fonts (archivos)', 'Web: transfiere la IP del visitante a Google; mejor autoalojar'),
    ('googletagmanager.com', 'Google Tag Manager / gtag', 'Analítica/publicidad: requiere consentimiento en UE'),
    ('google-analytics.com', 'Google Analytics', 'Analítica: requiere consentimiento en UE'),
    ('doubleclick.net', 'Google Ads', 'Publicidad'),
    ('facebook.net', 'Meta Pixel', 'Publicidad/rastreo'),
    ('clarity.ms', 'Microsoft Clarity', 'Analítica con grabación de sesión'),
    ('hotjar', 'Hotjar', 'Analítica con grabación de sesión'),
    ('sentry.io', 'Sentry', 'Errores: puede incluir IP, usuario y datos del error'),
    ('applicationinsights', 'Azure Application Insights', 'Telemetría'),
    ('in.appcenter.ms', 'App Center', 'Telemetría/errores'),
    ('posthog', 'PostHog', 'Analítica'),
    ('mixpanel', 'Mixpanel', 'Analítica'),
    ('segment.io', 'Segment', 'Analítica'),
    ('amplitude', 'Amplitude', 'Analítica'),
    ('stripe.com', 'Stripe', 'Pagos'),
    ('paddle', 'Paddle', 'Pagos (merchant of record)'),
    ('lemonsqueezy', 'Lemon Squeezy', 'Pagos (merchant of record)'),
    ('revenuecat', 'RevenueCat', 'Suscripciones'),
    ('firebase', 'Firebase', 'Backend/analítica/push según el producto'),
    ('cloudflare', 'Cloudflare', 'CDN/proxy: ve el tráfico y la IP'),
    ('cdn.jsdelivr.net', 'jsDelivr', 'CDN de terceros: ve la IP del visitante'),
    ('cdnjs.cloudflare.com', 'cdnjs', 'CDN de terceros: ve la IP del visitante'),
    ('unpkg.com', 'unpkg', 'CDN de terceros: ve la IP del visitante'),
    ('youtube.com', 'YouTube', 'Embebido: cookies de terceros (usar youtube-nocookie)'),
    ('vimeo.com', 'Vimeo', 'Embebido'),
    ('gravatar.com', 'Gravatar', 'Envía hash del correo a un tercero'),
]
IGNORED_HOSTS = ('www.w3.org', 'schemas.microsoft.com', 'schemas.android.com', 'json-schema.org',
                 'xmlns', 'localhost', '127.0.0.1', 'example.com', 'example.org', 'purl.org',
                 'schemas.openxmlformats.org', 'github.com/avaloniaui')

PATTERNS = {
    'Almacenamiento local (app)': [
        r'LocalApplicationData|ApplicationData\b|SpecialFolder\.',
        r'Application Support', r'%LOCALAPPDATA%|%APPDATA%',
        r'getApplicationDocumentsDirectory|getApplicationSupportDirectory|SharedPreferences|UserDefaults',
        r'app\.getPath\(|electron-store|userData',
        r'appdirs|platformdirs|user_data_dir',
    ],
    'Credenciales / cifrado local': [
        r'DataProtection|ProtectedData|DPAPI', r'Keychain|SecKeychain|keytar|safeStorage',
        r'flutter_secure_storage|EncryptedSharedPreferences|keyring',
    ],
    'Cookies (servidor o navegador)': [
        r'document\.cookie', r'Set-Cookie', r'res\.cookie\(|cookies\(\)\.set|Response\.Cookies',
        r'express-session|cookie-parser|CookieAuthentication|AddCookie',
    ],
    'Storage del navegador': [
        r'localStorage|sessionStorage|indexedDB',
    ],
    'IP / logs de acceso': [
        r'x-forwarded-for|X-Forwarded-For|remoteAddress|RemoteIpAddress|remote_addr|REMOTE_ADDR',
        r'morgan\(|UseHttpLogging|access[_-]?log|pino-http|winston',
    ],
    'Registros de errores / crash': [
        r'crash\.log|CrashLog|UnhandledException|unhandledRejection|uncaughtException',
    ],
    'Telemetría / analítica (SDK)': [
        r'gtag\(|googletagmanager|GoogleAnalytics|firebase[-_.]analytics',
        r'Sentry|AppCenter|ApplicationInsights|TelemetryClient',
        r'posthog|mixpanel|amplitude|analytics\.segment|@segment/|hotjar|clarity\.ms|plausible|umami',
    ],
    'Correo / datos de contacto': [
        r'mailto:|sendgrid|mailgun|nodemailer|SmtpClient|resend\.com',
    ],
    'Pagos / licencias': [
        r'stripe\.com|@stripe/|Stripe\(|StripeClient|paddle\.com|lemonsqueezy|revenuecat|[Ll]icense[A-Z]|license[-_/]|licen[cs]ia',
    ],
    'Identidad de la persona usuaria': [
        r'displayName|DisplayName|email|Email|avatar|Avatar|photo|userinfo|user/info',
    ],
}

WEB_RESOURCE = re.compile(
    r'<(?:script|link|img|iframe|source|video|audio)[^>]+(?:src|href)=["\'](https?://[^"\']+)', re.I)
CSS_IMPORT = re.compile(r'@import\s+url\(["\']?(https?://[^)"\']+)|url\(["\']?(https?://[^)"\']+)', re.I)
URL_RE = re.compile(r'https?://([A-Za-z0-9.{}\-_$]+)(/[^\s"\'<>`)]*)?')


def iter_files(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith('.')]
        for f in filenames:
            ext = os.path.splitext(f)[1].lower()
            if ext in CODE_EXT or ext in {'.css', '.scss'} or f in {'Dockerfile'}:
                p = os.path.join(dirpath, f)
                try:
                    if os.path.getsize(p) <= MAX_FILE_BYTES:
                        yield p
                except OSError:
                    pass


def classify(host):
    h = host.lower()
    for key, name, note in KNOWN_HOSTS:
        if key in h:
            return name, note
    return None, None


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('root')
    ap.add_argument('--max-hits', type=int, default=6, help='ejemplos por categoría/host (default 6)')
    ap.add_argument('--exclude', action='append', default=[],
                    help='prefijo de ruta relativa a ignorar (repetible): maquetas, textos legales ya escritos')
    args = ap.parse_args()
    root = os.path.abspath(args.root)

    hosts = defaultdict(list)
    signals = defaultdict(list)
    web = defaultdict(list)
    compiled = {cat: [re.compile(p) for p in pats] for cat, pats in PATTERNS.items()}
    n_files = 0

    excludes = [x.replace('\\', '/').strip('/') for x in args.exclude]
    for path in iter_files(root):
        rel = os.path.relpath(path, root).replace('\\', '/')
        if any(rel == x or rel.startswith(x + '/') for x in excludes):
            continue
        n_files += 1
        is_web = rel.lower().endswith(('.html', '.htm', '.css', '.scss', '.vue', '.svelte', '.jsx', '.tsx'))
        try:
            with open(path, encoding='utf-8', errors='ignore') as fh:
                lines = fh.readlines()
        except OSError:
            continue
        for i, line in enumerate(lines, 1):
            if len(line) > 2000:
                line = line[:2000]
            loc = f'{rel}:{i}'
            for m in URL_RE.finditer(line):
                host = m.group(1).strip('.').lower()
                if any(ig in (host + (m.group(2) or '')).lower() for ig in IGNORED_HOSTS):
                    continue
                hosts[host].append((loc, (host + (m.group(2) or ''))[:110]))
            for cat, regs in compiled.items():
                if any(r.search(line) for r in regs):
                    signals[cat].append((loc, line.strip()[:120]))
            if is_web:
                for m in WEB_RESOURCE.finditer(line):
                    web[m.group(1).split('/')[2].lower()].append((loc, m.group(1)[:110]))
                for m in CSS_IMPORT.finditer(line):
                    u = m.group(1) or m.group(2)
                    web[u.split('/')[2].lower()].append((loc, u[:110]))

    out = [f'# Inventario legal: {root}', '', f'{n_files} archivos revisados. Confirma cada señal abriendo el archivo.', '']

    out.append('## 1. Hosts externos a los que habla el código')
    out.append('')
    known, unknown = [], []
    for host, hits in sorted(hosts.items(), key=lambda kv: -len(kv[1])):
        name, note = classify(host)
        (known if name else unknown).append((host, hits, name, note))
    for host, hits, name, note in known:
        out.append(f'- **{name}** (`{host}`, {len(hits)} refs): {note}')
        for loc, url in hits[:args.max_hits]:
            out.append(f'  - `{loc}` {url}')
    if unknown:
        out.append('')
        out.append('Sin clasificar (¿servidor propio, API de cliente, documentación?):')
        for host, hits, _, _ in unknown:
            out.append(f'- `{host}` ({len(hits)} refs), p. ej. `{hits[0][0]}` {hits[0][1]}')
    out.append('')

    out.append('## 2. Recursos de terceros que cargan las páginas web')
    out.append('')
    if web:
        for host, hits in sorted(web.items()):
            name, note = classify(host)
            label = f'**{name}** ' if name else ''
            out.append(f'- {label}`{host}` ({len(hits)}): {note or "revisar: el tercero recibe la IP del visitante"}')
            for loc, url in hits[:args.max_hits]:
                out.append(f'  - `{loc}` {url}')
    else:
        out.append('- Ninguno: las páginas solo cargan recursos propios (bueno para la política de cookies).')
    out.append('')

    out.append('## 3. Señales por categoría')
    out.append('')
    for cat in PATTERNS:
        hits = signals.get(cat, [])
        out.append(f'### {cat} ({len(hits)})')
        if not hits:
            out.append('- Sin coincidencias.')
        for loc, text in hits[:args.max_hits]:
            out.append(f'- `{loc}` {text}')
        if len(hits) > args.max_hits:
            out.append(f'- … {len(hits) - args.max_hits} más')
        out.append('')

    print('\n'.join(out))


if __name__ == '__main__':
    main()
