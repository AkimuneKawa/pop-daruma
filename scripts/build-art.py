# 画像素材パックから、ゲームで使う画像を作る
#   python3 scripts/build-art.py <v2 のフォルダー> <v3 のフォルダー>   （Pillow が必要：pip install pillow）
#   v2＝pop-daruma-graphics-pack-v2（だるま・アイコン・看板など）、v3＝pop-daruma-additional-assets-v3（4つの zip を同じフォルダーに展開）
# 出力：src/art/*.webp と src/art/atlas.json（各絵の矩形 [x, y, w, h]。人物は足元の基準点 [px, py] も）
# 透明は 0.5 で切って（半透明のにじみを消して）から縮める
import json, sys
from collections import deque
from pathlib import Path
from PIL import Image

V2, V3 = Path(sys.argv[1]), Path(sys.argv[2])
OUT = Path(__file__).resolve().parent.parent / 'src' / 'art'
OUT.mkdir(exist_ok=True)
RECT = {s['id']: (s['file'], s['rect']) for s in json.loads((V2 / 'assets.json').read_text())['sprites']}
MAN = {a['id']: a for a in json.loads((V3 / 'manifest.json').read_text())['assets']}
K = 0.375  # 人物の縮小率（元の絵 1px あたり。元は約6pxで1ドット）


def cut(img):
    img = img.convert('RGBA')
    img.putalpha(img.getchannel('A').point(lambda v: 255 if v >= 128 else 0))
    return img


def crop(path, rect):
    x, y, w, h = rect
    return cut(Image.open(path).crop((x, y, x + w, y + h)))


def trim(img):
    return img.crop(img.getchannel('A').getbbox())


def scale(img, k):
    w, h = max(1, round(img.width * k)), max(1, round(img.height * k))
    return img.convert('RGBa').resize((w, h), Image.LANCZOS).convert('RGBA')


def union(ims):
    bs = [im.getchannel('A').getbbox() for im in ims]
    return (min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs))


def sheet(name, items, pad=2, maxw=1024, layout=None, q=None):
    # items: [(id, img, 基準点 or None)] を左から詰めて1枚にする。layout を渡すと同じ並びで描く（色替えマスク用）
    pos = layout
    if pos is None:
        x = y = rowh = 0
        pos = {}
        for id_, im, piv in items:
            if x + im.width > maxw:
                x, y, rowh = 0, y + rowh + pad, 0
            pos[id_] = [x, y, im.width, im.height] + ([round(piv[0], 1), round(piv[1], 1)] if piv else [])
            x += im.width + pad
            rowh = max(rowh, im.height)
    out = Image.new('RGBA', (maxw, max(p[1] + p[3] for p in pos.values())), (0, 0, 0, 0))
    for id_, im, _ in items:
        out.paste(im, tuple(pos[id_][:2]))
    # q を渡すと非可逆（透明は可逆のまま）。人物の大きなシートを軽くする
    out.save(OUT / f'{name}.webp', method=6, **({'quality': q, 'alpha_quality': 100} if q else {'lossless': True}))
    return pos


atlas = {}

# 工房の背景：縦長・のれんのロゴ入り（1536×1280）。canvas の論理 256 幅に 1/6 で、下揃えに描く
BG = V3 / 'backgrounds/workshop-tall-branded.png'
Image.open(BG).convert('RGB').save(OUT / 'workshop.webp', quality=90, method=6)

# だるま5色＋灰色（高さ 128）
dar = []
for key, id_ in [('red', 'daruma-red'), ('gold', 'daruma-gold'), ('pink', 'daruma-pink'), ('sky', 'daruma-blue'), ('green', 'daruma-green'), ('gray', 'daruma-gray')]:
    file, r = RECT[id_]
    im = trim(crop(V2 / file, r))
    dar.append((key, scale(im, 128 / im.height), None))
atlas['daruma'] = sheet('daruma', dar)

# アイコン（長い辺 96）。投資（up）と売り逃し（sad）は v3
ico = []
for id_ in ['coin', 'bag', 'cal', 'gear', 'chart', 'box', 'rack', 'brush', 'factory', 'mega', 'tv', 'sack']:
    file, r = RECT[id_]
    ico.append((id_, trim(crop(V2 / file, r)), None))
for id_, mid in [('up', 'investment-up'), ('sad', 'sad-face')]:
    ico.append((id_, trim(cut(Image.open(V3 / MAN[mid]['file']))), None))
atlas['icons'] = sheet('icons', [(i, scale(im, 96 / max(im.size)), None) for i, im, _ in ico])


# 白だるまの胴体のマスク（色を塗るときにこの部分だけ着色する）。
# 下半分の白〜灰色のかたまりのうち、内側に顔（肌色〜生成り）と黒い模様を囲んでいるものをだるまとみなす
def is_white(p):
    return p[3] > 200 and min(p[:3]) > 140 and max(p[:3]) - min(p[:3]) < 24


def is_warm(p):
    return p[3] > 200 and p[0] > 200 and p[1] > 150 and p[0] - p[2] > 40


