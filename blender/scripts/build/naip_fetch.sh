#!/bin/bash
# download all NAIP lists with limited parallelism; retry failures (non-JPEG or tiny files) up to 3 rounds
S=$1
for round in 1 2 3; do
  for d in boxes cells base; do
    (cd $S/data/naip/$d && curl -s --retry 2 --max-time 240 --parallel --parallel-max 4 -K list.txt)
  done
  bad=0
  for d in boxes cells base; do
    for f in $S/data/naip/$d/*.jpg; do
      if ! file "$f" | grep -q JPEG; then rm -f "$f"; bad=$((bad+1)); fi
    done
  done
  echo "round $round: bad=$bad"
  [ $bad -eq 0 ] && break
  # rebuild lists to only missing files
  for d in boxes cells base; do
    python3 - "$S/data/naip/$d/list.txt" <<'PY'
import sys, os, re
p=sys.argv[1]; L=open(p).read().strip().split('\n'); out=[]
for i in range(0,len(L),2):
    o=re.search(r'output="(.*)"',L[i+1]).group(1)
    if not os.path.exists(o): out+= [L[i],L[i+1]]
open(p,'w').write('\n'.join(out)+('\n' if out else ''))
PY
  done
done
for d in boxes cells base; do echo "$d: $(ls $S/data/naip/$d/*.jpg 2>/dev/null | wc -l)"; done
