"""Bangla (and Latin) chalk handwriting: trace single centre lines out of a shaped OFL font.

The chalk engine draws strokes along centre lines; it never fills a font outline. Bangla has no single-line font,
so each board text is shaped with HarfBuzz (PIL + raqm, so conjuncts like ক্ল, স্ব, দ্ভ are correct), rasterised
large, skeletonised, and the skeleton is cut into strokes:
  - pixel chains between endpoints and junctions; tiny spurs pruned; chains joined through junctions where the
    direction continues (a hand does not lift the chalk at every crossing)
  - the মাত্রা (headline): long, flat chains in the headline band are marked 'matra' and, as a hand writes Bangla,
    drawn after the letters of their word
  - order: word by word, left to right; inside a word, letters by their left edge, top first
Output: tools/glyphs.json and js/glyphs.js → { id: { text, w, top, bot, half, strokes: [{ pts, matra, word }] } }
in em units (1 = font size; x = 0 at the text's left edge, y = 0 at the letters' visual centre). Read by js/bn.js.

usage: .venv/bin/python tools/trace.py      (texts listed in TEXTS below; re-run after changing any of them)
"""
import json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi
from skimage.morphology import skeletonize

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_BN = os.path.join(HERE, 'fonts', 'atma_Atma-SemiBold.ttf')
PX = 260                                     # raster font size: big enough for a clean skeleton

# every text the chalk writes on the board (ids are used by js/film.js)
TEXTS = {
    'year': '১৮৮৩', 'germany': 'জার্মানি', 'schimper': 'শিম্পার', 'micro': 'মাইক্রোস্কোপ',
    'green': 'সবুজ দানা', 'belief': 'কোষ নিজেই বানায়?',
    'divide': 'নিজেরাই ভাগ হয়!', 'alive': 'জীবন্ত!', 'chloro': 'ক্লোরোপ্লাস্ট',
    'note': 'হয়তো একসময় স্বাধীন জীব?', 'decades': 'কয়েক দশক পর',
    'bacteria': 'ব্যাকটেরিয়া', 'prisoner': 'বন্দি', 'light': 'আলো', 'food': 'খাবার',
    'world': 'পুরো পৃথিবীর জন্য', 'note1': 'হয়তো একসময়', 'note2': 'স্বাধীন জীব?', 'notrote': 'মুখস্থ নয়', 'story': 'গল্প',
    'brand': 'Breaking Biology', 'tag': 'বিজ্ঞান = গল্প',
}

def render(text):
    f = ImageFont.truetype(FONT_BN, PX, layout_engine=ImageFont.Layout.RAQM)
    l, t, r, b = f.getbbox(text, language='bn')
    pad = 30; W, H = r - l + 2 * pad, b - t + 2 * pad
    im = Image.new('L', (W, H), 0); ImageDraw.Draw(im).text((pad - l, pad - t), text, font=f, fill=255, language='bn')
    a = np.array(im) > 110
    asc, desc = f.getmetrics()
    rows = a.sum(1); ink = np.nonzero(rows)[0]
    if any('\u0980' <= ch <= '\u09ff' for ch in text):
        top = ink[0]; lim = top + int((ink[-1] - top) * .55)
        hb = top + int(np.argmax(rows[top:lim]))       # the headline: the longest ink row in the upper part
        cy = hb + PX * .3                               # letters hang ~0.6 em below the headline: their centre
    else:
        cy = pad - t + asc - PX * .36                   # Latin: halfway up the x-height/cap height
    
    words, x = [], pad - l
    for w in text.split(' '):
        wl = f.getlength(w, language='bn'); words.append((x, x + wl)); x += wl + f.getlength(' ', language='bn')
    return a, cy, words

N8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

