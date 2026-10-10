#!/usr/bin/env python3
"""Inventario de imágenes: peso, dimensiones reales y total.

Las dimensiones son el dato que importa: revelan cuánto está sobredimensionado
un asset respecto del tamaño al que se dibuja. Un ícono de 1024x1024 que se
muestra en un avatar de 40 px no es un problema de compresión, es un problema
de resolución — y no se ve mirando solamente el peso.

Lee cabeceras PNG/JPEG/WebP/GIF a mano para no depender de Pillow, que no
siempre está instalado.

Uso:
    python asset_inventory.py assets/
    python asset_inventory.py assets/ --top 40
"""

import sys

# La consola de Windows usa cp1252 por defecto y rompe los acentos de la salida.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import argparse
import os
import struct

EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}


def png_size(fp):
    fp.seek(16)
    return struct.unpack(">II", fp.read(8))


def gif_size(fp):
    fp.seek(6)
    return struct.unpack("<HH", fp.read(4))


def bmp_size(fp):
    fp.seek(18)
    w, h = struct.unpack("<ii", fp.read(8))
    return w, abs(h)


def jpeg_size(fp):
    fp.seek(2)
    while True:
        b = fp.read(1)
        if not b:
            break
        if b != b"\xff":
            continue
        marker = fp.read(1)
        while marker == b"\xff":
            marker = fp.read(1)
        if not marker:
            break
        m = marker[0]
        # SOF0..SOF15, salteando los marcadores que no llevan dimensiones
        if m in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
                 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            fp.read(3)
            h, w = struct.unpack(">HH", fp.read(4))
            return w, h
        if m in (0xD8, 0xD9) or 0xD0 <= m <= 0xD7:
            continue
        length = struct.unpack(">H", fp.read(2))[0]
        fp.seek(length - 2, os.SEEK_CUR)
    raise ValueError("no SOF marker")


def webp_size(fp):
    fp.seek(12)
    chunk = fp.read(4)
    if chunk == b"VP8 ":
        fp.seek(26)
        w, h = struct.unpack("<HH", fp.read(4))
        return w & 0x3FFF, h & 0x3FFF
    if chunk == b"VP8L":
        fp.seek(21)
        bits = struct.unpack("<I", fp.read(4))[0]
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    if chunk == b"VP8X":
        fp.seek(24)
        d = fp.read(6)
        w = (d[0] | d[1] << 8 | d[2] << 16) + 1
        h = (d[3] | d[4] << 8 | d[5] << 16) + 1
        return w, h
    raise ValueError("unknown webp chunk")


READERS = {
    ".png": png_size, ".gif": gif_size, ".bmp": bmp_size,
    ".jpg": jpeg_size, ".jpeg": jpeg_size, ".webp": webp_size,
}


def dimensions(path):
    ext = os.path.splitext(path)[1].lower()
    try:
        with open(path, "rb") as fp:
            return READERS[ext](fp)
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("root", help="directorio a inventariar")
    ap.add_argument("--top", type=int, default=30, help="cuántos listar (default 30)")
    args = ap.parse_args()

    rows, by_dir = [], {}
    for dirpath, _, names in os.walk(args.root):
        for n in names:
            if os.path.splitext(n)[1].lower() not in EXTS:
                continue
            p = os.path.join(dirpath, n)
            size = os.path.getsize(p)
            rows.append((size, dimensions(p), p))
            by_dir[dirpath] = by_dir.get(dirpath, 0) + size

    if not rows:
        print(f"No se encontraron imágenes en {args.root}")
        return 0

    rows.sort(reverse=True, key=lambda r: r[0])
    total = sum(r[0] for r in rows)

    print(f"{len(rows)} imágenes · {total / 1048576:.1f} MB en total\n")

    print("Por carpeta:")
    for d, s in sorted(by_dir.items(), key=lambda kv: -kv[1]):
        print(f"  {s / 1048576:7.2f} MB  {d}")

    print(f"\nLas {min(args.top, len(rows))} más pesadas:")
    print(f"  {'PESO':>9}  {'DIMENSIONES':>13}  ARCHIVO")
    for size, dim, path in rows[:args.top]:
        d = f"{dim[0]}x{dim[1]}" if dim else "?"
        print(f"  {size / 1024:7.0f}KB  {d:>13}  {path}")

    print("\nPregunta clave para cada una: ¿a qué tamaño se dibuja en pantalla?")
    print("Buscá el asset en lib/ y mirá su width/height (o si llena el ancho).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
