#!/usr/bin/env python3
"""Trim transparent padding, standardize canvas per folder, export WebP, delete originals."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "public" / "imgs"

CANVAS_POR_PASTA = {
    "Sousplat": 600,
    "Pratos Rasos": 600,
    "Pratos Fundos": 600,
    "Pratos de sobremesa": 600,
    "Porta Guardanapos": 400,
    "Taças": 400,
}

MARGEM = 0.02  # 2% padding around object
QUALIDADE = 82
EXTENSOES = {".png", ".jpg", ".jpeg", ".webp"}


def trim_alpha(im: Image.Image) -> Image.Image:
    rgba = im.convert("RGBA")
    bbox = rgba.getbbox()
    if not bbox:
        return rgba
    return rgba.crop(bbox)


def encaixar_no_canvas(objeto: Image.Image, lado: int) -> Image.Image:
    canvas = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    util = int(lado * (1 - 2 * MARGEM))
    ow, oh = objeto.size
    if ow == 0 or oh == 0:
        return canvas

    escala = min(util / ow, util / oh)
    nw = max(1, int(round(ow * escala)))
    nh = max(1, int(round(oh * escala)))
    redimensionado = objeto.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (lado - nw) // 2
    y = (lado - nh) // 2
    canvas.paste(redimensionado, (x, y), redimensionado)
    return canvas


def processar_arquivo(caminho: Path, lado: int) -> Path | None:
    stem = caminho.stem
    destino = caminho.with_name(f"{stem}.webp")

    with Image.open(caminho) as im:
        aparado = trim_alpha(im)
        # Cópia em memória antes de sobrescrever o mesmo arquivo
        aparado.load()
        final = encaixar_no_canvas(aparado, lado)

    final.save(destino, "WEBP", quality=QUALIDADE, method=6)

    if caminho.resolve() != destino.resolve() and caminho.exists():
        caminho.unlink()

    return destino


def main() -> int:
    if not ROOT.is_dir():
        print(f"Pasta não encontrada: {ROOT}", file=sys.stderr)
        return 1

    total_antes = 0
    total_depois = 0
    convertidos = 0

    for pasta in sorted(ROOT.iterdir()):
        if not pasta.is_dir():
            continue
        lado = CANVAS_POR_PASTA.get(pasta.name)
        if lado is None:
            print(f"Ignorando pasta sem mapeamento: {pasta.name}")
            continue

        arquivos = sorted(
            f
            for f in pasta.iterdir()
            if f.is_file() and f.suffix.lower() in EXTENSOES and f.name != "desktop.ini"
        )
        print(f"\n## {pasta.name} → {lado}×{lado} ({len(arquivos)} arquivos)")

        for arquivo in arquivos:
            antes = arquivo.stat().st_size
            total_antes += antes
            try:
                destino = processar_arquivo(arquivo, lado)
            except Exception as exc:  # noqa: BLE001
                print(f"  ERRO {arquivo.name}: {exc}", file=sys.stderr)
                continue
            depois = destino.stat().st_size
            total_depois += depois
            convertidos += 1
            print(
                f"  {arquivo.name} → {destino.name} "
                f"({antes / 1024 / 1024:.1f}MB → {depois / 1024:.0f}KB)"
            )

    print(
        f"\nConcluído: {convertidos} imagens | "
        f"{total_antes / 1024 / 1024:.1f}MB → {total_depois / 1024 / 1024:.1f}MB"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
