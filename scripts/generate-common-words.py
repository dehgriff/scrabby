"""Generate the browser asset with wordfreq 3.1.1 (development-only dependency).

Keep SOWPODS words of 4–12 letters with English Zipf frequency >= 2.0,
roughly once per 10 million words. No packages are needed at runtime.
"""
from importlib.metadata import version
from pathlib import Path
from wordfreq import zipf_frequency
import gzip

if version('wordfreq') != '3.1.1':
    raise RuntimeError('Use wordfreq==3.1.1 to reproduce the bundled list.')

root = Path(__file__).resolve().parent.parent
sowpods = gzip.decompress((root / 'data/sowpods.txt.gz').read_bytes()).decode().splitlines()
common = sorted({word for word in sowpods if 4 <= len(word) <= 12
                 and zipf_frequency(word.lower(), 'en') >= 2.0})
target = root / 'data/common-words.txt'
target.write_text('\n'.join(common) + '\n')
print(f'Wrote {len(common):,} common SOWPODS words to {target.name}')
