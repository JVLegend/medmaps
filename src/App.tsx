import { useEffect, useState } from 'react'
import Landing from './Landing'
import Mapa from './Mapa'

function rotaAtual() {
  return location.hash.startsWith('#/mapa') ? 'mapa' : 'inicio'
}

export default function App() {
  const [rota, setRota] = useState(rotaAtual)
  useEffect(() => {
    const f = () => setRota(rotaAtual())
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])
  return rota === 'mapa' ? <Mapa /> : <Landing />
}
