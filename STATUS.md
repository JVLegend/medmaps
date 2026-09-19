# STATUS · MedMaps

Atualizado em 19/09/2026.

## Estado atual
- Coleta completa do CNE: 117 especialidades, 400.486 médicos únicos com vínculo no CNES (coleta de 19/09/2026).
- Landing + ferramenta de mapa funcionando localmente (estados, municípios, 3 métricas, ranking, tooltip, detalhe por município).
- Worker do MapLibre 6 servido como arquivo estático (`public/maplibre`), porque o Vite não empacota a URL calculada em runtime.

## Próximos passos
- [ ] Deploy Vercel e domínio.
- [ ] Link cruzado com o Médicos Atualizados.
- [ ] Comparação entre duas especialidades ou entre dois anos (precisa de coleta recorrente).
- [ ] TopoJSON para reduzir a malha de municípios (3,3 MB hoje).

## Decisões
- Município = local do vínculo CNES, não endereço do CRM.
- Ranking por 100 mil hab. em nível municipal só entre municípios com 100 mil+ habitantes, para não premiar cidade pequena com 1 médico.
- Nenhum número estimado: tudo vem da coleta ou do IBGE; divergência coleta x total da API é registrada em `meta.json` (`totalApi`).
