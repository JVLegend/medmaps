import { renderToStaticMarkup } from 'react-dom/server'
import Landing from './Landing'
import type { Meta, Especialidade, Municipios } from './types'
import { fmt, fmtInt, valor } from './types'

export function home(meta: Meta) { return renderToStaticMarkup(<Landing initialMeta={meta} />) }
export function specialty(meta: Meta, e: Especialidade, muns: Municipios) {
  return renderToStaticMarkup(<div className="landing especialidade">
    <header className="nav"><a className="marca" href="/">MedMaps</a><nav aria-label="Navegação principal"><a href="/">Início</a><a href={`/#/mapa?esp=${e.id}`}>Mapa interativo</a><a href="/#fontes">Fontes e método</a></nav></header>
    <main><h1>{e.nome} no Brasil</h1>
      <p>Distribuição dos médicos com registros desta especialidade no Cadastro Nacional de Especialistas e vínculos no CNES. Coleta de {meta.geradoEm.split('-').reverse().join('/')}.</p>
      <p><strong>{fmtInt(e.total)} médicos</strong> · {fmt(valor([e.total, e.sus], meta.populacaoBR, 'por100k'), 'por100k')} por 100 mil habitantes · {fmt(valor([e.total, e.sus], meta.populacaoBR, 'sus'), 'sus')} atendem pelo SUS segundo os registros.</p>
      <a className="botao" href={`/#/mapa?esp=${e.id}`}>Explorar {e.nome} no mapa</a>
      <h2>Distribuição por unidade da federação</h2>
      <p>Médico único por estado. A soma dos estados não equivale ao total nacional: um profissional pode trabalhar em mais de uma UF.</p>
      <table><caption>{e.nome}: registros por UF na coleta de {meta.geradoEm}</caption><thead><tr><th scope="col">UF</th><th scope="col">Médicos</th><th scope="col">Por 100 mil</th><th scope="col">No SUS</th></tr></thead><tbody>
        {Object.keys(meta.ufNomes).sort().map(uf => <tr key={uf}><th scope="row">{meta.ufNomes[uf]} ({uf})</th><td>{fmtInt(e.uf[uf]?.[0] ?? 0)}</td><td>{fmt(valor(e.uf[uf], meta.populacaoUF[uf], 'por100k'), 'por100k')}</td><td>{fmt(valor(e.uf[uf], meta.populacaoUF[uf], 'sus'), 'sus')}</td></tr>)}
      </tbody></table>
      <h2>Fontes, recortes e limites</h2>
      <p>Fonte de médicos e vínculos: <a href="https://degerts.unasus.gov.br/cadastro-nacional-de-especialistas/sobre">Cadastro Nacional de Especialistas (Ministério da Saúde / UNA-SUS)</a>, com vínculo e local de trabalho informados pelo CNES. População: Censo 2022 do IBGE, SIDRA tabela 4714, conforme <a href="/data/meta.json">metadados desta coleta</a>.</p>
      <p>O <a href="/data/municipios.json">cadastro territorial</a> possui {fmtInt(Object.keys(muns).length)} localidades, das quais {fmtInt(Object.values(muns).filter(m => m[2] > 0).length)} têm população positiva. Boa Esperança do Norte (MT) tem população indisponível nesta base, armazenada como zero. Não significa zero habitantes; sua densidade não é calculada.</p>
      <p>Os registros descrevem vínculos, não comprovam disponibilidade atual, jornada, qualidade ou suficiência assistencial. Ausência de registro não demonstra ausência real de atendimento. Não somamos especialidades para obter médicos únicos. <a href="/#metodo">Veja o método completo</a>.</p>
      <p><a href="/">Explorar outras especialidades</a></p>
    </main>
  </div>)
}
