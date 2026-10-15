# Política de cookies

En la UE (Directiva ePrivacy, art. 5.3) y en las leyes que la imitan, la regla no es sobre "cookies" sino sobre **guardar o leer información en el dispositivo del visitante**: cookies, `localStorage`, `sessionStorage`, IndexedDB, píxeles y huellas digitales. Hace falta **consentimiento previo** salvo para lo **estrictamente necesario** para el servicio que la persona pidió.

## Clasificación

| Tipo | Ejemplos | ¿Consentimiento? |
|---|---|---|
| Estrictamente necesarias | Sesión de login, carrito, token CSRF, balanceo de carga, guardar la elección de consentimiento | No |
| Preferencias | Idioma, tema elegido, filtros recordados | Discutido; si solo mejora la comodidad y es de primera parte, muchas autoridades la toleran como necesaria si la pidió el usuario. Mejor declararla |
| Analítica | Google Analytics, Plausible con cookies, Clarity | Sí (salvo analítica sin cookies y sin identificadores, según autoridad) |
| Publicidad / rastreo | Meta Pixel, Google Ads, remarketing | Sí, siempre |
| Contenido embebido | YouTube, Vimeo, mapas, widgets sociales | Sí (usar `youtube-nocookie.com` y carga tras clic) |

## Recursos de terceros sin cookies

Aunque no pongan cookies, **transfieren la IP del visitante** a otra empresa. Un tribunal alemán (LG München I, 20-01-2022) consideró ilícito cargar Google Fonts desde los servidores de Google sin consentimiento. Regla práctica:

- **Fuentes**: autoalojar siempre (copiar los `.woff2`/`.ttf` a `assets/fonts`).
- **Librerías JS/CSS**: servir desde el propio dominio en producción; un CDN público solo si se declara.
- Si el sitio pasa por Cloudflare u otro proxy, ese proveedor ve el tráfico: va en la política de privacidad como encargado.

## ¿Hace falta banner?

- **Solo necesarias (o nada)**: no hace falta banner. Publicar igual la política de cookies diciendo que no hay, porque la gente la busca y las auditorías la piden.
- **Algo que requiere consentimiento**: banner con **Aceptar y Rechazar al mismo nivel** (mismo tamaño y visibilidad), nada se carga antes de aceptar, enlace permanente para cambiar la elección, y registro de la elección. Para Google Analytics usar la skill `web-analytics-consent` (Consent Mode v2).
- Muros de cookies ("acepta o no entras") y casillas premarcadas no valen como consentimiento en la UE.

## Estructura de la página

1. **En resumen**: una frase. Si no hay cookies: "Este sitio no usa cookies ni ninguna otra tecnología para seguirte. Por eso no te mostramos un aviso de cookies."
2. **Qué son las cookies** (2-3 frases, incluye storage y píxeles como tecnologías parecidas).
3. **Lo que usa este sitio**: tabla.
   - Sin cookies: tecnología / ¿la usamos? (cookies propias o de terceros, analítica, publicidad/píxeles, almacenamiento local, contenido de otros dominios).
   - Con cookies: nombre / proveedor / finalidad / duración / tipo (necesaria, preferencias, analítica, publicidad).
4. **Peticiones propias que no guardan nada** (p. ej. leer `version.json`), para que nadie las confunda con rastreo.
5. **Registros del servidor**: datos técnicos de cada visita; remitir a privacidad.
6. **La app** (si hay app de escritorio/móvil): no usa cookies; remitir a la sección de almacenamiento local de la política de privacidad.
7. **Cómo gestionar o cambiar tu elección** (solo si hay banner): enlace que reabre el banner + cómo borrar cookies en el navegador.
8. **Cambios y contacto**: compromiso de actualizar la página y pedir permiso antes de agregar cookies que lo requieran.

## Verificación

```bash
# Nada que guarde en el navegador (si la página dice que no hay)
grep -rnE "document\.cookie|localStorage|sessionStorage|indexedDB|Set-Cookie" <sitio>
# Nada cargado desde otro dominio
grep -rnoE "(src|href)=\"https?://[^\"]+\"|url\(https?://[^)]+\)" <sitio> --include=*.html --include=*.css
```

Y en el navegador: DevTools → Application → Cookies / Local Storage vacíos tras navegar; Network filtrado por dominios externos vacío. Los enlaces normales `<a href="https://…">` a otros sitios no cuentan: no cargan nada hasta que se pulsan.
