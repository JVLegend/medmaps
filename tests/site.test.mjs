import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'
const read = p => readFile(p, 'utf8')
test('territorial and population universes are independently reproducible', async () => {
  const m = JSON.parse(await read('public/data/municipios.json'))
  assert.equal(Object.keys(m).length, 5571)
  assert.equal(Object.values(m).filter(x=>x[2]>0).length, 5570)
  assert.deepEqual(m['510183'], ['Boa Esperança do Norte','MT',0])
})
test('missing population is never represented as zero density', async () => {
  const server = await createServer({server:{middlewareMode:true},appType:'custom'})
  try {
    const {valor} = await server.ssrLoadModule('/src/types.ts')
    for (const par of [undefined,[0,0],[1,1]]) assert.equal(valor(par,0,'por100k'),null)
    assert.equal(valor(undefined,1000,'por100k'),0)
    assert.equal(valor([10,5],100000,'por100k'),10)
    assert.equal(valor([10,5],0,'total'),10)
    assert.equal(valor([10,5],0,'sus'),50)
  } finally { await server.close() }
})
test('specialty pages expose distinct server HTML, metadata, data and legacy map links', async () => {
 const sitemap = await read('dist/sitemap.xml')
 const paths = [...sitemap.matchAll(/<loc>https:\/\/medmaps-three.vercel.app([^<]+)<\/loc>/g)].map(m=>m[1])
 assert.equal(paths.length,10)
 const titles = new Set()
 for(const path of paths) {
   const html = await read(`dist${path}index.html`)
   assert.ok(html.includes(`rel="canonical" href="https://medmaps-three.vercel.app${path}"`))
   assert.equal([...html.matchAll(/<h1[ >]/g)].length,1)
   titles.add(html.match(/<title>(.*?)<\/title>/s)[1])
   if(path !== '/') {
    assert.equal([...html.matchAll(/<tr>/g)].length,28)
    assert.ok(html.includes(`/#/mapa?esp=${path.split('/')[2]}`))
    assert.ok(html.includes('2026-09-19'))
    assert.ok(!html.includes('<script type="module"'))
   }
 }
 assert.equal(titles.size,10)
 const home = await read('dist/index.html')
 assert.ok(home.includes('5.571 entradas'))
 assert.ok(home.includes('/especialidades/cardiologia/'))
 assert.ok(home.includes('<script type="module"'))
})
