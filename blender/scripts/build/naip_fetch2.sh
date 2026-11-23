#!/bin/bash
# parallel per-folder NAIP fetch; skips files already downloaded as valid JPEGs; 3 retry rounds
S=$1
fetch_dir() {
  d=$1
  for round in 1 2 3; do
    python3 - "$S/data/naip/$d/list.txt" "$S/data/naip/$d/todo.txt" <<'PY'
import sys, os, re, subprocess
src, dst = sys.argv[1], sys.argv[2]
L = open(src).read().strip().split('\n'); out = []
for i in range(0, len(L), 2):
    o = re.search(r'output="(.*)"', L[i+1]).group(1)
    ok = os.path.exists(o) and os.path.getsize(o) > 20000 and open(o, 'rb').read(3) == b'\xff\xd8\xff'
    if not ok:
        if os.path.exists(o): os.remove(o)
        out += [L[i], L[i+1]]
open(dst, 'w').write('\n'.join(out) + ('\n' if out else ''))
print(len(out) // 2)
PY
    [ -s "$S/data/naip/$d/todo.txt" ] || break
    (cd $S/data/naip/$d && curl -s --retry 2 --max-time 240 --parallel --parallel-max 4 -K todo.txt)
  done
  echo "$d: $(ls $S/data/naip/$d/*.jpg 2>/dev/null | wc -l)"
}
fetch_dir boxes & fetch_dir cells & fetch_dir base & wait
