import glob, json, os, re, sys
b, n, c, t, load_s, cold_team, cold_me, warm_team, warm_me, cpus, mem = sys.argv[1:12]
def pct(v, p):
    if not v: return None
    v = sorted(v); k = max(0, min(len(v) - 1, int(round(p / 100 * len(v) + 0.5)) - 1)); return round(v[k] / 1000, 1)
out = {"entries": int(n), "clients": int(c), "duration_s": int(t), "fixture_load_s": int(load_s), "cpus": int(cpus), "mem_gb": int(mem),
       "single_run_ms": {"team_cold": int(cold_team), "me_cold": int(cold_me), "team_warm": int(warm_team), "me_warm": int(warm_me)},
       "scenarios": {}}
names = {"mixed": ["write", "dash_me", "dash_team"]}
for scen in ["write", "dash_me", "api_list", "mixed"]:
    lat = {}
    for f in glob.glob(os.path.join(b, f"{scen}.*")):
        if f.endswith(".out"): continue
        for line in open(f):
            p = line.split()
            if len(p) < 6: continue
            script = names.get(scen, [scen])[int(p[3])] if scen in names else scen
            lat.setdefault(script, []).append(int(p[2]))
    txt = open(os.path.join(b, f"{scen}.out")).read()
    failed = re.search(r"number of failed transactions: (\d+)", txt)
    tps = re.search(r"tps = ([\d.]+)", txt)
    out["scenarios"][scen] = {"tps": float(tps.group(1)) if tps else None, "failed": int(failed.group(1)) if failed else None,
        "errors_in_log": len(re.findall(r"ERROR", txt)),
        "by_script": {k: {"n": len(v), "p50_ms": pct(v, 50), "p95_ms": pct(v, 95), "p99_ms": pct(v, 99), "max_ms": round(max(v) / 1000, 1)} for k, v in lat.items()}}
out["final_entries"] = int(open(os.path.join(b, "final_count.txt")).read().strip())
out["duplicate_client_requests"] = int(open(os.path.join(b, "dup_requests.txt")).read().strip())
json.dump(out, open(os.path.join(b, "summary.json"), "w"), indent=1)
print(json.dumps(out, indent=1))
