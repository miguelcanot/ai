#!/usr/bin/env python3
"""Redimensiona y recomprime imágenes, reportando la pérdida de calidad (PSNR).

Recomprimir a ciegas es cómo se arruinan los assets de una app. Este script
mide PSNR contra el original de cada archivo para que la decisión sea
informada: >35 dB es visualmente indistinguible para fotos y arte, <30 dB
merece que mires el resultado antes de aceptarlo.

Hace backup de los originales antes de tocar nada (salvo --no-backup).

Requiere Pillow.

Uso:
    # Ver qué haría, sin escribir nada
    python optimize_images.py assets/images/banners --max-width 800 --dry-run

    # Convertir a WebP (borra el original tras convertir)
    python optimize_images.py assets/images/banners --max-width 800 --quality 82

    # Mantener PNG pero cuantizar (para lo que necesita seguir siendo PNG)
    python optimize_images.py landing/assets --quantize --max-width 840
"""

import sys

# La consola de Windows usa cp1252 por defecto y rompe los acentos de la salida.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import argparse
import math
import os
import shutil

try:
    from PIL import Image, ImageChops
except ImportError:
    sys.exit("Falta Pillow: pip install Pillow")

Image.MAX_IMAGE_PIXELS = None
EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def psnr(a, b):
    """PSNR entre dos imágenes del mismo tamaño. 99 = idénticas."""
    if a.size != b.size:
        b = b.resize(a.size, Image.LANCZOS)
    diff = ImageChops.difference(a.convert("RGB"), b.convert("RGB"))
    hist = diff.histogram()
    mse = sum(v * (i % 256) ** 2 for i, v in enumerate(hist)) / (a.width * a.height * 3)
    return 10 * math.log10(255 ** 2 / mse) if mse else 99.0


def fit(im, max_w, max_h):
    scale = 1.0
    if max_w:
        scale = min(scale, max_w / im.width)
    if max_h:
        scale = min(scale, max_h / im.height)
    if scale >= 1.0:
        return im
    return im.resize((max(1, round(im.width * scale)),
                      max(1, round(im.height * scale))), Image.LANCZOS)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("root")
    ap.add_argument("--max-width", type=int, help="ancho máximo en px")
    ap.add_argument("--max-height", type=int, help="alto máximo en px")
    ap.add_argument("--quality", type=int, default=82, help="calidad WebP (default 82)")
    ap.add_argument("--quantize", action="store_true",
                    help="mantener PNG y cuantizar a 256 colores en vez de convertir a WebP")
    ap.add_argument("--backup-dir", default=None,
                    help="dónde copiar los originales (default: <root>/../_originals)")
    ap.add_argument("--no-backup", action="store_true")
    ap.add_argument("--dry-run", action="store_true", help="solo reportar")
    args = ap.parse_args()

    files = [os.path.join(dp, n)
             for dp, _, ns in os.walk(args.root) for n in ns
             if os.path.splitext(n)[1].lower() in EXTS]
    if not files:
        print(f"No se encontraron imágenes en {args.root}")
        return 0

    backup = args.backup_dir or os.path.join(os.path.dirname(os.path.abspath(args.root)),
                                             "_originals")
    if not args.dry_run and not args.no_backup:
        os.makedirs(backup, exist_ok=True)
        print(f"Backup de los originales en: {backup}\n")

    before_total = after_total = 0
    worst = []

    for path in sorted(files):
        before = os.path.getsize(path)
        src = Image.open(path)
        has_alpha = "A" in src.mode
        orig = src.convert("RGBA" if has_alpha else "RGB")

        out = fit(orig, args.max_width, args.max_height)

        if args.quantize:
            new_path = path
            result = out.quantize(colors=256, method=Image.FASTOCTREE,
                                  dither=Image.FLOYDSTEINBERG).convert(out.mode)
            save = lambda p: result.save(p, "PNG", optimize=True)
        else:
            new_path = os.path.splitext(path)[0] + ".webp"
            result = out
            save = lambda p: result.save(p, "WEBP", quality=args.quality,
                                         method=6, exact=has_alpha)

        if args.dry_run:
            import io
            buf = io.BytesIO()
            result.save(buf, "PNG" if args.quantize else "WEBP",
                        **({"optimize": True} if args.quantize
                           else {"quality": args.quality, "method": 6}))
            after = buf.tell()
        else:
            if not args.no_backup:
                dest = os.path.join(backup, os.path.relpath(path, args.root))
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                shutil.copy2(path, dest)
            save(new_path)
            after = os.path.getsize(new_path)
            if new_path != path:
                os.remove(path)

        q = psnr(orig, result)
        before_total += before
        after_total += after
        worst.append((q, path))

        flag = "  <-- REVISAR" if q < 30 else ""
        print(f"{before // 1024:6d}KB -> {after // 1024:5d}KB  "
              f"{orig.width}x{orig.height} -> {result.width}x{result.height}  "
              f"PSNR {q:5.1f} dB  {os.path.basename(path)}{flag}")

    worst.sort()
    print(f"\nTOTAL: {before_total / 1048576:.1f} MB -> {after_total / 1048576:.1f} MB "
          f"({100 * (1 - after_total / before_total):.0f}% menos)")
    print(f"PSNR más bajo: {worst[0][0]:.1f} dB ({os.path.basename(worst[0][1])})")
    print("\n>35 dB visualmente indistinguible · <30 dB miralo antes de aceptar")

    if args.dry_run:
        print("\n(dry-run: no se escribió nada)")
    elif not args.quantize:
        print("\nLa extensión cambió a .webp — actualizá las referencias en el código,")
        print("incluidas las rutas que se arman dinámicamente ('.../$id.jpg').")
    return 0


if __name__ == "__main__":
    sys.exit(main())
