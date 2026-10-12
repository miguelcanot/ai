#!/usr/bin/env bash
# Dependencias de pubspec.yaml que ningún archivo de lib/ parece usar.
#
# Grepear solo `import 'package:x'` deja falsos positivos cuando hay
# re-exports o cuando el paquete se usa a través de otro. Por eso este script
# busca también los símbolos característicos de los paquetes más comunes, y
# marca como "revisar" en vez de "borrar" lo que no puede confirmar.
#
# La salida es una lista de candidatos, NO una orden de borrado: confirma cada
# uno antes de sacarlo.
#
# Uso:  bash unused_deps.sh [ruta-al-proyecto]

set -uo pipefail
ROOT="${1:-.}"
PUBSPEC="$ROOT/pubspec.yaml"
LIB="$ROOT/lib"

[ -f "$PUBSPEC" ] || { echo "No se encontró $PUBSPEC"; exit 1; }
[ -d "$LIB" ] || { echo "No se encontró $LIB"; exit 1; }

# Símbolos característicos de paquetes que no siempre se importan por nombre
symbols_for() {
  case "$1" in
    cached_network_image)          echo "CachedNetworkImage" ;;
    fl_chart)                      echo "LineChart|BarChart|PieChart|ScatterChart|RadarChart" ;;
    lottie)                        echo "Lottie\." ;;
    image_picker)                  echo "ImagePicker" ;;
    hive|hive_flutter)             echo "Hive\.|HiveField|Box<" ;;
    flutter_staggered_animations)  echo "AnimationConfiguration" ;;
    google_fonts)                  echo "GoogleFonts\." ;;
    url_launcher)                  echo "launchUrl|canLaunchUrl" ;;
    wakelock_plus)                 echo "WakelockPlus" ;;
    shared_preferences)            echo "SharedPreferences" ;;
    intl)                          echo "DateFormat|NumberFormat|Intl\." ;;
    provider)                      echo "ChangeNotifierProvider|context\.watch|context\.read" ;;
    dio)                           echo "Dio(|DioException" ;;
    *)                             echo "" ;;
  esac
}

# Paquetes que se usan sin aparecer en lib/ (build-time, plataforma, transitivos)
is_infrastructure() {
  case "$1" in
    flutter|flutter_test|flutter_localizations|flutter_lints|cupertino_icons|\
    build_runner|freezed|json_serializable|riverpod_generator|very_good_analysis|\
    flutter_launcher_icons|flutter_native_splash|freezed_annotation|json_annotation|\
    riverpod_annotation|firebase_core|integration_test) return 0 ;;
    *) return 1 ;;
  esac
}

echo "Analizando dependencias de $PUBSPEC contra $LIB ..."
echo

unused=(); review=()

deps=$(awk '
  /^dependencies:/      {s=1; next}
  /^dev_dependencies:/  {s=1; next}
  /^[a-z_]+:/           {s=0}
  s && /^  [a-z0-9_]+:/ {gsub(/[: ]/,"",$1); print $1}
' "$PUBSPEC" | sort -u)

for dep in $deps; do
  is_infrastructure "$dep" && continue

  if grep -rqs "package:$dep" "$LIB" --include=*.dart; then
    continue
  fi

  syms=$(symbols_for "$dep")
  if [ -n "$syms" ]; then
    if grep -rqsE "$syms" "$LIB" --include=*.dart; then
      continue
    fi
    unused+=("$dep")          # sin import y sin símbolos: confianza alta
  else
    review+=("$dep")          # sin import, pero no sabemos qué símbolos buscar
  fi
done

if [ ${#unused[@]} -gt 0 ]; then
  echo "SIN USO (ni import ni símbolos característicos):"
  for d in "${unused[@]}"; do echo "  - $d"; done
  echo
fi

if [ ${#review[@]} -gt 0 ]; then
  echo "REVISAR (sin import en lib/, pero puede usarse desde código nativo,"
  echo "         configuración de plataforma, o con un símbolo desconocido):"
  for d in "${review[@]}"; do echo "  - $d"; done
  echo
fi

if [ ${#unused[@]} -eq 0 ] && [ ${#review[@]} -eq 0 ]; then
  echo "Todas las dependencias parecen estar en uso."
  exit 0
fi

cat <<'EOF'
Antes de borrar cualquiera:
  grep -rn "<símbolo>" lib --include=*.dart
  flutter pub get && flutter analyze     # después de sacarla

Pesan distinto: las caras son las que traen código nativo o dependencias
transitivas grandes (cache HTTP -> SQLite; selectores de archivos -> plugins
nativos y permisos en el manifest, que además afectan la ficha de tienda).
EOF
