import { useJson, loadGeo } from './data'

// Contorno dos estados (malha IBGE) em projeção equirretangular simples, só para o fundo do hero.
export default function BrasilSvg({ className }: { className?: string }) {
  const { data } = useJson(() => loadGeo('ufs'), 'ufs')
  if (!data) return null
  const W = 1000, H = 1000
  const x = (lon: number) => ((lon + 74) / 41) * W
  const y = (lat: number) => ((6 - lat) / 40) * H
  const paths: string[] = []
  for (const f of data.features) {
    const g = f.geometry
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
    for (const poly of polys) for (const ring of poly) {
      paths.push('M' + ring.map(([lon, lat]: number[]) => `${x(lon).toFixed(1)},${y(lat).toFixed(1)}`).join('L') + 'Z')
    }
  }
  return (
    <svg className={className} viewBox="0 0 1000 1000" aria-hidden="true">
      <path d={paths.join(' ')} fill="none" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
