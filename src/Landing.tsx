import BrasilSvg from './BrasilSvg'
import { loadMeta, useJson } from './data'
import { fmtInt } from './types'
import type { Meta } from './types'

export default function Landing({ initialMeta }: { initialMeta?: Meta } = {}) {
  const { data: loadedMeta } = useJson(loadMeta, 'meta')
  const meta = initialMeta ?? loadedMeta
  const todas = meta?.especialidades.find((e) => e.id === 'todas')
  const top = meta ? [...meta.especialidades].filter((e) => e.id !== 'todas').sort((a, b) => b.total - a.total).slice(0, 8) : []
  return (
    <div className="landing">
      <header className="nav">
        <a className="marca" href="#/">MedMaps</a>
        <nav aria-label="Navegação principal">
          <a href="#/mapa">Mapa</a>
          <a href="#metodo">Método</a>
          <a href="#fontes">Fontes</a>
          <a href="https://medicosatualizados.com.br/" target="_blank" rel="noreferrer">Médicos Atualizados</a>
        </nav>
      </header>

      <section className="hero">
        <BrasilSvg className="hero-mapa" />
        <div className="hero-texto">
          <h1>Especialidades médicas mapeadas como você nunca viu.</h1>
          <p>Onde estão os oftalmologistas, os psiquiatras, os pediatras: por estado e por município, com densidade por habitante e atendimento ao SUS.</p>
          <a className="botao" href="#/mapa">Abrir o mapa</a>
        </div>
      </section>

      <section className="numeros">
        {meta && todas ? (
          <>
            <div><strong>{fmtInt(todas.total)}</strong><span>médicos especialistas com vínculo ativo no CNES</span></div>
            <div><strong>{meta.especialidadesColetadas}</strong><span>especialidades e áreas de atuação do Cadastro Nacional de Especialistas</span></div>
            <div><strong>5.570</strong><span>localidades com população positiva do Censo 2022 nesta base; o cadastro territorial tem 5.571 entradas</span></div>
          </>
        ) : (
          <>
            <div className="esqueleto" /><div className="esqueleto" /><div className="esqueleto" />
          </>
        )}
      </section>

      <section className="lista" id="especialidades">
        <h2>Comece por uma especialidade</h2>
        <div className="chips">
          {top.map((e) => (
            <a key={e.id} href={`/especialidades/${e.id}/`}>
              <span>{e.nome}</span>
              <small>{fmtInt(e.total)} médicos</small>
            </a>
          ))}
          <a href="#/mapa" className="chip-todas"><span>Todas as {meta ? meta.especialidadesColetadas : '…'} especialidades</span><small>abrir o mapa</small></a>
        </div>
      </section>

      <section className="metodo" id="metodo">
        <h2>Como o mapa é feito</h2>
        <p>O <a href="/data/municipios.json">cadastro territorial desta base</a> contém 5.571 localidades, mas só 5.570 têm população positiva. Boa Esperança do Norte (MT, código 510183) está com população indisponível, armazenada como zero. Isso não significa zero habitantes. A cobertura usa todas as localidades; a densidade municipal fica sem dado quando falta população. Não estimamos esse denominador.</p>
        <div className="passos">
          <div>
            <h3>Médico único, não vínculo</h3>
            <p>Cada médico entra uma vez por especialidade e por lugar. Quem atende em duas cidades conta nas duas, mas conta uma vez no estado e uma vez no Brasil.</p>
          </div>
          <div>
            <h3>Município é onde ele trabalha</h3>
            <p>O local vem do estabelecimento de saúde com vínculo registrado no CNES, não do endereço do CRM. É onde o atendimento acontece.</p>
          </div>
          <div>
            <h3>Densidade, não só volume</h3>
            <p>Médicos por 100 mil habitantes usa a população do Censo 2022. Esse indicador descreve a distribuição dos registros, não mede sozinho suficiência assistencial, jornada ou qualidade.</p>
          </div>
        </div>
      </section>

      <footer id="fontes">
        <h2>Fontes</h2>
        <ul>
          <li>Médicos e especialidades: Cadastro Nacional de Especialistas (CNE), Ministério da Saúde e UNA-SUS, consulta pública por especialidade. Vínculo e município: CNES/DataSUS, conforme publicado no CNE.</li>
          <li>População: IBGE, Censo Demográfico 2022 (SIDRA, tabela 4714).</li>
          <li>Malhas territoriais: IBGE, API de malhas geográficas v3.</li>
        </ul>
        <p className="irmao">Projeto irmão: <a href="https://medicosatualizados.com.br/" target="_blank" rel="noreferrer">Médicos Atualizados</a>, radar editorial por especialidade, com o que saiu de novo em cada área.</p>
        <p className="mini">Dados coletados em {meta ? meta.geradoEm.split('-').reverse().join('/') : '…'}. Projeto independente, sem vínculo com o Ministério da Saúde, CFM ou IBGE. Inspirado no formato do ElectoMaps.</p>
      </footer>
    </div>
  )
}
