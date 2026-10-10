# Monetización: anuncios, consentimiento, suscripciones y juegos de azar

## Anuncios (AdMob y similares)

### Consentimiento — Google UMP (User Messaging Platform)

Google exige un CMP certificado para servir anuncios en el **EEE, Reino Unido y Suiza** (GDPR) y mensajes para **estados regulados de EE. UU.**. Fuera de esas regiones el SDK responde "no requerido" y no muestra nada, así que integrarlo no molesta a usuarios de otros mercados.

Implementación correcta (patrón verificado en Flutter con `google_mobile_ads`; los nombres son equivalentes en Android/iOS nativo):

1. **No bloquear el arranque**: lanzar la inicialización de anuncios sin `await` antes de `runApp`. El formulario y el prompt de ATT necesitan la app visible.
2. `ConsentInformation.requestConsentInfoUpdate(params)` → en el éxito, `ConsentForm.loadAndShowConsentFormIfRequired`.
3. **Después** del consentimiento, en iOS pedir ATT si el estado es `notDetermined`.
4. `canRequestAds()` → solo si es `true`, `MobileAds.initialize()` y cargar anuncios. Los métodos que crean banners/nativos/intersticiales esperan a que la inicialización termine.
5. `getPrivacyOptionsRequirementStatus()` → si es `required`, mostrar en Ajustes **"Opciones de privacidad de anuncios"** que llama `showPrivacyOptionsForm`. Como se resuelve después del primer frame, exponerlo como observable (ValueNotifier/StateFlow/estado) para que la UI se actualice.
6. Al cerrar el formulario de opciones: releer `canRequestAds()`; si ahora es `false`, descartar el intersticial precargado; si pasó a `true` y el SDK no estaba iniciado, iniciarlo.
7. **Pruebas** (solo en debug): `ConsentDebugSettings(debugGeography: EEA | regulatedUsState, testIdentifiers: [hash del dispositivo que imprime el SDK en logcat/Xcode])` y `ConsentInformation.reset()` para volver a ver el formulario. Exponerlo vía flags de compilación, nunca activo en release.
8. **Fuera del código**: crear y publicar los mensajes en AdMob → Privacidad y mensajes (GDPR, estados de EE. UU., y en iOS el explicativo de IDFA). Sin mensajes publicados, el SDK no muestra nada.

Hallazgos típicos: SDK de anuncios inicializado antes del consentimiento; inicialización bloqueante en `main`; sin opción para cambiar la elección; ATT pedido antes de que la app esté visible; política de privacidad que dice "no compartimos datos con publicidad".

### ATT (iOS)

- `NSUserTrackingUsageDescription` claro ("solo para anuncios más relevantes; sin permiso verás anuncios no personalizados").
- El manifiesto de privacidad declara `NSPrivacyTracking = true` y los tipos usados para rastreo (Device ID, Advertising Data).

### Anuncios propios

Un carrusel de banners propios sin SDK de terceros ni identificadores no requiere consentimiento, pero la política puede mencionarlo ("anuncios propios que no usan datos personales").

## Suscripciones y compras

Divulgaciones mínimas en el **paywall**, antes del botón de compra (Apple 3.1.2, Google Play, leyes de consumo):

- Nombre del plan y **precio por período** ("RD$199 / mes"; derivar el período del producto, p. ej. ISO 8601 `P1M`).
- **Renovación automática** hasta cancelar; cobro a la cuenta de la tienda al confirmar y en cada renovación; cancelar al menos 24 h antes del fin del período.
- **Cómo cancelar** (ajustes de la cuenta de la tienda).
- **Borrar la cuenta o la app no cancela la suscripción** — repetirlo en el diálogo de borrado de cuenta y en la página web de borrado.
- Enlaces a **Términos** y **Privacidad**.
- Botón **Restaurar compras** (Apple lo exige en la práctica).

Otros:
- La fuente de verdad del estado premium debe ser el servidor (webhook + reconciliación con el proveedor), nunca el cliente.
- Si premium da **ventaja competitiva** en un juego con ranking, revisar la percepción de "pay to win" y, combinado con premios, el riesgo de juego de azar.
- Reembolsos: los gestiona la tienda; los términos deben remitir a ella sin negar derechos del consumidor locales.

## Juegos de azar, sorteos y fantasy

Un juego queda **fuera** de la regulación de apuestas cuando **no hay pago por participar ni premio con valor económico**. Si hay ambos (y azar o habilidad según el país), es apuesta/concurso regulado: requiere licencia por jurisdicción y Google Play/Apple lo restringen fuertemente.

Señales a buscar en el código:
- Cuotas de entrada, pozos, "buy-in", ligas pagas.
- Monedas o puntos virtuales **canjeables** por dinero, gift cards o bienes (aunque se ganen jugando).
- Cajas de botín (loot boxes) pagas: varios países exigen publicar probabilidades o las prohíben.
- Premios en metálico para el ganador de una liga/sorteo.

Si nada de esto existe, el informe debe decirlo como **cumplimiento** e indicar la condición que lo rompería, y los términos deben declararlo ("no involucra dinero real; puntos sin valor monetario, no canjeables ni transferibles").