def chains(sk):
    """skeleton → pixel chains (lists of (y, x)) between nodes (endpoints / junctions), plus node-less loops"""
    ys, xs = np.nonzero(sk); P = set(zip(ys.tolist(), xs.tolist()))
    nb = {p: [(p[0] + dy, p[1] + dx) for dy, dx in N8 if (p[0] + dy, p[1] + dx) in P] for p in P}
    node = {p for p in P if len(nb[p]) != 2}
    seen, out = set(), []
    def walk(a, b):
        ch = [a, b]; prev, cur = a, b
        while cur not in node:
            nx = [q for q in nb[cur] if q != prev and (cur, q) not in seen]
            if not nx: break
            seen.add((cur, nx[0])); seen.add((nx[0], cur)); prev, cur = cur, nx[0]; ch.append(cur)
        return ch
    for a in node:
        for b in nb[a]:
            if (a, b) in seen: continue
            seen.add((a, b)); seen.add((b, a)); out.append(walk(a, b))
    left = P - {p for c in out for p in c}
    while left:                                     # closed loops with no node (০, o)
        s = next(iter(left)); ch = [s]; prev, cur = None, s
        while True:
            nx = [q for q in nb[cur] if q != prev and q in left and q not in ch]
            if not nx: break
            prev, cur = cur, nx[0]; ch.append(cur)
        ch.append(s); out.append(ch); left -= set(ch)
    return out, nb

def rdp(p, eps):
    if len(p) < 3: return p
    if abs(p[0][0] - p[-1][0]) + abs(p[0][1] - p[-1][1]) < 2:   # a closed loop: split at its farthest point first
        i = max(range(len(p)), key=lambda k: (p[k][0] - p[0][0]) ** 2 + (p[k][1] - p[0][1]) ** 2)
        if i in (0, len(p) - 1): return p
        return rdp(p[:i + 1], eps)[:-1] + rdp(p[i:], eps)
    a, b = np.array(p[0], float), np.array(p[-1], float); d = b - a; L = np.hypot(*d) or 1
    dist = [abs(d[0] * (a[1] - q[1]) - d[1] * (a[0] - q[0])) / L for q in p]
    i = int(np.argmax(dist))
    if dist[i] > eps: return rdp(p[:i + 1], eps)[:-1] + rdp(p[i:], eps)
    return [p[0], p[-1]]

def direction(ch, end, k=8):
    """unit vector leaving chain `ch` at its `end` (0 = start, 1 = end), pointing outward"""
    q = ch if end == 1 else ch[::-1]
    a, b = np.array(q[max(0, len(q) - 1 - k)], float), np.array(q[-1], float); v = b - a; n = np.hypot(*v) or 1
    return v / n

