"""Developer tool, step 2 of 3: quantizes each sprite, classifies its colors and finds its face features.

    python scripts/sprites/analyze.py [dir]

Reads <id>-rgb.npy / <id>-alpha.npy from extract.py and writes <id>-quant.npy (indexed), analysis.json (palette with a
class per color: body, accent or fixed; default body and accent colors; candidate face components) and a numbered
debug image per character, so the eyes and mouth can be picked by eye for faces.json.
"""
import colorsys
import json
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageDraw

IDS = ['classic', 'fox', 'bot', 'slime', 'mage', 'aquatic']
COLORS = 38


def hsv(rgb):
    h, s, v = colorsys.rgb_to_hsv(*(c / 255 for c in rgb))
    return h * 360, s, v


# Which colors follow the user's body color, which follow the accent color, and which never change.
def classify(ident, rgb):
    h, s, v = hsv(rgb)
    if ident == 'classic':
        if v < 0.55 and s > 0.35 and 225 <= h <= 252: return 'accent'
        if 235 <= h <= 300 and s < 0.75 and v > 0.28: return 'body'
        if 235 <= h <= 300 and v <= 0.28 and s > 0.3: return 'body'
    if ident == 'fox':
        if 225 <= h <= 300 and v < 0.5 and s > 0.15: return 'accent'
        if 8 <= h <= 46 and s > 0.5: return 'body'
    if ident == 'bot':
        if 200 <= h <= 232 and s >= 0.42 and v > 0.4: return 'accent'
        if s < 0.3 and v > 0.45: return 'body'
    if ident == 'slime':
        if 180 <= h <= 232 and s > 0.35: return 'body'
        if 238 <= h <= 300 and s > 0.3: return 'accent'
    if ident == 'mage':
        if 255 <= h <= 292 and s >= 0.42: return 'accent'
        if (h >= 285 or h <= 25) and s < 0.5 and v > 0.45: return 'body'
    if ident == 'aquatic':
        if (h >= 285 or h <= 20) and v < 0.72 and s > 0.2: return 'accent'
        if 235 <= h <= 290 and s < 0.6 and v > 0.5: return 'body'
    return 'fixed'


def components(mask):
    h, w = mask.shape
    seen = np.zeros((h, w), bool)
    out = []
    for sy in range(h):
        for sx in range(w):
            if mask[sy, sx] and not seen[sy, sx]:
                q = deque([(sy, sx)]); seen[sy, sx] = True; cells = []
                while q:
                    y, x = q.popleft(); cells.append((y, x))
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True; q.append((ny, nx))
                out.append(cells)
    return out


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else 'out/sprites'
    analysis = {}
    for ident in IDS:
        rgb = np.load(f'{folder}/{ident}-rgb.npy')
        alpha = np.load(f'{folder}/{ident}-alpha.npy')
        h, w = alpha.shape
        img = Image.fromarray(rgb).quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        pal = np.array(img.getpalette()[: COLORS * 3]).reshape(-1, 3)
        idx = np.array(img)
        used = sorted({int(i) for i in idx[alpha]})
        remap = {old: new for new, old in enumerate(used)}
        quant = np.full((h, w), -1, int)
        for y in range(h):
            for x in range(w):
                if alpha[y, x]: quant[y, x] = remap[int(idx[y, x])]
        colors = [tuple(int(c) for c in pal[o]) for o in used]
        classes = [classify(ident, c) for c in colors]
        counts = np.bincount(quant[quant >= 0], minlength=len(colors))

        def base_color(kind):
            members = [(i, counts[i]) for i, k in enumerate(classes) if k == kind]
            if not members: return None
            ordered = sorted(members, key=lambda m: colorsys.rgb_to_hsv(*(c / 255 for c in colors[m[0]]))[2])
            total = sum(c for _, c in ordered); run = 0
            for i, c in ordered:
                run += c
                if run >= total / 2: return colors[i]

        # Dark components that do not touch the silhouette: candidate eyes and mouth marks.
        near_edge = np.zeros((h, w), bool)
        for y in range(h):
            for x in range(w):
                if alpha[y, x]:
                    for dy in (-2, -1, 0, 1, 2):
                        for dx in (-2, -1, 0, 1, 2):
                            ny, nx = y + dy, x + dx
                            if not (0 <= ny < h and 0 <= nx < w) or not alpha[ny, nx]: near_edge[y, x] = True
        lum = np.array([[hsv(rgb[y, x])[2] if alpha[y, x] else 1 for x in range(w)] for y in range(h)])
        dark = (lum < 0.3) & alpha & ~near_edge
        comps = [c for c in components(dark) if 3 <= len(c) <= 90]
        info = []
        for n, cells in enumerate(comps):
            ys = [c[0] for c in cells]; xs = [c[1] for c in cells]
            info.append({'n': n, 'size': len(cells), 'cx': round(sum(xs) / len(xs), 1), 'cy': round(sum(ys) / len(ys), 1), 'bbox': [min(xs), min(ys), max(xs), max(ys)]})
        analysis[ident] = {'w': w, 'h': h, 'colors': ['#%02x%02x%02x' % c for c in colors], 'classes': classes, 'counts': [int(c) for c in counts],
                           'body': base_color('body'), 'accent': base_color('accent'), 'components': info}
        np.save(f'{folder}/{ident}-quant.npy', quant)
        # Debug picture: the sprite enlarged with component numbers and a coordinate ruler.
        scale = 10
        dbg = Image.new('RGB', (w * scale + 20, h * scale + 20), (13, 15, 28))
        arr = np.zeros((h, w, 3), np.uint8)
        for y in range(h):
            for x in range(w):
                if quant[y, x] >= 0: arr[y, x] = colors[quant[y, x]]
        up = Image.fromarray(arr).resize((w * scale, h * scale), Image.NEAREST)
        mask = Image.fromarray((alpha * 255).astype(np.uint8)).resize((w * scale, h * scale), Image.NEAREST)
        dbg.paste(up, (20, 20), mask)
        d = ImageDraw.Draw(dbg)
        for x in range(0, w, 5): d.text((20 + x * scale, 4), str(x), fill=(200, 200, 90))
        for y in range(0, h, 5): d.text((2, 20 + y * scale), str(y), fill=(200, 200, 90))
        for c in info: d.text((20 + int(c['cx'] * scale), 20 + int(c['cy'] * scale)), str(c['n']), fill=(255, 60, 120))
        dbg.save(f'{folder}/{ident}-debug.png')
    json.dump(analysis, open(f'{folder}/analysis.json', 'w'), indent=1)
    for ident, a in analysis.items():
        print(ident, a['w'], a['h'], 'body', a['body'], 'accent', a['accent'], 'classes', {k: a['classes'].count(k) for k in ('body', 'accent', 'fixed')}, 'components', [(c['n'], c['size'], c['cx'], c['cy']) for c in a['components']])


main()
