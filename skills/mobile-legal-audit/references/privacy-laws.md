# Leyes de protección de datos — qué exigen en la práctica

Resumen operativo para auditar una app; no reemplaza el texto de cada ley. Si el mercado no está aquí, aplica el **núcleo común** y marca "verificar con abogado local".

## Núcleo común (casi todas las leyes modernas)

1. **Transparencia**: informar qué datos, para qué, base legal, con quién se comparten, transferencias internacionales, retención, derechos y contacto. → la política de privacidad debe cubrir cada fila del inventario.
2. **Minimización**: no recoger lo que no se usa.
3. **Derechos**: acceso, rectificación, supresión/cancelación, oposición; en algunas, portabilidad y limitación. Plazo de respuesta típico: 30 días (GDPR: 1 mes; LGPD: 15 días para confirmación).
4. **Seguridad**: cifrado en tránsito, contraseñas con hash (bcrypt/argon2), control de acceso; notificar brechas.
5. **Consentimiento** cuando no hay otra base (marketing, publicidad personalizada, rastreo, push en algunos casos), revocable tan fácil como se dio.
6. **Menores**: consentimiento parental o exclusión explícita.

## Unión Europea / EEE / Reino Unido / Suiza — GDPR / UK GDPR / FADP

- Base legal por finalidad (contrato, consentimiento, interés legítimo, obligación legal). La política debe nombrarlas.
- **Publicidad personalizada y cookies/identificadores**: consentimiento previo (ePrivacy). Para AdMob → CMP certificado (Google UMP) con mensaje GDPR configurado; sin él Google limita anuncios.
- Transferencias fuera del EEE: mencionarlas y su mecanismo (cláusulas contractuales tipo, Data Privacy Framework).
- Edad de consentimiento digital 13–16 según país.
- Si se apunta a ese mercado sin establecimiento: posiblemente representante en la UE (art. 27) — marcar "verificar".

## Estados Unidos

- **COPPA**: si la app se dirige a menores de 13 o sabe que los tiene, consentimiento parental verificable. La salida más común: términos 18+ (o 13+) y no dirigirse a menores.
- **Leyes estatales** (California CCPA/CPRA, Virginia, Colorado, Connecticut, Utah, Texas, etc.): derecho a saber, borrar, corregir y **optar por no "vender/compartir"** datos para publicidad dirigida. Para AdMob: mensaje de "regulaciones de estados de EE. UU." en UMP.
- California exige "Do Not Sell or Share" si aplica y describir categorías de datos.

## Brasil — LGPD

Similar a GDPR: bases legales, derechos (incluida portabilidad), encarregado (DPO) con contacto publicado, notificación de incidentes a la ANPD.

## Latinoamérica (selección)

| País | Norma | Puntos prácticos |
|---|---|---|
| República Dominicana | Ley 172-13 | Consentimiento informado, derechos de acceso/rectificación/cancelación/oposición (y habeas data), seguridad, informar cesiones a terceros. Consumidor: **Ley 358-05** (información clara de precio, condiciones y cancelación). |
| México | LFPDPPP | Aviso de privacidad (integral/simplificado), derechos ARCO, transferencias. |
| Colombia | Ley 1581 de 2012 | Autorización previa y expresa, política de tratamiento, registro de bases ante la SIC si aplica. |
| Argentina | Ley 25.326 | Registro de bases (AAIP), consentimiento, derechos de acceso. |
| Chile | Ley 19.628 (y reforma 21.719) | Consentimiento, derechos ARCO+; nueva agencia de protección de datos. |
| Perú | Ley 29733 | Consentimiento, registro de bancos de datos. |

## Menores — criterio práctico

- Si la app tiene contenido o mecánicas para adultos (dinero, apuestas, contenido maduro, chat abierto) → **18+** en términos, casilla de confirmación en el registro, aviso de edad en el login social, y clasificación de contenido coherente en las tiendas.
- Si puede haber menores → revisar COPPA/GDPR-K, Families Policy de Google Play, Kids Category de Apple, y `tagForChildDirectedTreatment` / `tagForUnderAgeOfConsent` en el SDK de anuncios.

## Cómo convertir esto en hallazgos

Para cada mercado aplicable, recorre el núcleo común contra el inventario y los textos:
- ¿La política nombra cada dato, tercero y transferencia? (transparencia)
- ¿Hay datos recogidos sin uso? (minimización)
- ¿Cada derecho tiene un camino real (pantalla, endpoint o correo que existe)? (derechos)
- ¿Hay consentimiento antes de la publicidad personalizada donde se exige? (consentimiento)
- ¿El borrado borra lo que la política promete? (supresión)
- ¿El contacto de privacidad es un buzón que funciona y es el mismo en todas las páginas?
