# Tamaño del bundle — qué buscar

Checklist para una app Flutter. Ordenado por retorno: en la práctica los assets suelen ser el 80% del problema y casi nadie los mira.

## 1. Assets (casi siempre el hallazgo más grande)

```bash
python <dir-de-la-skill>/scripts/asset_inventory.py assets/
```

El script lista peso + **dimensiones reales**, que es el dato que importa. La pregunta no es "¿cuánto pesa?" sino **"¿a qué tamaño se dibuja?"**. Un ícono de 1024×1024 que se muestra en un avatar de 40 px está 25× sobredimensionado.

Para averiguar el tamaño de dibujado, busca dónde se usa cada asset y con qué `width`/`height`, o si llena el ancho de pantalla (tope útil: ~1080 px físicos).

Tres acciones, en este orden:

1. **Borrar los que no se referencian.** Busca con grep cada nombre de archivo contra `lib/`. Un asset sin referencias es peso puro.
2. **Redimensionar al tamaño de uso** (con holgura para pantallas 2-3×).
3. **Convertir a WebP.** Flutter lo lee nativamente. Para fotos y arte con degradados, WebP q80-85 baja un orden de magnitud respecto de PNG.

```bash
python <dir-de-la-skill>/scripts/optimize_images.py assets/images/banners --max-width 800 --quality 82
```

El script reporta **PSNR** contra el original. Por encima de ~35 dB es visualmente indistinguible; por debajo de 30, míralo antes de aceptar. **Copia los originales a un directorio fuera del repo antes de sobrescribir.**

Convertir cambia la extensión: acordate de actualizar las referencias en Dart, incluidas las que se arman dinámicamente (`'assets/images/icons/$id.jpg'`) y los comentarios de doc.

### PNG que tienen que seguir siendo PNG

Si algo alimenta a un generador (ej. `flutter_launcher_icons`) o necesita transparencia en un contexto que no acepta WebP, dejalo en PNG pero cuantizalo:

```bash
python <dir-de-la-skill>/scripts/optimize_images.py landing/assets --quantize --max-width 840
```

Cuantizar a 256 colores con dithering Floyd-Steinberg suele dar 3× de reducción con PSNR > 37 dB.

### Entradas de build que no deberían empaquetarse

Un PNG de 1024×1024 que solo existe para generar el ícono del launcher no tiene por qué viajar en el bundle. Movelo fuera de la carpeta declarada en `assets:` (ej. `tool/launcher_icon/`) y apunta ahí la config del generador. Lo que la app muestra debería ser una copia chica aparte.

## 2. Dependencias declaradas que nadie usa

```bash
bash <dir-de-la-skill>/scripts/unused_deps.sh [ruta-al-proyecto]   # por defecto, el directorio actual
```

Grepear solo `import 'package:x'` no alcanza cuando hay re-exports; el script busca también los símbolos característicos de cada paquete.

Pesan distinto según qué arrastren. Las caras son las que traen código nativo o dependencias transitivas grandes (un cliente HTTP con cache trae su gestor de cache y SQLite; un selector de imágenes trae plugins nativos **y permisos en el manifest**, lo cual también afecta la ficha de tienda).

Antes de borrar, confirma con una búsqueda de símbolos, no solo del nombre del paquete.

## 3. Fuentes descargadas en runtime

```bash
grep -rn "GoogleFonts\." lib --include=*.dart | head
```

`google_fonts` baja los `.ttf` desde fonts.gstatic.com en el primer arranque: una request de red en el camino crítico de inicio, un flash con la fuente de fallback, y tipografía incorrecta si el usuario abre la app sin datos.

Empaquetarlas es mejor, y **subseteadas** casi no pesan. Los TTF completos traen charsets enormes; recortados a latino bajan ~85%:

```bash
python -m fontTools.subset Inter-Regular.ttf \
  --unicodes="U+0000-00FF,U+0100-017F,U+0180-024F,U+2000-206F,U+20A0-20BF" \
  --layout-features="kern,liga,clig,calt,ccmp,locl,mark,mkmk" \
  --output-file=Inter-Regular.subset.ttf
```

Averigua qué pesos se usan de verdad antes de empaquetar siete:

```bash
grep -rho "FontWeight.w[0-9]*" lib --include=*.dart | sort | uniq -c
```

Para reemplazar el paquete sin tocar 200 call sites, haz un shim que imite su API (`AppFonts.inter(...)` con la misma firma) y cambia solo el import y el nombre de la clase.

