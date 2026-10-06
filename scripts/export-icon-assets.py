"""Deterministic size/format export of the approved B2; no redrawing or crop.

Requires the existing Pillow tool, not an application dependency.
Run once: python scripts/export-icon-assets.py <approved-source.png>
Existing files are never overwritten. No network or application changes.
"""
from pathlib import Path
import hashlib
import shutil
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1]).resolve() if len(sys.argv) == 2 else ROOT / 'assets/branding/reading-shelf-b2-source.png'
ORIGINAL = ROOT / 'assets/branding/reading-shelf-b2-source.png'
OUT = ROOT / 'public/icons'
SIZES = {'reading-shelf-1024.png': 1024, 'reading-shelf-512.png': 512,
         'reading-shelf-192.png': 192, 'apple-touch-icon-180.png': 180,
         'favicon-16.png': 16, 'favicon-32.png': 32, 'favicon-48.png': 48}

with Image.open(SOURCE) as source:
    source.load()
    if source.size[0] != source.size[1] or source.size[0] < 1024:
        raise SystemExit('A square approved original of at least 1024px is required.')
    if source.mode not in ('RGB', 'RGBA') or (source.mode == 'RGBA' and source.getchannel('A').getextrema() != (255, 255)):
        raise SystemExit('The approved source must have an opaque background.')
    image = source.convert('RGB')

targets = [OUT / name for name in SIZES] + [OUT / 'favicon.ico']
if SOURCE != ORIGINAL:
    targets.append(ORIGINAL)
if any(path.exists() for path in targets):
    raise SystemExit('Output exists; use new versioned filenames rather than overwrite.')
for folder in [ORIGINAL.parent, OUT, ROOT / 'qa']:
    folder.mkdir(parents=True, exist_ok=True)
if SOURCE != ORIGINAL:
    shutil.copyfile(SOURCE, ORIGINAL)
for name, size in SIZES.items():
    image.resize((size, size), Image.Resampling.LANCZOS).save(OUT / name, optimize=True)
image.save(OUT / 'favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])

# QA-only sheet at native pixel sizes; not a production icon or manifest asset.
preview = Image.new('RGB', (780, 300), '#F4F0E8')
draw = ImageDraw.Draw(preview)
try:
    font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 15)
except OSError:
    font = ImageFont.load_default()
for x, y, size, name in [(20, 48, 192, 'reading-shelf-192.png'), (244, 48, 180, 'apple-touch-icon-180.png'),
                          (464, 48, 48, 'favicon-48.png'), (548, 48, 32, 'favicon-32.png'), (632, 48, 16, 'favicon-16.png')]:
    with Image.open(OUT / name) as icon:
        preview.paste(icon, (x, y))
    draw.text((x, 20), f'{size} x {size}', font=font, fill='#24211D')
preview.save(ROOT / 'qa/icon-b2-sizes.png')

assert hashlib.sha256(SOURCE.read_bytes()).digest() == hashlib.sha256(ORIGINAL.read_bytes()).digest()
for name, size in SIZES.items():
    with Image.open(OUT / name) as icon:
        assert icon.size == (size, size) and icon.mode == 'RGB'
        assert icon.tobytes() == image.resize((size, size), Image.Resampling.LANCZOS).tobytes()
with Image.open(OUT / 'favicon.ico') as icon:
    assert icon.ico.sizes() == {(16, 16), (32, 32), (48, 48)}
print('Approved source preserved:', image.size, hashlib.sha256(ORIGINAL.read_bytes()).hexdigest())
for path in sorted(targets):
    print(path.relative_to(ROOT), path.stat().st_size, 'bytes')
print('PASS: requested dimensions, opaque RGB, unchanged source and all ICO frames verified.')
