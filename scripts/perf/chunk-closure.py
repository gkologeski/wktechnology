#!/usr/bin/env python3
"""Soma bytes (raw/gzip) do fechamento de imports ESTÁTICOS de chunks do cliente.
Uso: chunk-closure.py dist/client/assets <prefixo-chunk> [<prefixo> ...]
Ex.: chunk-closure.py dist/client/assets index- prospecting.index-"""
import gzip, os, re, sys
d = sys.argv[1]
files = {f: os.path.join(d, f) for f in os.listdir(d) if f.endswith(".js")}
IMP = re.compile(r'(?:import|export)\s*(?:[\w*{}\s,$]+from\s*)?["\']\./([\w.\-$]+\.js)["\']')
def deps(f):
    return set(IMP.findall(open(files[f], encoding="utf-8", errors="ignore").read()))
def biggest(prefix):
    c = [f for f in files if f.startswith(prefix)]
    return max(c, key=lambda f: os.path.getsize(files[f])) if c else None
seen, stack = set(), [biggest(p) for p in sys.argv[2:]]
while stack:
    f = stack.pop()
    if not f or f in seen or f not in files: continue
    seen.add(f); stack.extend(deps(f))
raw = sum(os.path.getsize(files[f]) for f in seen)
gz = sum(len(gzip.compress(open(files[f], "rb").read(), 9)) for f in seen)
print(f"chunks={len(seen)} raw={raw} gzip={gz} :: {' + '.join(sys.argv[2:])}")
