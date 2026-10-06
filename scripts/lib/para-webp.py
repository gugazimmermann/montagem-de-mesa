#!/usr/bin/env python3
"""Redimensiona uma foto de item e grava WebP (caber no limite de 5 MB do bucket)."""

import sys
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

src, dest = sys.argv[1], sys.argv[2]
max_side = int(sys.argv[3]) if len(sys.argv) > 3 else 1600
quality = int(sys.argv[4]) if len(sys.argv) > 4 else 80

with Image.open(src) as im:
    rgba = im.convert("RGBA")
    w, h = rgba.size
    maior = max(w, h)
    if maior > max_side:
        escala = max_side / maior
        rgba = rgba.resize(
            (max(1, round(w * escala)), max(1, round(h * escala))),
            Image.Resampling.LANCZOS,
        )
    rgba.save(dest, "WEBP", quality=quality, method=4)
