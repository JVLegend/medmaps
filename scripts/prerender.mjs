import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createServer } from 'vite'
const meta = JSON.parse(await readFile('public/data/meta.json', 'utf8'))
const muns = JSON.parse(await readFile('public/data/municipios.json', 'utf8'))
const template = await readFile('dist/index.html', 'utf8')
const origin = 'https://medmaps-three.vercel.app'
const escape = s => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const { home, specialty } = await server.ssrLoadModule('/src/prerender.tsx')
  const page = (html, title, description, path, interactive = false) => {
    let output = template.replace(/<title>.*?<\/title>/s, `<title>${escape(title)}</title>`)
      .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escape(description)}" />`)
      .replace('</head>', `<link rel="canonical" href="${origin}${path}" />\n<meta property="og:title" content="${escape(title)}" />\n<meta property="og:url" content="${origin}${path}" />\n</head>`)
      .replace('<div id="root"></div>', `<div id="root">${html}</div>`)
    if (!interactive) output = output.replace(/<script type="module"[^>]*><\/script>/g, '')
    return output
  }
  await writeFile('dist/index.html', page(home(meta), 'MedMaps · Atlas das especialidades médicas do Brasil', 'Distribuição de médicos por estado e município, densidade populacional e registros de atendimento ao SUS. Fontes, recortes e mapa interativo.', '/', true))
  const featured = meta.especialidades.filter(e => e.id !== 'todas').sort((a,b) => b.total-a.total).slice(0,8)
  const ophthalmology = meta.especialidades.find(e => e.id === 'oftalmologia')
  if (ophthalmology && !featured.some(e => e.id === ophthalmology.id)) featured.push(ophthalmology)
  for (const e of featured) {
    const path = `/especialidades/${e.id}/`
    await mkdir(`dist${path}`, { recursive: true })
    await writeFile(`dist${path}index.html`, page(specialty(meta,e,muns), `${e.nome} no Brasil: médicos por UF | MedMaps`, `${e.nome}: ${e.total.toLocaleString('pt-BR')} médicos registrados, distribuição por UF, densidade e atendimento ao SUS. Coleta de ${meta.geradoEm}, fontes e limites.`, path))
  }
  await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', ...featured.map(e => `/especialidades/${e.id}/`)].map(path => `<url><loc>${origin}${path}</loc></url>`).join('')}</urlset>`)
  await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`)
  console.log(`Prerendered home and ${featured.length} specialty pages.`)
} finally { await server.close() }
