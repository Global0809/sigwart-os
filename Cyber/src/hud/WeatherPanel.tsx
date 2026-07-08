// RIGHT MODULE — live weather stats (with a wind compass) plus a legend that maps
// the current real conditions onto what the organism is doing right now.
import { useEnv } from '../state/store'
import { compass } from '../lib/environment'

function Stat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="wx-stat">
      <span className="wx-stat__k">{k}</span>
      <span className="wx-stat__v">{v}</span>
      {sub && <span className="wx-stat__s">{sub}</span>}
    </div>
  )
}

function WindRose({ deg }: { deg: number }) {
  // meteorological dir = where wind comes FROM
  const a = ((deg + 180) % 360) * (Math.PI / 180)
  const x = 50 + Math.sin(a) * 30
  const y = 50 - Math.cos(a) * 30
  return (
    <svg viewBox="0 0 100 100" className="wind-rose">
      <circle cx="50" cy="50" r="34" fill="none" stroke="var(--line)" />
      <circle cx="50" cy="50" r="2.5" fill="var(--teal)" />
      {['N', 'E', 'S', 'W'].map((d, i) => {
        const ang = (i * 90) * (Math.PI / 180)
        return (
          <text key={d} x={50 + Math.sin(ang) * 42} y={50 - Math.cos(ang) * 42 + 3} fontSize="7" textAnchor="middle" fill="var(--text-dim)">{d}</text>
        )
      })}
      <line x1="50" y1="50" x2={x} y2={y} stroke="var(--cyan)" strokeWidth="2" />
      <circle cx={x} cy={y} r="3" fill="var(--cyan)" />
    </svg>
  )
}

export function WeatherPanel() {
  const snap = useEnv((s) => s.snapshot)
  const w = snap?.weather
  const health = snap ? Math.round(snap.derived.health * 100) : 0

  return (
    <div className="aux-stack">
      <div className="pane">
        <div className="pane__title">
          Atmospheric Field<span className="spacer" />
          <span className="tag">{w?.isDay ? '☀ DAY' : '☾ NIGHT'}</span>
        </div>
        <div className="pane__body wx-body">
          <div className="wx-grid">
            <Stat k="HUMIDITY" v={w ? `${Math.round(w.humidity)}%` : '—'} />
            <Stat k="CLOUD" v={w ? `${Math.round(w.cloud)}%` : '—'} />
            <Stat k="PRECIP" v={w ? `${w.precip.toFixed(1)}mm` : '—'} />
            <Stat k="WIND" v={w ? `${Math.round(w.windSpeed)}` : '—'} sub={w ? `km/h ${compass(w.windDir)}` : ''} />
          </div>
          <WindRose deg={w?.windDir ?? 0} />
        </div>
      </div>

      <div className="pane">
        <div className="pane__title">Growth Response<span className="spacer" /><span className="tag">LIVE MAP</span></div>
        <div className="pane__body legend">
          <div className="legend__row">
            <span className="legend__k">AIR {snap?.derived.aqiCategory}</span>
            <span className="legend__v">{health > 55 ? 'full vivid bloom' : health > 35 ? 'partial · fading hue' : 'wilting · desaturated'}</span>
          </div>
          <div className="legend__row">
            <span className="legend__k">WIND {w ? Math.round(w.windSpeed) : '—'}km/h</span>
            <span className="legend__v">{!w ? '—' : w.windSpeed > 25 ? 'heavy sway + spore drift' : w.windSpeed > 10 ? 'gentle sway' : 'still'}</span>
          </div>
          <div className="legend__row">
            <span className="legend__k">POLLEN {snap?.derived.pollenCategory}</span>
            <span className="legend__v">{snap?.pollen.available ? 'spore density scaled to load' : 'ambient spores'}</span>
          </div>
          <div className="legend__row">
            <span className="legend__k">UV {snap?.derived.uvCategory}</span>
            <span className="legend__v">{!w ? '—' : w.uv > 7 ? 'intense iridescent glow' : 'soft glow'}</span>
          </div>
          <div className="legend__foot">the bloom is a live readout of your local biosphere</div>
        </div>
      </div>
    </div>
  )
}
