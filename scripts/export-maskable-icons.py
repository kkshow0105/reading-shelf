"""Mechanical B2 safe-zone packaging, using existing Pillow; no redraw/crop/network.
python scripts/export-maskable-icons.py --check verifies existing frozen derivatives.
Without --check it exports only into absent new maskable filenames.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib
import math
import sys

root = Path(__file__).resolve().parents[1]
source_path = root / 'assets/branding/reading-shelf-b2-source.png'
assert hashlib.sha256(source_path.read_bytes()).hexdigest() == '1d86fab12257d80b8fd179c69fd47aca21945ff9add97074ebfbb2ac0808065b'
with Image.open(source_path) as original:
    original.load()
    source = original.convert('RGB')
corners = [(0, 0), (1253, 0), (0, 1253), (1253, 1253)]
background = tuple(round(sum(source.getpixel(point)[channel] for point in corners) / 4) for channel in range(3))
targets = [(512, 288), (192, 108)]
checking = sys.argv[1:] == ['--check']
if sys.argv[1:] and not checking:
    raise SystemExit('Only --check is supported.')
if not checking and any((root / f'public/icons/reading-shelf-maskable-{size}.png').exists() for size, _ in targets):
    raise SystemExit('Existing maskable icons are never overwritten.')
for size, inner in targets:
    image = Image.new('RGB', (size, size), background)
    offset = (size - inner) // 2
    image.paste(source.resize((inner, inner), Image.Resampling.LANCZOS), (offset, offset))
    assert math.sqrt(2) * inner / 2 < size * .4
    path = root / f'public/icons/reading-shelf-maskable-{size}.png'
    if checking:
        with Image.open(path) as icon:
            icon.load()
            assert icon.mode == 'RGB' and icon.size == (size, size) and icon.tobytes() == image.tobytes()
    else:
        image.save(path, optimize=True)
    print(f'PASS {size}: complete B2 square {inner}px, offset {offset}px; corner radius below {size * .4}px')

if not checking:
    img = Image.open(root / 'public/icons/reading-shelf-maskable-512.png')
    sheet = Image.new('RGB', (1056, 310), '#F4F0E8')
    labels = ImageDraw.Draw(sheet)
    for i, kind in enumerate(['safe circle', 'circle', 'rounded square', 'adaptive / drop']):
        pic = img.resize((240, 240), Image.Resampling.LANCZOS).convert('RGBA')
        mask = Image.new('L', (240, 240), 0)
        draw = ImageDraw.Draw(mask)
        if kind == 'safe circle':
            draw.rectangle((0, 0, 240, 240), fill=255)
            ImageDraw.Draw(pic).ellipse((24, 24, 216, 216), outline='#EEDCC0', width=2)
        elif kind == 'circle':
            draw.ellipse((0, 0, 239, 239), fill=255)
        elif kind == 'rounded square':
            draw.rounded_rectangle((0, 0, 239, 239), radius=54, fill=255)
        else:
            draw.ellipse((0, 0, 239, 239), fill=255)
            draw.polygon([(120, 0), (239, 0), (239, 120)], fill=255)
        pic.putalpha(mask)
        sheet.paste(pic, (12 + i * 264, 40), pic)
        labels.text((12 + i * 264, 16), kind, fill='#24211D')
    (root / 'qa').mkdir(exist_ok=True)
    sheet.save(root / 'qa/pwa-maskable-preview.png')
