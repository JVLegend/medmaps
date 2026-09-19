import { useEffect, useMemo, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Feature, FeatureCollection } from 'geojson'
import { loadEsp, loadGeo, loadMeta, loadMunicipios, useJson } from './data'
import { METRICAS, fmt, fmtInt, valor } from './types'
import type { Metrica, Nivel, Par } from './types'

// worker servido como arquivo estático (ver scripts/copiar_worker.sh)
maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs')

const RAMPA = ['#1b3436', '#1f4f52', '#25777a', '#2d9f9d', '#4fd1c5', '#a8f0dc']
const COR_ZERO = '#1a1d20'
const COR_SEM = '#141618'
const BR_BOUNDS: [[number, number], [number, number]] = [[-74, -34], [-34, 5.5]]

const estiloVazio: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'fundo', type: 'background', paint: { 'background-color': '#0e1012' } }],
}

function bbox(fc: FeatureCollection, filtro: (f: Feature) => boolean): [[number, number], [number, number]] {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90
  for (const f of fc.features) {
    if (!filtro(f)) continue
    const g = f.geometry
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
    for (const poly of polys) for (const ring of poly) for (const [x, y] of ring) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
    }
  }
  return [[x0, y0], [x1, y1]]
}

function quantis(vals: number[]): number[] {
  const v = vals.filter((x) => x > 0).sort((a, b) => a - b)
  if (!v.length) return [0, 1]
  const q = (p: number) => v[Math.min(v.length - 1, Math.floor(p * (v.length - 1)))]
  const stops = [q(0), q(0.2), q(0.4), q(0.6), q(0.8), q(0.97)]
  for (let i = 1; i < stops.length; i++) if (stops[i] <= stops[i - 1]) stops[i] = stops[i - 1] + 1e-6
  return stops
}

// posição 0..1 de um valor na escala de quantis (interpolação linear entre stops)
function posicao(v: number, stops: number[]): number {
  if (v <= stops[0]) return 0
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i]) return (i - 1 + (v - stops[i - 1]) / (stops[i] - stops[i - 1])) / (stops.length - 1)
  }
  return 1
}

type Hover = { nome: string; sub: string; par: Par | undefined; pop: number; x: number; y: number }

function lerParams() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '')
  return { esp: q.get('esp') || 'todas', uf: q.get('uf') || '', nivel: (q.get('nivel') as Nivel) || 'uf', metrica: (q.get('metrica') as Metrica) || 'por100k' }
}

