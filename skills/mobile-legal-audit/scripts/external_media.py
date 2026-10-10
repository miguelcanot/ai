#!/usr/bin/env python3
"""Detecta imágenes y medios cargados desde dominios de terceros.

Uso:  python external_media.py <raíz-del-proyecto> [--all]

Busca URLs en código, seeds, scrapers, JSON y HTML, y las agrupa por dominio.
Marca como "riesgo alto" los dominios de titulares conocidos (ligas, medios,
CDNs de marcas) y como "revisar" cualquier URL que parezca una imagen o venga de
un CDN. Lo que importa no es la URL en sí sino de quién es el contenido: una
foto oficial o un logo sin licencia es un hallazgo aunque sea públicamente
accesible.

Con --all lista también los dominios que no parecen medios (APIs, docs).
"""
from __future__ import annotations

import os
import re
import sys
from collections import defaultdict
from pathlib import Path

SKIP_DIRS = {"node_modules", ".git", "build", ".dart_tool", "Pods", ".gradle", "dist",
             ".next", ".venv", "venv", "__pycache__", "DerivedData", ".idea"}
SUFFIXES = (".dart", ".ts", ".tsx", ".js", ".jsx", ".kt", ".java", ".swift", ".py",
            ".json", ".yaml", ".yml", ".html", ".css", ".md", ".xml", ".plist", ".env.example")

# Lockfiles: URLs de registros de paquetes, no contenido de la app.
LOCKFILES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "pubspec.lock", "Podfile.lock",
             "Package.resolved", "composer.lock", "Gemfile.lock", "poetry.lock"}

URL_RX = re.compile(r"https?://[^\s'\"<>)\]}`]+", re.I)
IMAGE_HINT = re.compile(r"\.(png|jpe?g|gif|webp|svg|avif)(\?|$)|/image[s]?/|/img/|/photos?/|headshot|logo|avatar|thumbnail|/media/|cdn|static|upload", re.I)

# Titulares conocidos de contenido con derechos (ampliable).
HIGH_RISK = re.compile(
    r"mlbstatic|mlb\.com|milb\.com|nba\.com|cdn\.nba|nfl\.com|static\.www\.nfl|nhl\.com|espncdn|espn\.com|"
    r"fifa\.com|uefa\.com|laliga|premierleague|bundesliga|legaseriea|ligamx|conmebol|"
    r"lidom|cbssports|foxsports|bleacherreport|sportradar|gettyimages|shutterstock|istockphoto|"
    r"apimg\.|reuters|apnews|imdb|tmdb\.org|image\.tmdb|spotify|scdn\.co|ytimg|instagram|fbcdn|twimg|pbs\.twimg",
    re.I,
)
# Dominios típicos de infraestructura o documentación que no son contenido.
BENIGN = re.compile(
    r"googleapis\.com/(?!.*\.(png|jpe?g|svg))|schemas\.android|w3\.org|apple\.com/DTDs|example\.(com|org)|localhost|127\.0\.0\.1|"
    r"github\.com|pub\.dev|npmjs|developer\.|docs\.|flutter\.dev|dart\.dev|cdnjs\.cloudflare|jsdelivr|unpkg|fonts\.g",
    re.I,
)


def walk(root: Path):
    for dirpath, dirnames, filenames in os.walk(root):
        compiled = {"lib", "out"} if (Path(dirpath) / "tsconfig.json").exists() else set()
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and d not in compiled and not d.startswith(".")]
        for f in filenames:
            if f.endswith(SUFFIXES) and f not in LOCKFILES:
                yield Path(dirpath) / f


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    show_all = "--all" in sys.argv
    root = Path(args[0] if args else ".").resolve()

    by_domain: dict[str, list[tuple[str, int, str]]] = defaultdict(list)
    for f in walk(root):
        try:
            lines = f.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue
        rel = f.relative_to(root).as_posix()
        for n, line in enumerate(lines, 1):
            for url in URL_RX.findall(line):
                domain = re.sub(r"^https?://", "", url).split("/")[0].lower()
                by_domain[domain].append((rel, n, url))

    high, review, other = [], [], []
    for domain, hits in by_domain.items():
        urls = " ".join(h[2] for h in hits)
        if HIGH_RISK.search(domain) or HIGH_RISK.search(urls):
            high.append(domain)
        elif BENIGN.search(domain):
            other.append(domain)
        elif any(IMAGE_HINT.search(h[2]) for h in hits):
            review.append(domain)
        else:
            other.append(domain)

    def dump(title: str, domains: list[str], limit: int = 6) -> None:
        print(f"## {title}\n")
        if not domains:
            print("_Ninguno._\n")
            return
        for d in sorted(domains, key=lambda d: -len(by_domain[d])):
            hits = by_domain[d]
            print(f"### `{d}` — {len(hits)} referencia(s)")
            for rel, n, url in hits[:limit]:
                print(f"- `{rel}:{n}` — {url[:140]}")
            if len(hits) > limit:
                print(f"- … y {len(hits) - limit} más")
            print()

    print(f"# Medios externos — {root.name}\n")
    print("Recuerda revisar también la BASE DE DATOS (URLs ya sembradas) y las capturas de marketing.\n")
    dump("Riesgo alto: titulares conocidos de contenido con derechos", high)
    dump("Revisar: parecen imágenes/medios de terceros", review)
    if show_all:
        dump("Otros dominios (APIs, documentación, infraestructura)", other, limit=3)
    else:
        print(f"_{len(other)} dominios más (APIs/docs/infraestructura) omitidos; usa --all para verlos._")


if __name__ == "__main__":
    main()
