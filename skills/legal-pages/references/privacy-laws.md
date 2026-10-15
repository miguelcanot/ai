# Leyes de protección de datos: qué cambian en los textos

Resumen operativo para redactar las páginas; no reemplaza el texto de cada ley. Si el mercado no está aquí, aplica el **núcleo común** y marca "verificar con abogado local". Las leyes de consumo (términos) están en `terms.md`; las reglas de cookies, en `cookies.md`.

## Núcleo común (casi todas las leyes modernas)

1. **Transparencia**: qué datos, para qué, base legal, con quién se comparten, transferencias internacionales, retención, derechos y contacto. → cada fila del inventario aparece en la política.
2. **Minimización**: no recoger lo que no se usa. Si el inventario muestra un dato sin uso, proponer quitarlo antes que declararlo.
3. **Derechos**: acceso, rectificación, supresión, oposición; en algunas, portabilidad y limitación. Plazo de respuesta típico: 30 días (RGPD: 1 mes; LGPD: 15 días para confirmar).
4. **Seguridad**: cifrado en tránsito, claves y contraseñas con hash, control de acceso; notificar brechas.
5. **Consentimiento** cuando no hay otra base (marketing, analítica con cookies, publicidad, funciones opcionales como IA con clave del responsable), revocable tan fácil como se dio.
6. **Menores**: consentimiento parental o exclusión explícita (edad mínima en los términos).

## Unión Europea / EEE / Reino Unido / Suiza: RGPD / UK GDPR / FADP

- **Base legal por finalidad**, nombrada en la política: contrato (licencia, cuenta), interés legítimo (seguridad, rate limiting, soporte), consentimiento (analítica, IA opcional), obligación legal (facturación).
- **Cookies e identificadores**: consentimiento previo salvo lo estrictamente necesario (ePrivacy, ver `cookies.md`).
- **Transferencias fuera del EEE** (hosting, proveedores de IA, CDN en EE. UU.): mencionarlas con su mecanismo (cláusulas contractuales tipo, Data Privacy Framework).
- **Derecho a reclamar** ante la autoridad de control.
- Edad de consentimiento digital: 13–16 según país.
- Si se ofrece en la UE sin establecimiento allí: posiblemente representante en la UE (art. 27); marcar "verificar".

## Estados Unidos

- **COPPA**: si el producto se dirige a menores de 13 o sabe que los tiene, consentimiento parental verificable. Lo habitual: términos 18+ (o 13+) y no dirigirse a menores.
- **Leyes estatales** (California CCPA/CPRA, Virginia, Colorado, Connecticut, Utah, Texas, etc.): derecho a saber, borrar, corregir y **optar por no "vender/compartir"** datos para publicidad dirigida. Si no se vende ni se comparte nada, decirlo expresamente; si sí, enlace "Do Not Sell or Share" y categorías de datos.

## Brasil: LGPD

Parecida al RGPD: bases legales, derechos (incluida portabilidad), encarregado (DPO) con contacto publicado, notificación de incidentes a la ANPD.

## Latinoamérica (selección)

| País | Norma | Qué pedir en el texto |
|---|---|---|
| República Dominicana | Ley 172-13 | Consentimiento informado, derechos de acceso/rectificación/cancelación/oposición (habeas data), seguridad, informar cesiones a terceros. |
| México | LFPDPPP | Aviso de privacidad (integral/simplificado), derechos ARCO, transferencias. |
| Colombia | Ley 1581 de 2012 | Autorización previa y expresa, política de tratamiento publicada; registro de bases ante la SIC si aplica. |
| Argentina | Ley 25.326 | Consentimiento, derechos de acceso; registro de bases (AAIP). |
| Chile | Ley 19.628 (y reforma 21.719) | Consentimiento, derechos ARCO+; nueva agencia de protección de datos. |
| Perú | Ley 29733 | Consentimiento, registro de bancos de datos. |

## Menores: criterio práctico

- Herramientas profesionales, pagos o contenido para adultos → **18+** en los términos y, si hay registro, confirmación de edad.
- Si puede haber menores → revisar COPPA y la edad digital del RGPD, y no usar analítica ni publicidad que los perfile.

## Cómo aplicarlo al texto

Para cada mercado que aplique, recorre el núcleo común contra el inventario y el borrador:
- ¿La política nombra cada dato, tercero y transferencia? (transparencia)
- ¿Hay datos recogidos sin uso? (minimización)
- ¿Cada derecho tiene un camino real (pantalla, endpoint o correo que existe)? (derechos)
- ¿Hay consentimiento antes de lo que lo exige? (consentimiento)
- ¿El borrado borra lo que la política promete? (supresión)
- ¿El correo de privacidad funciona y es el mismo en todas las páginas?
