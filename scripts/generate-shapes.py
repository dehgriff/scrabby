"""Enumerate every connected shape of 2–12 squares, up to translation/transpose.

Reflection is deliberately NOT removed: words read rightwards and downwards.
Output records: tile count, score, then row*16+column for each occupied square.
"""
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parent.parent

def canonical(cells):
    min_r = min(r for r, c in cells)
    min_c = min(c for r, c in cells)
    a = bytes(sorted((r-min_r)*16+c-min_c for r, c in cells))
    b = bytes(sorted((c-min_c)*16+r-min_r for r, c in cells))
    return min(a, b)

def score(shape):
    cells = set(shape)
    runs = []
    for p in shape:
        for d in (1, 16):
            # Horizontal offsets cannot wrap because coordinates are <= 11.
            if p-d not in cells and p+d in cells:
                length = 1
                while p+length*d in cells:
                    length += 1
                runs.append(length)
    return max(runs) + len(runs) + (len(shape) == 12)

def main():
    shapes = {bytes([0])}
    records = []
    for size in range(2, 13):
        following = set()
        for shape in shapes:
            cells = [(p//16, p%16) for p in shape]
            occupied = set(cells)
            boundary = {(r+dr,c+dc) for r,c in cells
                        for dr,dc in ((0,1),(0,-1),(1,0),(-1,0))} - occupied
            for p in boundary:
                following.add(canonical(cells+[p]))
        shapes = following
        for shape in shapes:
            records.append((score(shape), size, shape))
        print(size, len(shapes), 'best score', max(score(s) for s in shapes), flush=True)
    records.sort(key=lambda x: (-x[0], -x[1], x[2]))
    output = bytearray()
    for points, size, shape in records:
        output.extend((size, points))
        output.extend(shape)
    (ROOT/'data/shapes.bin').write_bytes(output)
    print('Wrote', len(records), 'shapes;', len(output), 'bytes')
    print('Scores:', sorted(Counter(p for p,n,s in records).items(), reverse=True))

if __name__ == '__main__':
    main()
