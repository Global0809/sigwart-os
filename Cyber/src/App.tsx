import { useEffect, useState } from 'react'
import { Biosphere } from './engine/Biosphere'
import { Hud } from './hud/Hud'
import { initEnvironment } from './state/store'

const BOOT_LINES = [
  ['boot', 'BIOSPHERE v2.0 // environmental lattice'],
  ['boot', 'initializing WebGL organism ........ '],
  ['ok', '[ OK ]'],
  ['boot', 'opening Open-Meteo data channels ... '],
  ['ok', '[ LIVE ]'],
  ['boot', 'binding air-quality + pollen feeds . '],
  ['ok', '[ OK ]'],
  ['boot', 'calibrating iridescence shaders .... '],
  ['ok', '[ OK ]'],
  ['boot', 'organism responsive. Set an observation point.'],
] as const

function Boot({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (n >= BOOT_LINES.length) {
      const a = setTimeout(() => setFading(true), 500)
      const b = setTimeout(onDone, 1100)
      return () => {
        clearTimeout(a)
        clearTimeout(b)
      }
    }
    const t = setTimeout(() => setN((v) => v + 1), n === 0 ? 240 : 150)
    return () => clearTimeout(t)
  }, [n, onDone])

  return (
    <div className={`boot${fading ? ' done' : ''}`}>
      <div className="big">BIOSPHERE</div>
      {BOOT_LINES.slice(0, n).map((l, i) => (
        <div key={i} className={l[0]}>
          {l[0] === 'ok' ? <span className="ok">{l[1]}</span> : <b>{l[1]}</b>}
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    const stop = initEnvironment()
    return stop
  }, [])

  return (
    <div className="app">
      <Biosphere />
      <div className="hud-root">
        <Hud />
      </div>
      {booting && <Boot onDone={() => setBooting(false)} />}
    </div>
  )
}
