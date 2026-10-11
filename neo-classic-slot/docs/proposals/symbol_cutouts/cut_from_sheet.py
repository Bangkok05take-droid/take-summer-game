import sys
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
src, out = sys.argv[1], sys.argv[2]
sheet = Image.open(src).convert('RGBA')
BOX = {'sym_red7': (40, 80, 740, 390), 'sym_bar': (730, 95, 1505, 375), 'sym_grape': (25, 385, 490, 700),
       'sym_cherry': (535, 385, 965, 700), 'sym_bell': (1005, 385, 1475, 700), 'sym_mountain': (515, 695, 1045, 970),
       'sym_replay': (1055, 710, 1505, 930)}
for name, box in BOX.items():
    im = sheet.crop(box)
    a = np.asarray(im.convert('RGB')).astype(int)
    mx = a.max(axis=2); rb = a[:,:,0]-a[:,:,2]
    r, g, b = a[:,:,0], a[:,:,1], a[:,:,2]
    bglike = (r - b >= 12) & (g - b >= 8) & (np.abs(r - g) < 70) & (b < 110)
    wall = (mx < 22) | ((mx < 55) & (rb < 14) & (g - b < 14)) | ~bglike
    m = Image.fromarray(np.where(wall, 0, 255).astype('uint8')).copy()
    w, h = m.size
    for x in range(0, w, 3):
        for y in (0, h - 1):
            if m.getpixel((x, y)) == 255: ImageDraw.floodfill(m, (x, y), 128)
    for y in range(0, h, 3):
        for x in (0, w - 1):
            if m.getpixel((x, y)) == 255: ImageDraw.floodfill(m, (x, y), 128)
    mm = np.asarray(m) != 128
    alpha = Image.fromarray((mm * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.7))
    im.putalpha(alpha)
    bb = im.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox(); im = im.crop(bb)
    W, H = 212, 119
    s = min(W / im.width, H / im.height)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    cv = Image.new('RGBA', (220, 127), (0, 0, 0, 0)); cv.paste(im, ((220 - im.width) // 2, (127 - im.height) // 2), im)
    cv.save(f'{out}/{name}.png')
    print(name, cv.size, bb)
# preview on white reel-like background
pv = Image.new('RGBA', (220 * 4 + 50, 127 * 2 + 30), (250, 250, 244, 255))
for i, name in enumerate(BOX):
    t = Image.open(f'{out}/{name}.png'); pv.paste(t, (10 + (i % 4) * 225, 10 + (i // 4) * 135), t)
pv.save(f'{out}/_preview.png')
