#!/usr/bin/env python3
"""Desglosa un .aab/.apk y estima el tamaño que el usuario realmente descarga.

El tamaño del archivo engaña. En un .aab:

  - BUNDLE-METADATA/ (símbolos de debug + mapping de R8) nunca se descarga.
  - base/lib/<abi>/ trae las tres ABIs y cada dispositivo baja una sola.

Un .aab de 53 MB puede entregar ~15 MB. Reportar los 53 como "lo que pesa la
app" exagera 3x y desorienta la priorización.

También sirve para confirmar que un reemplazo de assets llegó al artefacto
(--assets), que es donde se detecta que un build quedó viejo.

Uso:
    python aab_breakdown.py build/app/outputs/bundle/release/app-release.aab
    python aab_breakdown.py build/app/outputs/flutter-apk/app-release.apk --assets
"""

import sys

# La consola de Windows usa cp1252 por defecto y rompe los acentos de la salida.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import argparse
import collections
import os
import zipfile

ABIS = ("arm64-v8a", "armeabi-v7a", "x86_64", "x86")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("archive", help=".aab o .apk")
    ap.add_argument("--assets", action="store_true",
                    help="listar también los assets de Flutter empaquetados")
    ap.add_argument("--abi", default="arm64-v8a",
                    help="ABI a contar para el tamaño entregado (default arm64-v8a)")
    args = ap.parse_args()

    if not os.path.exists(args.archive):
        sys.exit(f"No existe: {args.archive}")

    z = zipfile.ZipFile(args.archive)
    infos = z.infolist()
    total = sum(i.compress_size for i in infos)

    groups = collections.Counter()
    for i in infos:
        parts = i.filename.split("/")
        key = "/".join(parts[:3]) if len(parts) > 2 else i.filename
        groups[key] += i.compress_size

    print(f"{os.path.basename(args.archive)} — {total / 1048576:.1f} MB comprimido\n")
    print("Composición:")
    for k, v in groups.most_common(20):
        print(f"  {v / 1048576:7.2f} MB  {k}")

    # Lo que NO se entrega
    metadata = sum(i.compress_size for i in infos
                   if i.filename.startswith("BUNDLE-METADATA/"))
    other_abis = sum(i.compress_size for i in infos
                     if any(f"lib/{a}/" in i.filename for a in ABIS if a != args.abi))
    delivered = total - metadata - other_abis

    print("\nEstimación de lo que descarga un dispositivo:")
    print(f"  archivo completo          {total / 1048576:7.2f} MB")
    if metadata:
        print(f"  - BUNDLE-METADATA         -{metadata / 1048576:6.2f} MB  (símbolos/mapping, no se entrega)")
    if other_abis:
        print(f"  - otras ABIs              -{other_abis / 1048576:6.2f} MB  (cada equipo baja una)")
    print(f"  {'=' * 26}")
    print(f"  entregado (~{args.abi})   {delivered / 1048576:7.2f} MB")

    if metadata or other_abis:
        print("\n  Para un número medido en vez de estimado, construí una sola ABI:")
        print("    flutter build apk --release --target-platform android-arm64")

    if args.assets:
        fa = [i for i in infos if "flutter_assets/" in i.filename]
        if fa:
            by = collections.Counter()
            for i in fa:
                rel = i.filename.split("flutter_assets/", 1)[1]
                by["/".join(rel.split("/")[:3]) if "/" in rel else rel] += i.compress_size
            print(f"\nflutter_assets ({sum(i.compress_size for i in fa) / 1048576:.2f} MB):")
            for k, v in by.most_common(25):
                print(f"  {v / 1024:8.0f} KB  {k}")

            exts = collections.Counter(os.path.splitext(i.filename)[1].lower() for i in fa)
            print("\n  Por extensión: " + ", ".join(
                f"{e or '(sin)'}={n}" for e, n in exts.most_common(8)))
            leftover = sum(n for e, n in exts.items() if e in (".jpg", ".jpeg", ".png"))
            if leftover:
                print(f"  {leftover} archivo(s) JPG/PNG — candidatos a WebP, o restos de un build viejo.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
