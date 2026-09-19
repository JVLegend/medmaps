import BrasilSvg from './BrasilSvg'
import { loadMeta, useJson } from './data'
import { fmtInt } from './types'

export default function Landing() {
  const { data: meta } = useJson(loadMeta, 'meta')
  const todas = meta?.especialidades.find((e) => e.id === 'todas')
  const top = meta ? [...meta.especialidades].filter((e) => e.id !== 'todas').sort((a, b) => b.total - a.total).slice(0, 8) : []
  return (
    <div className="landing">
      <header className="nav">
        <a className="marca" href="#/">MedMaps</a>
        <nav>
          <a href="#/mapa">Mapa</a>
          <a href="#metodo">Método</a>
          <a href="#fontes">Fontes</a>
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
            <div><strong>5.570</strong><span>municípios do IBGE, com população do Censo 2022</span></div>
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
            <a key={e.id} href={`#/mapa?esp=${e.id}`}>
              <span>{e.nome}</span>
              <small>{fmtInt(e.total)} médicos</small>
            </a>
          ))}
          <a href="#/mapa" className="chip-todas"><span>Todas as {meta ? meta.especialidadesColetadas : '…'} especialidades</span><small>abrir o mapa</small></a>
        </div>
      </section>

      <section className="metodo" id="metodo">
        <h2>Como o mapa é feito</h2>
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
            <p>Médicos por 100 mil habitantes usa a população do Censo 2022. Capitais lideram em volume; a densidade mostra quem está bem ou mal servido.</p>
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
        <p className="mini">Dados coletados em {meta ? meta.geradoEm.split('-').reverse().join('/') : '…'}. Projeto independente, sem vínculo com o Ministério da Saúde, CFM ou IBGE. Inspirado no formato do ElectoMaps.</p>
      </footer>
    </div>
  )
}
