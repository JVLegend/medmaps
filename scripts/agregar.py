#!/usr/bin/env python3
"""Agrega a coleta do CNE (data/raw/*.jsonl) nos JSONs que o site consome (public/data).

Contagem: médico único (hash do CNE) por especialidade e por unidade geográfica.
Um médico com vínculo em dois municípios conta em ambos, mas conta uma vez no
total da UF e uma vez no total do Brasil. Município vem do CNES (co_municipio_ibge,
6 dígitos). População: Censo 2022 (IBGE/SIDRA tabela 4714).
"""
from __future__ import annotations

import json, re, time, unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW, DATA, OUT = ROOT / "data" / "raw", ROOT / "data", ROOT / "public" / "data"
UFS = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA", "22": "PI",
       "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES",
       "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF"}
UF_NOMES = {"RO": "Rondônia", "AC": "Acre", "AM": "Amazonas", "RR": "Roraima", "PA": "Pará", "AP": "Amapá", "TO": "Tocantins",
            "MA": "Maranhão", "PI": "Piauí", "CE": "Ceará", "RN": "Rio Grande do Norte", "PB": "Paraíba", "PE": "Pernambuco",
            "AL": "Alagoas", "SE": "Sergipe", "BA": "Bahia", "MG": "Minas Gerais", "ES": "Espírito Santo", "RJ": "Rio de Janeiro",
            "SP": "São Paulo", "PR": "Paraná", "SC": "Santa Catarina", "RS": "Rio Grande do Sul", "MS": "Mato Grosso do Sul",
            "MT": "Mato Grosso", "GO": "Goiás", "DF": "Distrito Federal"}


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def main() -> None:
    (OUT / "esp").mkdir(parents=True, exist_ok=True)
    (ROOT / "public" / "geo").mkdir(parents=True, exist_ok=True)

    pop = {}
    for r in json.load(open(DATA / "pop.json"))[1:]:
        pop[r["D1C"][:6]] = int(r["V"])
    muns = {}
    for m in json.load(open(DATA / "municipios.json")):
        c = str(m["municipio-id"])[:6]
        muns[c] = [m["municipio-nome"], m["UF-sigla"], pop.get(c, 0)]
    pop_uf = defaultdict(int)
    for c, (_, uf, p) in muns.items():
        pop_uf[uf] += p
    pop_br = sum(pop_uf.values())

    specs = json.load(open(RAW / "especialidades.json"))
    meta_esp, done_specs = [], []
    # "todas": união de médicos únicos em qualquer especialidade
    todos_mun, todos_uf, todos_br = defaultdict(set), defaultdict(set), set()
    todos_sus_mun, todos_sus_uf, todos_sus_br = defaultdict(set), defaultdict(set), set()
    for spec in specs:
        s = slug(spec)
        if not (RAW / f"{s}.done").exists():
            continue
        done_specs.append(spec)
        by_mun, by_uf, br = defaultdict(set), defaultdict(set), set()
        sus_mun, sus_uf, sus_br = defaultdict(set), defaultdict(set), set()
        sem_vinculo = 0
        for line in open(RAW / f"{s}.jsonl"):
            r = json.loads(line)
            h = r["h"]
            br.add(h); todos_br.add(h)
            if not r["d"]:
                sem_vinculo += 1
                continue
            for d in r["d"]:
                m, uf = d.get("m"), d.get("uf")
                if not m or m not in muns:
                    continue
                by_mun[m].add(h); by_uf[uf].add(h); todos_mun[m].add(h); todos_uf[uf].add(h)
                if d.get("sus") == "SIM":
                    sus_mun[m].add(h); sus_uf[uf].add(h); sus_br.add(h)
                    todos_sus_mun[m].add(h); todos_sus_uf[uf].add(h); todos_sus_br.add(h)
        info = json.loads((RAW / f"{s}.done").read_text())
        meta_esp.append({"id": s, "nome": spec, "total": len(br), "totalApi": info["total_api"], "sus": len(sus_br),
                         "semVinculo": sem_vinculo,
                         "uf": {uf: [len(v), len(sus_uf[uf])] for uf, v in sorted(by_uf.items())}})
        json.dump({m: [len(v), len(sus_mun[m])] for m, v in sorted(by_mun.items())},
                  open(OUT / "esp" / f"{s}.json", "w"), separators=(",", ":"))
    meta_esp.insert(0, {"id": "todas", "nome": "Todas as especialidades", "total": len(todos_br), "totalApi": None,
                        "sus": len(todos_sus_br), "semVinculo": None,
                        "uf": {uf: [len(v), len(todos_sus_uf[uf])] for uf, v in sorted(todos_uf.items())}})
    json.dump({m: [len(v), len(todos_sus_mun[m])] for m, v in sorted(todos_mun.items())},
              open(OUT / "esp" / "todas.json", "w"), separators=(",", ":"))
    json.dump(muns, open(OUT / "municipios.json", "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump({"geradoEm": time.strftime("%Y-%m-%d"), "especialidadesColetadas": len(done_specs), "especialidadesTotal": len(specs),
               "populacaoBR": pop_br, "populacaoUF": dict(pop_uf), "ufNomes": UF_NOMES,
               "fontes": {"medicos": "Cadastro Nacional de Especialistas (CNE), Ministério da Saúde/UNA-SUS, consulta pública por especialidade; município = vínculo no CNES",
                          "populacao": "IBGE, Censo Demográfico 2022 (SIDRA, tabela 4714)", "malhas": "IBGE, API de malhas v3 (qualidade mínima)"},
               "especialidades": meta_esp}, open(OUT / "meta.json", "w"), ensure_ascii=False, separators=(",", ":"))

    # malhas: codarea 7 dígitos -> id 6 dígitos + nome/uf; UF codarea 2 dígitos -> sigla
    g = json.load(open(DATA / "mun.json"))
    for f in g["features"]:
        c = f["properties"]["codarea"][:6]
        n, uf, p = muns.get(c, ["?", "?", 0])
        f["properties"] = {"id": c, "n": n, "uf": uf}
        f["id"] = int(c)
    json.dump(g, open(ROOT / "public" / "geo" / "municipios.json", "w"), ensure_ascii=False, separators=(",", ":"))
    g = json.load(open(DATA / "ufs.json"))
    for f in g["features"]:
        sg = UFS[f["properties"]["codarea"]]
        f["properties"] = {"id": sg, "n": UF_NOMES[sg]}
        f["id"] = int(f["properties"].get("codarea", 0) or 0) or int([k for k, v in UFS.items() if v == sg][0])
    json.dump(g, open(ROOT / "public" / "geo" / "ufs.json", "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"ok: {len(done_specs)}/{len(specs)} especialidades, {len(muns)} municipios, pop BR {pop_br:,}")
    print("todas:", len(todos_br), "medicos unicos; sem municipio no CNES:", sum(1 for _ in []))


if __name__ == "__main__":
    main()