def comps(w, h, ok):
    seen, out = set(), []
    for y in range(h):
        for x in range(w):
            if (x, y) in seen or not ok(x, y):
                continue
            comp, q = set(), deque([(x, y)])
            seen.add((x, y))
            while q:
                cx, cy = q.popleft()
                comp.add((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and ok(nx, ny):
                        seen.add((nx, ny))
                        q.append((nx, ny))
            out.append(comp)
    return out


def holes(comp):
    # かたまりの外接矩形の中で、外側からたどれない部分（＝囲まれた穴）
    x0, y0 = min(p[0] for p in comp) - 1, min(p[1] for p in comp) - 1
    x1, y1 = max(p[0] for p in comp) + 1, max(p[1] for p in comp) + 1
    out, q = set(), deque([(x0, y0)])
    out.add((x0, y0))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if x0 <= nx <= x1 and y0 <= ny <= y1 and (nx, ny) not in out and (nx, ny) not in comp:
                out.add((nx, ny))
                q.append((nx, ny))
    return {(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1) if (x, y) not in out and (x, y) not in comp}


def body_mask(im):
    w, h = im.size
    px = im.load()
    best, face = None, []
    for c in comps(w, h, lambda x, y: y > h * 0.45 and is_white(px[x, y])):
        if len(c) < 150:
            continue
        hl = holes(c)
        warm = [p for p in hl if is_warm(px[p])]
        dark = sum(1 for p in hl if px[p][3] > 200 and sum(px[p][:3]) < 200)
        if dark > 20 and len(warm) > len(face):
            best, face = c, warm
    if not best:
        return cream_mask(im)
    fx0, fy0 = min(p[0] for p in face), min(p[1] for p in face)
    fx1, fy1 = max(p[0] for p in face), max(p[1] for p in face)
    fw, fh = fx1 - fx0 + 1, fy1 - fy0 + 1
    box = (fx0 - fw * 0.6, fy0 - fh * 1.2, fx1 + fw * 0.6, fy1 + fh * 2.2)
    return {(x, y) for x, y in best if box[0] <= x <= box[2] and box[1] <= y <= box[3]}


# 筆が顔にかかって囲みが切れたコマ用：顔の生成り色を探し、その周りの白をたどる
def is_cream(p):
    return p[3] > 200 and p[0] > 230 and 208 <= p[1] <= 238 and 160 <= p[2] <= 212 and 18 <= p[1] - p[2] <= 60


def cream_mask(im):
    w, h = im.size
    px = im.load()
    cs = comps(w, h, lambda x, y: y > h * 0.5 and is_cream(px[x, y]))
    if not cs:
        return set()
    face = max(cs, key=len)
    fx0, fy0 = min(p[0] for p in face), min(p[1] for p in face)
    fx1, fy1 = max(p[0] for p in face), max(p[1] for p in face)
    fw, fh = fx1 - fx0 + 1, fy1 - fy0 + 1
    box = (fx0 - fw * 0.45, fy0 - fh * 0.9, fx1 + fw * 0.45, fy1 + fh * 1.5)
    q = deque((x, y) for (fx, fy) in face for x, y in ((fx + 1, fy), (fx - 1, fy), (fx, fy + 1), (fx, fy - 1)))
    body = set()
    while q:
        x, y = q.popleft()
        if (x, y) in body or not (box[0] <= x <= box[2] and box[1] <= y <= box[3]) or not (0 <= x < w and 0 <= y < h) or not is_white(px[x, y]):
            continue
        body.add((x, y))
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return body


# 1人4コマぶんのマスク。見つからない（小さすぎる）コマは、ほかのコマのだるまの範囲にある白を使う（だるまはほぼ動かない）
def body_masks(frames):
    found = [body_mask(im) for im in frames]
    good = max(found, key=len)
    gx0, gy0 = min(p[0] for p in good), min(p[1] for p in good)
    gx1, gy1 = max(p[0] for p in good), max(p[1] for p in good)
    out = []
    for im, pts in zip(frames, found):
        px = im.load()
        if len(pts) < len(good) * 0.6:
            pts = {(x, y) for x in range(gx0, gx1 + 1) for y in range(gy0, gy1 + 1) if is_white(px[x, y])}
        m = Image.new('RGBA', im.size, (0, 0, 0, 0))
        mp = m.load()
        for x, y in pts:
            v = sum(px[x, y][:3]) // 3
            mp[x, y] = (v, v, v, 255)
        out.append(m)
    return out


# 職人13人（0＝もとの職人、1〜12＝追加）。待機1枚＋筆塗り4コマ、全コマ同じ範囲（基準点 168, 602）で切る
ART = ['artisan-original-white'] + [MAN[k]['identity'] for k in MAN if MAN[k]['kind'] == 'artisan_idle']
art_items, mask_items = [], []
for n, ident in enumerate(ART):
    a = MAN[ident + '-painting']
    strip = V3 / a['file']
    paint = [crop(strip, f['rect']) for f in a['frames']]
    idle = cut(Image.open(V3 / MAN[ident + '-idle']['file'])) if n else None
    if idle is None:  # もとの職人の待機は v2 の正面の絵を、筆塗りのコマと同じ背丈・足元にそろえて置く
        file, r = RECT['artisan_front']
        front = trim(crop(V2 / file, r))
        b = paint[0].getchannel('A').getbbox()
        front = front.resize((round(front.width * (602 - b[1]) / front.height), 602 - b[1]), Image.NEAREST)
        idle = Image.new('RGBA', paint[0].size, (0, 0, 0, 0))
        idle.paste(front, (168 - front.width // 2, 602 - front.height), front)
    frames = [idle] + paint
    box = union(frames)
    piv = ((168 - box[0]) * K, (602 - box[1]) * K)
    masks = body_masks(paint)
    for i, im in enumerate(frames):
        id_ = f'a{n}-' + ('idle' if i == 0 else f'p{i - 1}')
        art_items.append((id_, scale(im.crop(box), K), piv))
        if i:
            mask_items.append((id_, scale(masks[i - 1].crop(box), K), piv))
atlas['artisans'] = sheet('artisans', art_items, q=92)
mask_layout = {k: v for k, v in atlas['artisans'].items() if '-p' in k}
sheet('artmask', mask_items, layout=mask_layout)
atlas['artmask'] = mask_layout

# お客：歩く4コマ（5人。オレンジ帽は v2）と、特別なお客（業者・小売店・ツアーガイド、1枚ずつ）
people = []
walkers = [(MAN[k]['file'], [f['rect'] for f in MAN[k]['frames']], k.split('-')[2]) for k in MAN if MAN[k]['kind'] == 'customer_walk']
v2walk = json.loads((V2 / 'animations/animations-atlas.json').read_text())['animations']
cw = next(a for a in v2walk if a['id'] == 'customer-walk')
walkers.append(('animations/' + cw['file'], [f['frame']['rect'] if 'frame' in f else f['rect'] for f in cw['frames']], 'orange'))
for file, rects, name in walkers:
    root = V2 if name == 'orange' else V3
    fr = [crop(root / file, r) for r in rects]
    box = union(fr)
    piv = ((190 - box[0]) * K, (559 - box[1]) * K)
    for i, im in enumerate(fr):
        people.append((f'{name}-w{i}', scale(im.crop(box), K), piv))
for id_, mid in [('buyer', 'business-buyer'), ('happi', 'retailer-happi'), ('guide', 'tour-guide')]:
    im = cut(Image.open(V3 / MAN[mid]['file']))
    b = im.getchannel('A').getbbox()
    px_, py_ = MAN[mid]['pivotPixels']
    people.append((id_, scale(im.crop(b), K), ((px_ - b[0]) * K, (py_ - b[1]) * K)))
atlas['people'] = sheet('people', people, q=92)

# 季節の旗飾り（横にくり返す帯。高さ 96）
atlas['banners'] = sheet('banners', [(id_, scale(cut(Image.open(V3 / f'seasonal/{f}.png')), 0.5), None)
                                     for id_, f in [('sakura', 'sakura-banner'), ('lantern', 'spring-lantern-banner'), ('yearend', 'year-end-banner')]], maxw=768)

# 作業台の上の絵の具と筆立て（背景から切り抜き、職人より前に描く）。座標は縦長の背景の px。
# 周りから似た色をたどって壁や台を透明にする（濃い輪郭で止まる）。黄色の缶は輪郭が薄いのでそのまま残す
FG = (830, 718, 1062, 856)
KEEP = [(968, 793, 1017, 848)]
c = Image.open(BG).convert('RGB').crop(FG)
w, h = c.size
px = c.load()
lum = lambda p: (p[0] * 3 + p[1] * 6 + p[2]) / 10
bgm = set()
q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
while q:
    x, y = q.popleft()
    if (x, y) in bgm or lum(px[x, y]) < 75:
        continue
    bgm.add((x, y))
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in bgm and sum(abs(a - b) for a, b in zip(px[x, y], px[nx, ny])) < 90:
            q.append((nx, ny))
fg = c.convert('RGBA')
o = fg.load()
for x, y in bgm:
    if not any(k[0] <= x + FG[0] < k[2] and k[1] <= y + FG[1] < k[3] for k in KEEP):
        o[x, y] = (0, 0, 0, 0)
fg.save(OUT / 'bench.webp', lossless=True, method=6)
atlas['bench'] = list(FG)

# タイトルの看板（文字なし、幅 900）
file, r = RECT['title-sign-blank']
im = trim(crop(V2 / file, r))
scale(im, 900 / im.width).save(OUT / 'sign.webp', lossless=True, method=6)

for f in ['chars.webp']:  # 前の版の出力
    (OUT / f).unlink(missing_ok=True)
(OUT / 'atlas.json').write_text(json.dumps(atlas, indent=1))
print('ok', {k: len(v) for k, v in atlas.items()})
