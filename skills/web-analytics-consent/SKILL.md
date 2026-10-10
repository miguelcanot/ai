---
name: web-analytics-consent
description: Implementa Google Analytics 4 (gtag.js) en un sitio web estático/landing con banner de consentimiento de cookies (Google Consent Mode v2) y actualiza la política de privacidad. Úsala cuando el usuario pida "agregar Google Analytics", "poner el tag G-XXXX", "banner de cookies", "consentimiento de cookies", "Consent Mode", "medir visitas del landing", o cuando haya que cumplir GDPR/Ley 172-13 al medir tráfico web. Solo sitios web, no apps móviles.
---

# Google Analytics + consentimiento (sitio web)

Patrón reutilizable en cualquier sitio estático (landing, páginas legales, etc.).

## Qué se instala

Un único script compartido, **no** el snippet de gtag pegado en cada página:

- Plantilla: [consent.template.js](consent.template.js) → copiar a `<sitio>/assets/consent.js`.
- Cambiar `GA_ID` por el Measurement ID (`G-XXXXXXXXXX`) y, si hay varios sitios bajo el mismo origen, `KEY` de localStorage.
- Qué hace: declara `consent default = denied` (analytics, ad_storage, ad_user_data, ad_personalization) **antes** de cargar gtag.js, carga gtag, y muestra un banner Aceptar/Rechazar. La elección se guarda en `localStorage` y se aplica con `consent update`. Enlaces con atributo `data-cookie-prefs` reabren el banner.

## Pasos

1. **Confirmar el ID.** Pedirlo si no viene (`G-…`). No inventarlo.
2. **Copiar el script** a la carpeta de assets del sitio y ajustar `GA_ID`.
3. **Incluirlo en el `<head>` de TODAS las páginas** (index, privacy, terms, account-deletion, etc.), lo más arriba posible, con ruta absoluta:
   ```html
   <script src="/assets/consent.js"></script>
   ```
   No dejar además el snippet oficial de gtag: duplicaría la medición y se saltaría el consentimiento. Verificar con `grep -n "gtag\|googletagmanager" *.html` que solo exista la referencia a `consent.js`.
4. **Actualizar la política de privacidad** (ver abajo).
5. **Estilo del banner:** los colores/fuentes están dentro del JS (`st.textContent`). Ajustarlos a los tokens del sitio (fondo, acento, fuente).
6. **Desplegar** el sitio y verificar (ver "Verificación").

## Política de privacidad — cambios mínimos

- Tabla de datos: fila "Datos de navegación del sitio web (páginas, dispositivo, navegador, país aproximado, IP, cookies) — Google Analytics — medir visitas; aplica solo al sitio, no a la app".
- Tabla de proveedores: fila "Google Analytics (solo sitio web)" con enlace a `https://policies.google.com/technologies/partner-sites`.
- Subsección con `id="analytics"` (el banner enlaza a `/privacy#analytics`): qué mide, que solo se activa si se acepta, enlace al complemento de inhabilitación (`https://tools.google.com/dlpage/gaoptout`) y un enlace `<a href="#" data-cookie-prefs>Preferencias de cookies</a>` para cambiar la elección.
- Actualizar la fecha de "última actualización".
- Si el sitio no se llama `/privacy`, ajustar el enlace dentro de `consent.js`.

## Verificación

- `curl -s <sitio>/assets/consent.js | head -3` responde 200 (si el sitio se sirve desde Docker/imagen, hace falta redeploy: los assets pueden estar empaquetados).
- En una ventana privada aparece el banner; antes de aceptar, en DevTools → Network no debe salir `collect?` a google-analytics.com con `gcs=G100` (denegado) más allá de pings anónimos de Consent Mode.
- Tras aceptar, GA4 → Informes → Tiempo real muestra la visita.
- Recordar al usuario: con Consent Mode v2, Google puede recibir señales sin cookies de quien rechaza. Si se exige **cero** envío hasta aceptar, cargar gtag.js dentro de `choose("granted")` en vez de al inicio.

## Notas

- La plantilla es solo analítica. Si más adelante se agrega publicidad web (Google Ads), `ad_storage`/`ad_user_data`/`ad_personalization` ya parten en denied y habría que añadir sus propias opciones al banner.
- No guardar el ID ni datos de GA en el repo más allá del ID público de medición.
