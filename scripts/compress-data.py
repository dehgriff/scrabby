"""Refresh the browser's compressed data assets after regenerating sources."""
import gzip
from pathlib import Path

root = Path(__file__).resolve().parent.parent
for filename in ('sowpods.txt', 'shapes.bin'):
    source = root / 'data' / filename
    target = source.with_suffix(source.suffix + '.gz')
    target.write_bytes(gzip.compress(source.read_bytes(), mtime=0))
    print(f'{target.name}: {target.stat().st_size:,} bytes')