## 4. Decodificación de imágenes (RAM, no bundle)

```bash
grep -rn "Image.asset" lib --include=*.dart | wc -l
grep -rn "cacheWidth\|cacheHeight\|ResizeImage" lib --include=*.dart | wc -l
```

Si el segundo número es 0, hay un problema de memoria. `width`/`height` en un `Image` **solo afectan el layout**: Flutter decodifica el archivo a resolución nativa igual. Un JPEG de 1024×1024 son ~4 MB de RGBA en el image cache, para dibujar un círculo de 40 px.

```dart
Image.asset(
  path,
  width: size, height: size,
  cacheWidth: (size * MediaQuery.devicePixelRatioOf(context)).round(),
)
```

Conviene centralizarlo en un helper y usarlo en todos los `Image.asset`. Para fondos que llenan la pantalla, el ancho lógico de la pantalla es el tope correcto.

## 5. R8 / minificación en Android

```bash
grep -n "isMinifyEnabled\|isShrinkResources" android/app/build.gradle.kts
```

El código Dart ya viene compilado AOT, pero el lado Java/Kotlin (Firebase, AdMob, SDKs de pago, Socket.io, plugins) no. R8 lo minifica.

```kotlin
release {
    isMinifyEnabled = true
    isShrinkResources = true
    proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
}
```

**Las reglas `-keep` no son opcionales.** Todo lo que se resuelve por reflexión o desde código nativo es invisible para R8: compila bien y falla en runtime, que es la forma más cara de fallar. Cubre como mínimo Firebase, los SDKs de anuncios y de compras (kotlinx.serialization busca sus serializers por nombre de clase), y las librerías que usan Gson.

**`-dontwarn com.google.android.play.core.**` es obligatorio** aunque la app no use componentes diferidos: el embedding de Flutter los referencia, la librería no está en el classpath, y R8 aborta con "missing classes".

Conserva `SourceFile,LineNumberTable` para que los stack traces de Play Console sigan siendo legibles.

**R8 exige smoke test en dispositivo**, no alcanza con que compile. Prueba login, compras y push — los tres caminos de reflexión más frágiles.

## 6. Medir el tamaño **entregado**, no el del artefacto

```bash
python <dir-de-la-skill>/scripts/aab_breakdown.py build/app/outputs/bundle/release/app-release.aab
```

Un `.aab` de 53 MB puede entregar ~15 MB:

- **`BUNDLE-METADATA/`** (símbolos de debug + mapping de R8) no se descarga nunca. Pueden ser 18 MB.
- **`base/lib/<abi>/`** trae las tres ABIs; cada dispositivo baja una. El script cuenta `arm64-v8a` por defecto; usa `--abi armeabi-v7a` (u otra) para estimar la descarga de otro tipo de dispositivo.

Reportar el tamaño del `.aab` como "lo que pesa la app" exagera 3×. Para un número cercano al real, construye un APK de una sola ABI:

```bash
flutter build apk --release --target-platform android-arm64
```

Verifica también qué quedó adentro, que es la forma de detectar que un reemplazo de assets no se aplicó:

```bash
python <dir-de-la-skill>/scripts/aab_breakdown.py <apk-o-aab> --assets
```

## 7. Trampas al reemplazar assets

**Aspect ratio.** Si el reemplazo no tiene la misma proporción que el anterior, revisa todo lo que la asumía. Un `BoxFit.cover` dentro de una caja cuadrada es inofensivo con un asset cuadrado y recorta con uno que no lo es. Lo mismo con `object-fit: cover` en CSS, y con cualquier `object-position` que alguien haya afinado a mano.

**Íconos de launcher.** Dos requisitos que se olvidan:

- **iOS rechaza íconos con canal alfa.** Si el logo es un PNG transparente hay que aplanarlo (`remove_alpha_ios: true` + un `background_color_ios` que combine, no el blanco por defecto).
- **Android necesita ícono adaptativo.** Sin él, el sistema mete el ícono legacy en una plaqueta con el contenido encogido. Y el foreground necesita mucho más margen del que parece: `flutter_launcher_icons` agrega un inset del 16% por lado (queda el 68% del lienzo) y la zona segura de las máscaras es el 61% central — o sea que el logo tiene que ocupar ~90% de la imagen de foreground para aterrizar ahí. Conviene que sea una imagen distinta de `image_path`.
