"""Mitjanes de la pedrera a partir de les estadístiques de la FECAPA (temporada passada + temporada actual).

Ús: python3 mitjanes_pedrera.py index.html stats.json > youth_ovr.json
  stats.json: llista de files [id_jugador, temporada("25"|"26"…), nivell, PJ, G, A]
  (nivells: NAC, 1A, 2A, 3A, JOR, JPL, JVO, JVP, IOR, IPL)
Sortida: {"ovr": {"<id>": mitjana dins la franja de la seva categoria}, "st": {"<id>": [PJ, G, A] de la temporada actual}}.

Com més avança la temporada, més pes tenen els partits de l'actual (un partit d'enguany val 1,6 de l'anterior).
Els jugadors sense partits es queden aproximadament on eren dins de la seva categoria.
"""
import json, re, sys
# Juvenils: franja segons l'edat. Els que també surten a una plantilla infantil (YINF) tenen edat d'infantil.
BAND = {"JVP": (44, 48), "JVO": (49, 54), "JVP_J": (49, 52), "JVO_J": (55, 58), "3A": (55, 60), "JPL": (55, 58), "JUN": (56, 60), "AUT1": (56, 61),
        "2A": (57, 63), "JOR": (57, 62), "1A": (60, 66), "NAC": (63, 68)}
LV = {"NAC": 6.0, "1A": 5.0, "2A": 4.0, "JOR": 3.8, "3A": 3.0, "JPL": 2.8, "JVO": 2.5, "JVP": 1.6, "IOR": 1.4, "IPL": 0.9}
# Mitges ajustades a mà per l'usuari: no es toquen
FIXED_NAMES = {"Joel Bancells", "Ot Caimel", "Lluc Oller", "Aran Faig", "Genis Fugarolas", "Grau Sousa", "Martin Sillero", "Sergi Munso"}

def infantils(html):
    line = next((l for l in html.split("\n") if l.startswith("const YINF=")), None)
    return set(json.loads(line[len("const YINF=new Set("):].rstrip().rstrip(";").rstrip(")"))) if line else set()

def youth_rows(html):
    line = next(l for l in html.split("\n") if l.startswith("const YOUTH="))
    js = line[len("const YOUTH="):].rstrip().rstrip(";")
    js = re.sub(r'_tx\(("(?:[^"\\]|\\.)*")\)', r'\1', js)
    return json.loads(js)

def row_score(level, pj, g, a, gk):
    pj = max(pj, 1)
    s = LV.get(level, 2.5) * 10 + 3 * min(pj, 26) / 26
    if not gk:
        s += 6 * min((g + 0.6 * a) / pj, 2.0)
    return s

def main():
    html = open(sys.argv[1], encoding="utf-8").read()
    stats = json.load(open(sys.argv[2]))
    cur = max(r[1] for r in stats)
    Y = youth_rows(html)
    INF = infantils(html)
    by, seen, st = {}, set(), {}
    for r in stats:
        k = tuple(str(x) for x in r)
        if k in seen:
            continue
        seen.add(k)
        by.setdefault(str(r[0]), []).append(r)
        if r[1] == cur:
            t = st.setdefault(str(r[0]), [0, 0, 0])
            t[0] += int(r[3]); t[1] += int(r[4]); t[2] += int(r[5])
    out = {}
    for cat, (lo, hi) in BAND.items():
        base = cat[:-2] if cat.endswith("_J") else cat
        P = [y for y in Y if y[3] == base and (base not in ("JVO", "JVP") or (y[0] in INF) != cat.endswith("_J"))]
        if not P:
            continue
        old = sorted(P, key=lambda y: y[7])
        oldpct = {y[0]: (i / max(1, len(old) - 1)) for i, y in enumerate(old)}
        keyed = []
        for y in P:
            rs = by.get(str(y[0]), [])
            gk = y[6] == "POR"
            if rs:
                num = den = 0
                for (_id, season, lvl, pj, g, a) in rs:
                    pj, g, a = int(pj), int(g), int(a)
                    w = min(pj, 26) * (1.6 if season == cur else 1.0)
                    num += w * row_score(lvl, pj, g, a, gk); den += w
                keyed.append((y, num / den, True))
            else:
                keyed.append((y, None, False))
        sc = [k for _, k, ok in keyed if ok]
        if sc:
            sc_sorted = sorted(sc)
            def pct(v):
                return sum(1 for x in sc_sorted if x <= v) / len(sc_sorted)
        final = []
        for y, k, ok in keyed:
            p = pct(k) if ok and sc else oldpct[y[0]] * 0.85
            final.append((y, p))
        final.sort(key=lambda t: t[1])
        n = len(final)
        for i, (y, _) in enumerate(final):
            if y[1] in FIXED_NAMES and y[2] == "MAC":
                continue
            v = round(lo + (i / max(1, n - 1)) * (hi - lo))
            out[str(y[0])] = v
    json.dump({"ovr": out, "st": st}, sys.stdout, ensure_ascii=False)

if __name__ == "__main__":
    main()
