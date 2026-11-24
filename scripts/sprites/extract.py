"""Developer tool: turns the character reference sheets into pixel-art sprites.

    python scripts/sprites/extract.py <1.webp> <2.webp> [out_dir]

Step 1 of 2. Crops each character from the sheets, removes the card background, shrinks it to pixel-art size and
quantizes it, and writes a preview PNG per character so the crops can be checked by eye. Step 2 (`build.py`) turns the
quantized sprites into `src/core/art/sprites.js`. Needs Pillow and numpy (a developer machine only; the shipped
project has no dependencies).
"""
import json
import sys
from collections import deque

import numpy as np
from PIL import Image

# (sheet, id, crop box in the sheet's pixels, target size: max width, max height)
CROPS = [
    (0, 'classic', (18, 55, 305, 345), (50, 46)),
    (0, 'fox', (325, 75, 595, 345), (52, 44)),
    (0, 'bot', (640, 50, 900, 350), (46, 50)),
    (0, 'slime', (935, 100, 1210, 345), (54, 40)),
    (0, 'mage', (1240, 62, 1520, 350), (54, 50)),
    (1, 'aquatic', (100, 100, 492, 392), (56, 46)),
]


def background_mask(rgb, tolerance=44):
    tolerance = TOLERANCE.get(CURRENT[0], tolerance)
    """True for background: pixels connected to the crop's border that are close to the card color."""
    h, w, _ = rgb.shape
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    close = np.linalg.norm(rgb.astype(float) - bg, axis=2) < tolerance
    seen = np.zeros((h, w), bool)
    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            if close[y, x]:
                seen[y, x] = True; queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if close[y, x] and not seen[y, x]:
                seen[y, x] = True; queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and close[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; queue.append((ny, nx))
    return seen


def largest_pieces(mask, keep_ratio=0.02):
    """Keeps the main figure and any piece that is not tiny (a bubble, a star)."""
    h, w = mask.shape
    label = np.zeros((h, w), int)
    sizes = {}
    n = 0
    for sy in range(h):
        for sx in range(w):
            if mask[sy, sx] and not label[sy, sx]:
                n += 1
                label[sy, sx] = n
                q = deque([(sy, sx)])
                count = 0
                while q:
                    y, x = q.popleft(); count += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = y + dy, x + dx
                            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not label[ny, nx]:
                                label[ny, nx] = n; q.append((ny, nx))
                sizes[n] = count
    biggest = max(sizes.values())
    keep = {k for k, v in sizes.items() if v >= biggest * keep_ratio}
    return np.isin(label, list(keep))


TOLERANCE = {"aquatic": 24}
CURRENT = [None]
KEEP = {"aquatic": 0.2}


def main():
    sheets = [Image.open(sys.argv[1]).convert('RGB'), Image.open(sys.argv[2]).convert('RGB')]
    out = sys.argv[3] if len(sys.argv) > 3 else 'out/sprites'
    import os
    os.makedirs(out, exist_ok=True)
    report = {}
    for sheet, ident, box, (mw, mh) in CROPS:
        CURRENT[0] = ident
        crop = sheets[sheet].crop(box)
        rgb = np.array(crop)
        fg = ~background_mask(rgb)
        fg = largest_pieces(fg, KEEP.get(ident, 0.02))
        ys, xs = np.where(fg)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        rgb, fg = rgb[y0:y1, x0:x1], fg[y0:y1, x0:x1]
        h, w = fg.shape
        scale = min(mw / w, mh / h)
        tw, th = max(1, round(w * scale)), max(1, round(h * scale))
        # Shrink colors and coverage separately: coverage decides which pixels exist, colors are averaged where they exist.
        weights = fg.astype(float)[..., None]
        premult = Image.fromarray((rgb * weights).astype(np.uint8)).resize((tw, th), Image.BOX)
        cover = Image.fromarray((fg * 255).astype(np.uint8)).resize((tw, th), Image.BOX)
        cov = np.array(cover).astype(float) / 255
        col = np.array(premult).astype(float) / np.maximum(cov[..., None], 1e-3)
        alpha = cov > 0.5
        small = np.where(alpha[..., None], np.clip(col, 0, 255), 0).astype(np.uint8)
        Image.fromarray(small).save(f'{out}/{ident}-small.png')
        np.save(f'{out}/{ident}-alpha.npy', alpha)
        np.save(f'{out}/{ident}-rgb.npy', small)
        report[ident] = {'w': tw, 'h': th, 'source': [int(w), int(h)]}
        # A scaled-up preview on the sheet's own background for checking by eye.
        prev = Image.new('RGB', (tw * 6 + 8, th * 6 + 8), (13, 15, 28))
        up = Image.fromarray(small).resize((tw * 6, th * 6), Image.NEAREST)
        mask = Image.fromarray((alpha * 255).astype(np.uint8)).resize((tw * 6, th * 6), Image.NEAREST)
        prev.paste(up, (4, 4), mask)
        prev.save(f'{out}/{ident}-preview.png')
    print(json.dumps(report))


main()
