import { useEffect, useState } from 'react'
import type { FeatureCollection } from 'geojson'
import type { EspMun, Meta, Municipios } from './types'

const cache = new Map<string, Promise<unknown>>()
function fetchJson<T>(url: string): Promise<T> {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${url}: ${r.status}`)
    return r.json()
  }))
  return cache.get(url) as Promise<T>
}

export const loadMeta = () => fetchJson<Meta>('/data/meta.json')
export const loadMunicipios = () => fetchJson<Municipios>('/data/municipios.json')
export const loadEsp = (id: string) => fetchJson<EspMun>(`/data/esp/${id}.json`)
export const loadGeo = (nome: 'ufs' | 'municipios') => fetchJson<FeatureCollection>(`/geo/${nome}.json`)

export function useJson<T>(loader: () => Promise<T>, dep: string = ''): { data: T | null; erro: string | null } {
  const [state, set] = useState<{ data: T | null; erro: string | null }>({ data: null, erro: null })
  useEffect(() => {
    let vivo = true
    set({ data: null, erro: null })
    loader().then((d) => vivo && set({ data: d, erro: null })).catch((e) => vivo && set({ data: null, erro: String(e) }))
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep])
  return state
}