def trace(text):
    a, cy, words = render(text)
    dt = ndi.distance_transform_edt(a)
    sk = skeletonize(a)
    half = float(np.median(dt[sk])) if sk.any() else 10
    C, nb = chains(sk)
    deg = lambda p: len(nb[p])
    for _ in range(2):                              # prune skeleton hair at blunt stroke ends
        C = [c for c in C if len(c) >= 3 and not (((deg(c[0]) == 1) + (deg(c[-1]) == 1)) == 1 and len(c) < half * 1.6)]
    joined = True                                   # join chains through junctions where the direction continues
    while joined:
        joined = False; ends = {}
        for i, c in enumerate(C):
            if c[0] == c[-1]: continue
            for e in (0, 1): ends.setdefault(c[-1] if e else c[0], []).append((i, e))
        for p, lst in ends.items():
            best = None
            for x in range(len(lst)):
                for y in range(x + 1, len(lst)):
                    (i, ei), (j, ej) = lst[x], lst[y]
                    if i == j: continue
                    cos = -float(direction(C[i], ei) @ direction(C[j], ej))
                    if cos > .77 and (best is None or cos > best[0]): best = (cos, i, ei, j, ej)
            if best:
                _, i, ei, j, ej = best
                A = C[i] if ei == 1 else C[i][::-1]; B = C[j] if ej == 0 else C[j][::-1]
                C[i] = A + B[1:]; C.pop(j); joined = True; break
    hb_y = int(round(cy - PX * .3))                  # the headline row (Bangla), found in render()
    bengali = any('ঀ' <= ch <= '\u09e5' for ch in text)
    # cut every chain into headline runs (in the band, running sideways) and body runs
    pieces = []                                      # (points [(x, y)], is_matra)
    for c in C:
        P = [(int(p[1]), int(p[0])) for p in c]
        inb = [bengali and abs(y - hb_y) < half * 1.35 for x, y in P]
        k = 0
        while k < len(P):
            j = k
            while j + 1 < len(P) and inb[j + 1] == inb[k]: j += 1
            run = P[max(0, k - 1): j + 2] if not inb[k] else P[k: j + 1]
            xs = [p[0] for p in run]
            if inb[k] and max(xs) - min(xs) > half * 1.2: pieces.append((P[k: j + 1], True))
            elif not inb[k] and len(run) >= 3: pieces.append((run, False))
            elif inb[k] and len(run) >= 2: pieces.append((run, False))   # a short dip through the band: part of a letter
            k = j + 1
    def word_of(pts):
        cx = np.mean([p[0] for p in pts])
        for k, (_, w1) in enumerate(words):
            if cx < w1 + PX * .1: return k
        return len(words) - 1
    strokes = []
    # one headline per word (pieces closer than a letter gap merged), drawn after that word's letters
    for w in range(len(words)):
        segs = sorted([p for p, m in pieces if m and word_of(p) == w], key=lambda p: min(q[0] for q in p))
        merged = []
        for s in segs:
            x0, x1 = min(q[0] for q in s), max(q[0] for q in s)
            if merged and x0 - merged[-1][1] < half * 4: merged[-1][1] = max(merged[-1][1], x1)
            else: merged.append([x0, x1])
        for x0, x1 in merged:
            xs = np.arange(x0, x1 + 1, max(2, int(half)))
            col = lambda x: [y for (px, y) in [q for p, m in pieces if m for q in p] if abs(px - x) <= half]
            pts = [(int(x), int(np.median(col(x)) if col(x) else hb_y)) for x in xs]
            if len(pts) >= 2: strokes.append({'pts': rdp(pts, max(.8, half * .15)), 'matra': True, 'x0': float(x0), 'y0': float(hb_y), 'word': w})
    for pts, m in pieces:
        if m: continue
        if pts[0][0] > pts[-1][0] + half * .5 or (abs(pts[0][0] - pts[-1][0]) <= half * .5 and pts[0][1] > pts[-1][1]): pts = pts[::-1]
        L = sum(np.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) for i in range(len(pts) - 1))
        if L < half * 1.2: continue
        strokes.append({'pts': rdp(pts, max(.8, half * .12)), 'matra': False, 'x0': float(min(p[0] for p in pts)), 'y0': float(min(p[1] for p in pts)), 'word': word_of(pts)})
    strokes.sort(key=lambda s: (s['word'], s['matra'], round(s['x0'] / (half * 3)), s['y0']))
    allp = [p for s in strokes for p in s['pts']]
    x0 = min(p[0] for p in allp); x1 = max(p[0] for p in allp); y0 = min(p[1] for p in allp); y1 = max(p[1] for p in allp)
    k = 1 / PX
    out = [{'pts': [[round((x - x0) * k, 4), round((y - cy) * k, 4)] for x, y in s['pts']], 'matra': s['matra'], 'word': s['word']} for s in strokes if len(s['pts']) >= 2]
    return {'text': text, 'w': round((x1 - x0) * k, 4), 'top': round((y0 - cy) * k, 4), 'bot': round((y1 - cy) * k, 4), 'half': round(half * k, 4), 'strokes': out}

if __name__ == '__main__':
    G = {i: trace(t) for i, t in TEXTS.items()}
    json.dump(G, open(os.path.join(HERE, 'tools', 'glyphs.json'), 'w'), ensure_ascii=False)
    with open(os.path.join(HERE, 'js', 'glyphs.js'), 'w') as f:
        f.write('// generated by tools/trace.py — do not edit by hand\nexport const GLYPHS = ' + json.dumps(G, ensure_ascii=False) + ';\n')
    for i, g in G.items(): print(f"{i:10s} {g['text']:28s} strokes {len(g['strokes']):3d}  matra {sum(s['matra'] for s in g['strokes'])}  w {g['w']:.2f}em  half {g['half']:.3f}")
