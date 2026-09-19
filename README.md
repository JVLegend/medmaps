# MedMaps · Atlas das especialidades médicas do Brasil

Mapa interativo de onde estão os médicos especialistas do Brasil, por estado e por município,
com densidade por 100 mil habitantes e parcela que atende pelo SUS. Formato inspirado no
[ElectoMaps](https://electomaps.com.br), aplicado à demografia médica.

## Fontes

| Dado | Fonte | Como entra |
|---|---|---|
| Médicos e especialidades | Cadastro Nacional de Especialistas (CNE), Ministério da Saúde / UNA-SUS, consulta pública por especialidade | `scripts/coletar_cne.py` pagina a API pública e grava `data/raw/*.jsonl` |
| Município e vínculo | CNES/DataSUS, conforme publicado dentro do CNE (`co_municipio_ibge`, `st_atende_sus`) | mesmo coletor |
| População | IBGE, Censo 2022 (SIDRA, tabela 4714) | `data/pop.json` |
| Malhas | IBGE, API de malhas v3, qualidade mínima | `data/ufs.json`, `data/mun.json` |

Regra de contagem: médico único (hash público do CNE) por especialidade e por unidade geográfica.
Quem tem vínculo em dois municípios conta nos dois, mas uma vez no estado e uma vez no Brasil.

## Rodar

```bash
npm install            # também copia o worker do MapLibre para public/maplibre
npm run dev
```

Reprocessar os dados (a coleta completa leva cerca de 35 minutos, 117 especialidades):

```bash
python3 scripts/coletar_cne.py   # retomável; grava data/raw (ignorado pelo git)
python3 scripts/agregar.py       # gera public/data/*.json e public/geo/*.json
```

## Estrutura

- `src/Landing.tsx`: página inicial.
- `src/Mapa.tsx`: ferramenta de mapa (MapLibre GL, sem basemap externo).
- `public/data/meta.json`: especialidades com totais por UF; `public/data/esp/<id>.json`: contagem por município.
- `public/geo/`: malhas do IBGE com `id` numérico para `feature-state`.

## Deploy

Vercel, projeto `medmaps`, build `vite build`, saída `dist/`. Hash routing (`#/mapa`), sem rewrites.
