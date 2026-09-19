#!/usr/bin/env python3
"""Coleta o Cadastro Nacional de Especialistas (CNE, Ministério da Saúde) por especialidade.

Fonte pública: https://degerts.unasus.gov.br/cadastro-nacional-de-especialistas
Endpoint: POST /api-cne/busca/especialidade?page=N&take=1000

Para cada especialidade médica, pagina a consulta inteira e grava um JSONL compacto
em data/raw/<slug>.jsonl (1 linha por profissional, só os campos usados no mapa).
Retomável: páginas já gravadas não são pedidas de novo; especialidade concluída
ganha um arquivo .done com o total informado pela API.
"""
from __future__ import annotations

import json, re, sys, time, unicodedata, urllib.request, urllib.error
from pathlib import Path

BASE = "https://degerts.unasus.gov.br/cadastro-nacional-de-especialistas/api-cne"
RAW = Path(__file__).resolve().parents[1] / "data" / "raw"
TAKE = 1000
MIN_INTERVAL = 1.0
TIMEOUT = 180


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def request(url: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method="POST" if body is not None else "GET",
                                 headers={"Content-Type": "application/json", "Accept": "application/json",
                                          "User-Agent": "medmaps-coletor/1.0 (uso academico; contato: jvictordias@gmail.com)"})
    last = None
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            last = e
            if 400 <= e.code < 500 and e.code != 429:
                raise
        except Exception as e:  # timeout, reset, json
            last = e
        wait = min(120, 10 * (attempt + 1))
        log(f"  retry {attempt+1} em {wait}s: {last}")
        time.sleep(wait)
    raise RuntimeError(f"falhou apos retries: {last}")


def log(msg: str) -> None:
    line = f"{time.strftime('%H:%M:%S')} {msg}"
    print(line, flush=True)
    with open(RAW / "progress.log", "a") as f:
        f.write(line + "\n")


def compact(row: dict) -> dict | None:
    p = row.get("profissional") or {}
    if not p.get("co_hash_profissional"):
        return None
    return {
        "h": p["co_hash_profissional"],
        "crm": p.get("nu_crm") or [],
        "esp": [(e.get("nome"), e.get("origem")) for e in (p.get("especialidades") or [])],
        "d": [
            {"m": d.get("co_municipio_ibge"), "uf": d.get("sg_uf_atuacao"), "sus": d.get("st_atende_sus"),
             "cbo": (d.get("ds_ocupacao") or "")[:6], "ch": d.get("nu_carga_horaria_total"), "cnes": d.get("co_cnes")}
            for d in (p.get("dado") or [])
        ],
    }


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    specs = request(f"{BASE}/especialidades/medicina")["result"]
    log(f"{len(specs)} especialidades")
    (RAW / "especialidades.json").write_text(json.dumps(specs, ensure_ascii=False, indent=1))
    last_req = 0.0
    for spec in specs:
        s = slug(spec)
        out, done = RAW / f"{s}.jsonl", RAW / f"{s}.done"
        if done.exists():
            continue
        have = sum(1 for _ in open(out)) if out.exists() else 0
        page = have // TAKE + 1
        if have % TAKE:  # página parcial: recomeça a especialidade do zero
            out.unlink(); have, page = 0, 1
        body = {"ds_profissao": "Medicina", "ds_especialidade_formatada": spec, "co_regiao": "", "co_uf": "",
                "co_macrorregional": "", "co_regiao_saude": "", "co_municipio_ibge": ""}
        total = None
        with open(out, "a") as f:
            while True:
                wait = MIN_INTERVAL - (time.monotonic() - last_req)
                if wait > 0:
                    time.sleep(wait)
                t0 = time.monotonic()
                last_req = t0
                payload = request(f"{BASE}/busca/especialidade?page={page}&ordering=asc&take={TAKE}", body)
                total = int(payload.get("total") or 0)
                rows = payload.get("result") or []
                n = 0
                for row in rows:
                    c = compact(row)
                    if c:
                        f.write(json.dumps(c, ensure_ascii=False) + "\n"); n += 1
                f.flush()
                have += len(rows)
                log(f"{spec}: pagina {page} ({len(rows)} linhas, {n} validas) total={total} acumulado={have} {time.monotonic()-t0:.1f}s")
                if not rows or have >= total:
                    break
                page += 1
        done.write_text(json.dumps({"especialidade": spec, "total_api": total, "linhas": have,
                                    "coletado_em": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}, ensure_ascii=False))
    log("FIM")


if __name__ == "__main__":
    main()