export default function Mapa() {
  const inicial = useMemo(lerParams, [])
  const [espId, setEspId] = useState(inicial.esp)
  const [nivel, setNivel] = useState<Nivel>(inicial.nivel)
  const [uf, setUf] = useState(inicial.uf)
  const [metrica, setMetrica] = useState<Metrica>(inicial.metrica)
  const [hover, setHover] = useState<Hover | null>(null)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [pronto, setPronto] = useState(false)
  const [camadas, setCamadas] = useState(false)

  const { data: meta } = useJson(loadMeta, 'meta')
  const { data: muns } = useJson(loadMunicipios, 'muns')
  const { data: geoUf } = useJson(() => loadGeo('ufs'), 'ufs')
  const { data: geoMun } = useJson(() => loadGeo('municipios'), 'municipios')
  const { data: espMun, erro: erroEsp } = useJson(() => loadEsp(espId), espId)

  const esp = meta?.especialidades.find((e) => e.id === espId) ?? meta?.especialidades[0]
  useEffect(() => {
    if (meta && !meta.especialidades.some((e) => e.id === espId)) setEspId('todas')
  }, [meta, espId])

  useEffect(() => {
    const q = new URLSearchParams()
    if (espId !== 'todas') q.set('esp', espId)
    if (uf) q.set('uf', uf)
    if (nivel !== 'uf') q.set('nivel', nivel)
    if (metrica !== 'por100k') q.set('metrica', metrica)
    const s = q.toString()
    history.replaceState(null, '', '#/mapa' + (s ? '?' + s : ''))
  }, [espId, uf, nivel, metrica])

  // valores por unidade no escopo atual
  const escopo = useMemo(() => {
    if (!meta || !esp || !muns) return null
    const itens: { id: string; nome: string; sub: string; par: Par | undefined; pop: number; v: number | null }[] = []
    if (nivel === 'uf') {
      for (const sg of Object.keys(meta.ufNomes)) {
        const pop = meta.populacaoUF[sg] ?? 0
        const par = esp.uf[sg]
        itens.push({ id: sg, nome: meta.ufNomes[sg], sub: sg, par, pop, v: valor(par, pop, metrica) })
      }
    } else if (espMun) {
      for (const [id, [nome, sg, pop]] of Object.entries(muns)) {
        if (uf && sg !== uf) continue
        const par = espMun[id]
        itens.push({ id, nome, sub: sg, par, pop, v: valor(par, pop, metrica) })
      }
    }
    const stops = metrica === 'sus' ? [0, 20, 40, 60, 80, 100] : quantis(itens.map((i) => i.v ?? 0))
    return { itens, stops }
  }, [meta, esp, muns, espMun, nivel, uf, metrica])

  // ---- mapa
  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const hoverIdRef = useRef<{ source: string; id: number } | null>(null)

  useEffect(() => {
    if (!divRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: divRef.current, style: estiloVazio, bounds: BR_BOUNDS, fitBoundsOptions: { padding: 24 },
      attributionControl: false, maxZoom: 11, minZoom: 2.5, dragRotate: false, pitchWithRotate: false,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('load', () => setPronto(true))
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !pronto || !geoUf || !geoMun) return
    if (map.getSource('muns')) return
    const cor = (): maplibregl.ExpressionSpecification => [
      'case',
      ['==', ['feature-state', 't'], null], COR_SEM,
      ['<', ['feature-state', 't'], 0], COR_ZERO,
      ['interpolate', ['linear'], ['feature-state', 't'],
        0, RAMPA[0], 0.2, RAMPA[1], 0.4, RAMPA[2], 0.6, RAMPA[3], 0.8, RAMPA[4], 1, RAMPA[5]],
    ] as unknown as maplibregl.ExpressionSpecification

    map.addSource('muns', { type: 'geojson', data: geoMun })
    map.addSource('ufs', { type: 'geojson', data: geoUf })
    const fill = (id: string, source: string) => map.addLayer({
      id, type: 'fill', source, layout: { visibility: 'none' },
      paint: {
        'fill-color': cor(),
        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0.88],
      },
    })
    fill('mun-fill', 'muns')
    fill('uf-fill', 'ufs')
    map.addLayer({ id: 'mun-line', type: 'line', source: 'muns', layout: { visibility: 'none' }, paint: { 'line-color': '#0e1012', 'line-width': 0.4, 'line-opacity': 0.8 } })
    map.addLayer({ id: 'uf-line', type: 'line', source: 'ufs', paint: { 'line-color': '#e9e6df', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 7, 1.4], 'line-opacity': 0.55 } })
    map.addLayer({ id: 'hover-line', type: 'line', source: 'muns', filter: ['==', ['id'], -1], paint: { 'line-color': '#fff', 'line-width': 1.6 } })
    map.addLayer({ id: 'hover-line-uf', type: 'line', source: 'ufs', filter: ['==', ['id'], -1], paint: { 'line-color': '#fff', 'line-width': 2 } })
    setCamadas(true)
  }, [pronto, geoUf, geoMun])

  // aplica cores (feature-state) e visibilidade conforme nível/escopo
  useEffect(() => {
    const map = mapRef.current
    if (!map || !camadas || !escopo) return
    const source = nivel === 'uf' ? 'ufs' : 'muns'
    map.setLayoutProperty('uf-fill', 'visibility', nivel === 'uf' ? 'visible' : 'none')
    map.setLayoutProperty('mun-fill', 'visibility', nivel === 'uf' ? 'none' : 'visible')
    map.setLayoutProperty('mun-line', 'visibility', nivel === 'uf' ? 'none' : 'visible')
    if (nivel === 'municipio') {
      const filtro: maplibregl.FilterSpecification | null = uf ? ['==', ['get', 'uf'], uf] : null
      map.setFilter('mun-fill', filtro); map.setFilter('mun-line', filtro)
    }
    map.removeFeatureState({ source: 'muns' }); map.removeFeatureState({ source: 'ufs' })
    for (const it of escopo.itens) {
      const id = nivel === 'uf' ? ufCodigo(it.id) : Number(it.id)
      const t = it.v === null ? null : (it.par?.[0] ?? 0) === 0 ? -1 : posicao(it.v, escopo.stops)
      map.setFeatureState({ source, id }, { t })
    }
  }, [escopo, nivel, uf, camadas])

  // enquadramento
  useEffect(() => {
    const map = mapRef.current
    if (!map || !pronto || !geoUf) return
    if (uf) map.fitBounds(bbox(geoUf, (f) => f.properties?.id === uf), { padding: 40, duration: 700 })
    else map.fitBounds(BR_BOUNDS, { padding: 24, duration: 700 })
  }, [uf, pronto, geoUf])

  // interação
  useEffect(() => {
    const map = mapRef.current
    if (!map || !camadas || !escopo || !muns || !meta) return
    const layer = nivel === 'uf' ? 'uf-fill' : 'mun-fill'
    const source = nivel === 'uf' ? 'ufs' : 'muns'
    const porId = new Map(escopo.itens.map((i) => [i.id, i]))
    const limpa = () => {
      if (mapRef.current !== map || !map.getSource('muns')) { hoverIdRef.current = null; setHover(null); return }
      if (hoverIdRef.current) map.setFeatureState(hoverIdRef.current, { hover: false })
      hoverIdRef.current = null
      map.setFilter('hover-line', ['==', ['id'], -1]); map.setFilter('hover-line-uf', ['==', ['id'], -1])
      setHover(null)
    }
    const move = (e: maplibregl.MapMouseEvent) => {
      const f = map.queryRenderedFeatures(e.point, { layers: [layer] })[0]
      if (!f) { limpa(); map.getCanvas().style.cursor = ''; return }
      map.getCanvas().style.cursor = 'pointer'
      const idProp = String(f.properties?.id)
      const fid = Number(f.id)
      if (hoverIdRef.current?.id !== fid) {
        if (hoverIdRef.current) map.setFeatureState(hoverIdRef.current, { hover: false })
        hoverIdRef.current = { source, id: fid }
        map.setFeatureState(hoverIdRef.current, { hover: true })
        map.setFilter(nivel === 'uf' ? 'hover-line-uf' : 'hover-line', ['==', ['id'], fid])
      }
      const it = porId.get(idProp)
      setHover({ nome: it?.nome ?? String(f.properties?.n), sub: nivel === 'uf' ? idProp : String(f.properties?.uf), par: it?.par, pop: it?.pop ?? 0, x: e.point.x, y: e.point.y })
    }
    const clique = (e: maplibregl.MapMouseEvent) => {
      const f = map.queryRenderedFeatures(e.point, { layers: [layer] })[0]
      if (!f) return
      const idProp = String(f.properties?.id)
      if (nivel === 'uf') { setUf(idProp); setNivel('municipio'); setSelecionado(null) }
      else setSelecionado(idProp)
    }
    map.on('mousemove', move); map.on('mouseout', limpa); map.on('click', clique)
    return () => { map.off('mousemove', move); map.off('mouseout', limpa); map.off('click', clique); limpa() }
  }, [camadas, escopo, nivel, muns, meta])

  // ---- painel
  const resumo = useMemo(() => {
    if (!meta || !esp) return null
    const pop = uf ? meta.populacaoUF[uf] : meta.populacaoBR
    const par: Par | undefined = uf ? esp.uf[uf] : [esp.total, esp.sus]
    const n = par?.[0] ?? 0
    let cobertura: { com: number; total: number } | null = null
    if (espMun && muns) {
      let com = 0, total = 0
      for (const [id, [, sg]] of Object.entries(muns)) { if (uf && sg !== uf) continue; total++; if ((espMun[id]?.[0] ?? 0) > 0) com++ }
      cobertura = { com, total }
    }
    return { pop, n, por100k: valor(par, pop, 'por100k'), sus: valor(par, pop, 'sus'), cobertura }
  }, [meta, esp, uf, espMun, muns])

  const ranking = useMemo(() => {
    if (!escopo) return []
    const minPop = nivel === 'municipio' && metrica !== 'total' ? 100000 : 0
    return escopo.itens.filter((i) => i.v !== null && i.pop >= minPop && (i.par?.[0] ?? 0) > 0).sort((a, b) => (b.v ?? 0) - (a.v ?? 0)).slice(0, 12)
  }, [escopo, nivel, metrica])

  const detalhe = useMemo(() => {
    if (!selecionado || !escopo || nivel !== 'municipio') return null
    const it = escopo.itens.find((i) => i.id === selecionado)
    if (!it) return null
    const ordenado = escopo.itens.filter((i) => i.v !== null).sort((a, b) => (b.v ?? 0) - (a.v ?? 0))
    const pos = ordenado.findIndex((i) => i.id === it.id)
    return { ...it, pos: pos + 1, de: ordenado.length }
  }, [selecionado, escopo, nivel])

  const especialidadesFiltradas = useMemo(() => {
    if (!meta) return []
    const q = normaliza(busca)
    return meta.especialidades.filter((e) => !q || normaliza(e.nome).includes(q))
  }, [meta, busca])

  const met = METRICAS.find((m) => m.id === metrica)!
  const lugar = uf && meta ? meta.ufNomes[uf] : 'Brasil'

  return (
    <div className="mapa-tela">
      <aside className="painel">
        <div className="painel-topo">
          <a href="#/" className="voltar">← Início</a>
          <a href="#/" className="marca">MedMaps</a>
        </div>

        <label className="campo">
          <span>Especialidade</span>
          <input type="search" placeholder="Filtrar a lista…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Filtrar especialidades" />
          <select value={espId} onChange={(e) => { setEspId(e.target.value); setSelecionado(null) }} size={busca ? 6 : undefined}>
            {especialidadesFiltradas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </label>

        <div className="campo">
          <span>Nível</span>
          <div className="segmentado" role="tablist">
            <button role="tab" aria-selected={nivel === 'uf'} onClick={() => { setNivel('uf'); setSelecionado(null) }}>Estados</button>
            <button role="tab" aria-selected={nivel === 'municipio'} onClick={() => setNivel('municipio')}>Municípios</button>
          </div>
        </div>

        <label className="campo">
          <span>Abrangência</span>
          <select value={uf} onChange={(e) => { setUf(e.target.value); setSelecionado(null) }}>
            <option value="">Brasil</option>
            {meta && Object.entries(meta.ufNomes).sort((a, b) => a[1].localeCompare(b[1])).map(([sg, n]) => <option key={sg} value={sg}>{n} ({sg})</option>)}
          </select>
        </label>

        <div className="campo">
          <span>Métrica</span>
          <div className="segmentado">
            {METRICAS.map((m) => <button key={m.id} aria-selected={metrica === m.id} onClick={() => setMetrica(m.id)}>{m.curto}</button>)}
          </div>
        </div>

        {erroEsp && <p className="erro">Não consegui carregar esta especialidade ({erroEsp}). Tente de novo.</p>}

        {esp && resumo ? (
          <section className="resumo">
            <h2>{esp.nome}</h2>
            <p className="sub">{lugar}{esp.totalApi !== null && !uf ? ` · ${fmtInt(esp.total)} médicos no CNE` : ''}</p>
            <dl>
              <div><dt>Médicos</dt><dd>{fmtInt(resumo.n)}</dd></div>
              <div><dt>Por 100 mil hab.</dt><dd>{fmt(resumo.por100k, 'por100k')}</dd></div>
              <div><dt>Atendem SUS</dt><dd>{fmt(resumo.sus, 'sus')}</dd></div>
              <div><dt>Municípios com ≥1</dt><dd>{resumo.cobertura ? `${fmtInt(resumo.cobertura.com)} de ${fmtInt(resumo.cobertura.total)}` : '…'}</dd></div>
            </dl>
          </section>
        ) : <section className="resumo esqueleto-bloco" />}

        {detalhe && (
          <section className="detalhe">
            <div className="detalhe-topo"><h3>{detalhe.nome} <small>{detalhe.sub}</small></h3><button onClick={() => setSelecionado(null)} aria-label="Fechar">×</button></div>
            <dl>
              <div><dt>População</dt><dd>{fmtInt(detalhe.pop)}</dd></div>
              <div><dt>Médicos</dt><dd>{fmtInt(detalhe.par?.[0] ?? 0)}</dd></div>
              <div><dt>Por 100 mil</dt><dd>{fmt(valor(detalhe.par, detalhe.pop, 'por100k'), 'por100k')}</dd></div>
              <div><dt>Atendem SUS</dt><dd>{fmt(valor(detalhe.par, detalhe.pop, 'sus'), 'sus')}</dd></div>
            </dl>
            <p className="mini">{detalhe.pos}º de {fmtInt(detalhe.de)} municípios em {lugar} por {met.curto}.</p>
          </section>
        )}

        <section className="ranking">
          <h3>Maiores em {met.curto}</h3>
          {nivel === 'municipio' && metrica !== 'total' && <p className="mini">Entre municípios com 100 mil habitantes ou mais.</p>}
          {ranking.length ? (
            <ol>
              {ranking.map((i) => (
                <li key={i.id} onClick={() => nivel === 'uf' ? (setUf(i.id), setNivel('municipio')) : setSelecionado(i.id)}>
                  <span>{i.nome}{nivel === 'municipio' && !uf ? ` (${i.sub})` : ''}</span>
                  <strong>{fmt(i.v, metrica)}</strong>
                </li>
              ))}
            </ol>
          ) : <p className="mini">{escopo ? 'Nenhum registro nesta seleção.' : 'Carregando…'}</p>}
        </section>

        <footer className="painel-rodape">
          <p>Fonte: Cadastro Nacional de Especialistas (Ministério da Saúde) e vínculos CNES; população do Censo 2022 (IBGE). {meta ? `Coleta de ${meta.geradoEm.split('-').reverse().join('/')}.` : ''}</p>
          {meta && meta.especialidadesColetadas < meta.especialidadesTotal && <p className="aviso">Coleta parcial: {meta.especialidadesColetadas} de {meta.especialidadesTotal} especialidades já processadas.</p>}
        </footer>
      </aside>

      <main className="mapa-area">
        <div ref={divRef} className="mapa" />
        {(!camadas || !escopo) && <div className="carregando">Carregando malhas do IBGE…</div>}
        {escopo && (
          <div className="legenda">
            <span className="legenda-titulo">{met.rotulo}</span>
            <div className="legenda-barra" style={{ background: `linear-gradient(90deg, ${RAMPA.join(',')})` }} />
            <div className="legenda-ticks">
              {escopo.stops.map((s, i) => <span key={i}>{fmt(s, metrica)}</span>)}
            </div>
            <div className="legenda-extra"><i style={{ background: COR_ZERO }} /> nenhum médico</div>
          </div>
        )}
        {hover && (
          <div className="tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
            <strong>{hover.nome}</strong> <span className="uf">{hover.sub}</span>
            <div>{fmtInt(hover.par?.[0] ?? 0)} médicos · {fmt(valor(hover.par, hover.pop, 'por100k'), 'por100k')} por 100 mil</div>
            <div className="mini">{fmt(valor(hover.par, hover.pop, 'sus'), 'sus')} atendem SUS · pop. {fmtInt(hover.pop)}</div>
          </div>
        )}
        {uf && <button className="limpar" onClick={() => { setUf(''); setSelecionado(null) }}>Voltar ao Brasil</button>}
      </main>
    </div>
  )
}

const UF_COD: Record<string, number> = { RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17, MA: 21, PI: 22, CE: 23, RN: 24, PB: 25, PE: 26, AL: 27, SE: 28, BA: 29, MG: 31, ES: 32, RJ: 33, SP: 35, PR: 41, SC: 42, RS: 43, MS: 50, MT: 51, GO: 52, DF: 53 }
const ufCodigo = (sg: string) => UF_COD[sg]
const normaliza = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
