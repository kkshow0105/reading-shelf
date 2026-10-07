"""Deterministic export of the user's approved V2 PNG; no AI/crop/recolour.

Uses existing Pillow only. No network or application dependencies.
python scripts/export-icon-assets-v2.py <approved-source.png>
python scripts/export-icon-assets-v2.py --check
Generation refuses existing outputs; --check verifies without rewriting them.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import hashlib
import math
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/icons'
ARCHIVE = OUT / 'source/reading-shelf-icon-v2-source.png'
SOURCE_SHA = '48c5e0de5710512e55ce1e7e700e88106f0cdf7cc799c380ed87ec6cd97ec104'
SIZES = {'reading-shelf-v2-1024.png': 1024, 'reading-shelf-v2-512.png': 512,
         'reading-shelf-v2-192.png': 192, 'apple-touch-icon-v2-180.png': 180,
         'favicon-v2-32.png': 32}
ICO = OUT / 'favicon-v2.ico'
MASKS = {512: 272, 192: 102}


def make_maskable(master, size):
    inner = MASKS[size]
    offset = (size - inner) // 2
    image = master.resize((inner, inner), Image.Resampling.LANCZOS)
    # Extend the ORIGINAL edge pixels, preserving left-cream/right-blue relation.
    # Only the NEW outside area is softened farther from the image boundary.
    edge = Image.new('RGB', (size, size))
    edge.putdata([image.getpixel((min(inner - 1, max(0, x - offset)),
                                  min(inner - 1, max(0, y - offset))))
                  for y in range(size) for x in range(size)])
    weight = Image.new('L', (size, size))
    values = []
    for y in range(size):
        for x in range(size):
            distance = max(offset - x, x - (offset + inner - 1),
                           offset - y, y - (offset + inner - 1), 0)
            t = min(1, distance / (offset * .6))
            values.append(round(255 * t * t * (3 - 2 * t)))
    weight.putdata(values)
    result = Image.composite(edge.filter(ImageFilter.GaussianBlur(size / 16)), edge, weight)
    result.paste(image, (offset, offset))  # Exact complete source square, untouched.
    assert result.crop((offset, offset, offset + inner, offset + inner)).tobytes() == image.tobytes()
    assert math.sqrt(2) * inner / 2 < size * .4
    return result


checking = sys.argv[1:] == ['--check']
if not checking and len(sys.argv) != 2:
    raise SystemExit('Provide the approved source, or --check.')
source_path = ARCHIVE if checking else Path(sys.argv[1]).resolve()
assert hashlib.sha256(source_path.read_bytes()).hexdigest() == SOURCE_SHA, 'Unapproved source'
with Image.open(source_path) as source:
    source.load()
    assert source.format == 'PNG' and source.mode == 'RGB'
    assert source.width == source.height and source.width >= 1024
    master = source.resize((1024, 1024), Image.Resampling.LANCZOS)

targets = [OUT / name for name in SIZES] + [ICO, ARCHIVE] + [OUT / f'reading-shelf-v2-maskable-{size}.png' for size in MASKS]
if not checking:
    if any(path.exists() for path in targets):
        raise SystemExit('V2 outputs exist; refusing to overwrite.')
    ARCHIVE.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source_path, ARCHIVE)
    for name, size in SIZES.items():
        master.resize((size, size), Image.Resampling.LANCZOS).save(OUT / name, optimize=True)
    master.save(ICO, format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
    for size in MASKS:
        make_maskable(master, size).save(OUT / f'reading-shelf-v2-maskable-{size}.png', optimize=True)

assert hashlib.sha256(ARCHIVE.read_bytes()).hexdigest() == SOURCE_SHA
for name, size in SIZES.items():
    with Image.open(OUT / name) as image:
        image.load()
        assert image.mode == 'RGB' and image.size == (size, size)
        assert image.tobytes() == master.resize((size, size), Image.Resampling.LANCZOS).tobytes()
with Image.open(ICO) as icon:
    assert icon.ico.sizes() == {(16, 16), (32, 32), (48, 48)}
    frames = {size: icon.ico.getimage((size, size)).convert('RGB') for size in [16, 32, 48]}
    for size, frame in frames.items():
        assert frame.tobytes() == master.resize((size, size), Image.Resampling.LANCZOS).tobytes()
for size, inner in MASKS.items():
    with Image.open(OUT / f'reading-shelf-v2-maskable-{size}.png') as image:
        image.load()
        assert image.mode == 'RGB' and image.size == (size, size)
        assert image.tobytes() == make_maskable(master, size).tobytes()
        offset = (size - inner) // 2
        # Simulate the safe circle and three common platform masks.
        for shape in ['safe-circle', 'circle', 'rounded-square', 'large-round']:
            mask = Image.new('L', (size, size), 0)
            draw = ImageDraw.Draw(mask)
            if shape == 'safe-circle':
                draw.ellipse((size * .1, size * .1, size * .9, size * .9), fill=255)
            elif shape == 'circle':
                draw.ellipse((0, 0, size - 1, size - 1), fill=255)
            else:
                draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=size * (.22 if shape == 'rounded-square' else .46), fill=255)
            assert mask.crop((offset, offset, offset + inner, offset + inner)).getextrema() == (255, 255)
        print(f'PASS maskable {size}: complete source {inner}, inset {offset}; safe-circle margin {size * .4 - math.sqrt(2) * inner / 2:.2f}px')

if not checking:
    qa = ROOT / 'qa'
    qa.mkdir(exist_ok=True)
    font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 15)
    sheet = Image.new('RGB', (700, 270), '#F4F0E8')
    draw = ImageDraw.Draw(sheet)
    for x, size, name in [(16, 192, 'reading-shelf-v2-192.png'), (240, 180, 'apple-touch-icon-v2-180.png'), (460, 32, 'favicon-v2-32.png'), (564, 16, None)]:
        image = frames[16] if name is None else Image.open(OUT / name)
        sheet.paste(image, (x, 48)); draw.text((x, 16), f'{size} x {size}', font=font, fill='#24211D')
    sheet.save(qa / 'icon-v2-native-sizes.png')
    preview = Image.new('RGB', (1056, 310), '#F4F0E8')
    for i, shape in enumerate(['safe-circle', 'circle', 'rounded-square', 'large-round']):
        with Image.open(OUT / 'reading-shelf-v2-maskable-512.png') as maskable:
            pic = maskable.resize((240, 240), Image.Resampling.LANCZOS).convert('RGBA')
        mask = Image.new('L', (240, 240), 255 if shape == 'safe-circle' else 0)
        draw = ImageDraw.Draw(mask)
        if shape == 'safe-circle':
            ImageDraw.Draw(pic).ellipse((24, 24, 216, 216), outline='#753C39', width=2)
        elif shape == 'circle':
            draw.ellipse((0, 0, 239, 239), fill=255)
        else:
            draw.rounded_rectangle((0, 0, 239, 239), radius=240 * (.22 if shape == 'rounded-square' else .46), fill=255)
        pic.putalpha(mask); preview.paste(pic, (12 + i * 264, 40), pic)
        ImageDraw.Draw(preview).text((12 + i * 264, 16), shape, font=font, fill='#24211D')
    preview.save(qa / 'icon-v2-maskable-preview.png')
print('PASS source hash, master/ordinary exact LANCZOS pixels, opaque RGB and ICO 16/32/48; no redraw or crop')
