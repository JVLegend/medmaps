export type Par = [number, number] // [medicos, medicos que atendem SUS]

export type Especialidade = {
  id: string
  nome: string
  total: number
  totalApi: number | null
  sus: number
  semVinculo: number | null
  uf: Record<string, Par>
}

export type Meta = {
  geradoEm: string
  especialidadesColetadas: number
  especialidadesTotal: number
  populacaoBR: number
  populacaoUF: Record<string, number>
  ufNomes: Record<string, string>
  fontes: Record<string, string>
  especialidades: Especialidade[]
}

export type Municipios = Record<string, [string, string, number]> // id6 -> [nome, uf, populacao]
export type EspMun = Record<string, Par>

export type Nivel = 'uf' | 'municipio'
export type Metrica = 'por100k' | 'total' | 'sus'

export const METRICAS: { id: Metrica; rotulo: string; curto: string }[] = [
  { id: 'por100k', rotulo: 'Médicos por 100 mil habitantes', curto: 'por 100 mil hab.' },
  { id: 'total', rotulo: 'Total de médicos', curto: 'médicos' },
  { id: 'sus', rotulo: 'Parcela que atende pelo SUS', curto: '% no SUS' },
]

export function valor(par: Par | undefined, pop: number, metrica: Metrica): number | null {
  if (!par) return metrica === 'sus' ? null : 0
  const [n, sus] = par
  if (metrica === 'total') return n
  if (metrica === 'por100k') return pop > 0 ? (n / pop) * 100000 : null
  return n > 0 ? (sus / n) * 100 : null
}

const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
export function fmt(v: number | null | undefined, metrica: Metrica = 'total'): string {
  if (v === null || v === undefined || Number.isNaN(v)) return 'sem dado'
  if (metrica === 'total') return nf0.format(v)
  if (metrica === 'sus') return nf1.format(v) + '%'
  return nf1.format(v)
}
export const fmtInt = (v: number) => nf0.format(v)
