"""Download small, local Noto subsets for the prototype's visible characters.

Only official Google Fonts endpoints are used. New characters fall back to
system fonts. This script is a build-time helper, never runs in the app.
"""
from pathlib import Path
import re
import string
import urllib.parse
import urllib.request
import json

root = Path(__file__).resolve().parents[1]
dest = root / 'public' / 'fonts'
dest.mkdir(parents=True, exist_ok=True)
text = ''.join(p.read_text(encoding='utf-8') for p in (root / 'src').rglob('*') if p.suffix in {'.ts', '.tsx'} and '.test.' not in p.name)
text += ''.join(p.read_text(encoding='utf-8') for p in (root / 'public' / 'covers').glob('*.svg'))
chars = ''.join(sorted(set(string.ascii_letters + string.digits + string.punctuation + ' ' + ''.join(c for c in text if ord(c) > 127))))
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'}
files = []
for family, slug in [('Noto Serif SC', 'noto-serif-sc'), ('Noto Sans SC', 'noto-sans-sc')]:
    for weight in (400, 600):
        query = urllib.parse.urlencode({'family': f'{family}:wght@{weight}', 'text': chars, 'display': 'swap'})
        with urllib.request.urlopen(urllib.request.Request('https://fonts.googleapis.com/css2?' + query, headers=headers), timeout=40) as response:
            css = response.read().decode('utf-8')
        urls = re.findall(r'url\((https://fonts.gstatic.com/[^)]+)\)', css)
        assert len(set(urls)) == 1, 'Unexpected font API response'
        with urllib.request.urlopen(urllib.request.Request(urls[0], headers=headers), timeout=40) as response:
            data = response.read()
        assert data[:4] == b'wOF2', 'Not a WOFF2 font'
        name = f'{slug}-{weight}.woff2'
        (dest / name).write_bytes(data)
        files.append({'file': name, 'bytes': len(data), 'source': urls[0]})
    source = f'https://raw.githubusercontent.com/google/fonts/main/ofl/{slug.replace("-", "")}/OFL.txt'
    with urllib.request.urlopen(source, timeout=30) as response:
        license_data = response.read()
    assert b'SIL OPEN FONT LICENSE' in license_data
    normalized_license = '\n'.join(line.rstrip() for line in license_data.decode('utf-8').splitlines()) + '\n'
    (dest / f'{slug}-OFL.txt').write_bytes(normalized_license.encode('utf-8'))
(dest / 'SOURCE.json').write_text(json.dumps({'families': ['Noto Serif SC', 'Noto Sans SC'], 'character_count': len(chars), 'files': files}, indent=2) + '\n', encoding='utf-8')
print(f'{len(files)} local WOFF2 subsets; {sum(f["bytes"] for f in files)} bytes; {len(chars)} characters')
