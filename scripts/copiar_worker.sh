#!/bin/sh
# MapLibre 6 carrega o worker por URL calculada em tempo de execução (new URL('./maplibre-gl-worker.mjs', import.meta.url)),
# que o Vite não consegue empacotar. Servimos o worker e o chunk compartilhado como arquivos estáticos e apontamos com setWorkerUrl.
set -e
cd "$(dirname "$0")/.."
mkdir -p public/maplibre
cp node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs public/maplibre/
echo "worker do MapLibre copiado para public/maplibre"
