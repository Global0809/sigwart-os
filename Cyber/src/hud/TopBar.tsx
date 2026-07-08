// Top strip — location, synced local time, current weather, UV, AQI and the
// composite Biosphere Index that drives the bloom. All values are live.
import { useEffect, useState } from 'react'
import { useEnv } from '../state/store'
import { compass } from '../lib/environment'

function aqiColor(cat: string): string {
  switch (cat) {
    case 'GOOD': return 'var(--good)'
    case 'MODERATE': return 'var(--teal)'
    case 'SENSITIVE': return 'var(--amber)'
    case 'UNHEALTHY': return 'var(--magenta)'
    default: return 'var(--danger)'
  }
}

function localTime(tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: tz === 'auto' ? undefined : tz,
    }).format(new Date())
  } catch {
    return new Date().toISOString().slice(11, 19)
  }
}

export function TopBar() {
  const snap = useEnv((s) => s.snapshot)
  const status = useEnv((s) => s.status)
  const [, tick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => tick((v) => v + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const health = snap ? Math.round(snap.derived.health * 100) : 0
  const tz = snap?.place.timezone ?? 'auto'

  return (
    <div className="pane top-strip">
      <div className="top-brand">
        <b>BIOSPHERE</b>
        <span>ENVIRONMENTAL LATTICE</span>
      </div>

      <div className="metric">
        <div className="metric__label">
          <span>LOCATION</span>
          <span>{status === 'loading' ? '◍ SYNC' : status === 'error' ? '⚠ ERR' : '◉ LIVE'}</span>
        </div>
        <div className="metric__value" style={{ fontSize: 14 }}>
          {snap ? snap.place.name : '—'}
          <small> {snap?.place.admin || snap?.place.country || ''}</small>
        </div>
      </div>

      <div className="metric clock">
        <div className="metric__label"><span>LOCAL TIME</span></div>
        <div className="metric__value">{localTime(tz)}</div>
      </div>

      <div className="metric">
        <div className="metric__label"><span>CONDITIONS</span><span>{snap?.weather.label}</span></div>
        <div className="metric__value">
          {snap ? Math.round(snap.weather.temp) : '—'}°<small> feels {snap ? Math.round(snap.weather.apparent) : '—'}°</small>
        </div>
        <div className="metric__label">
          <span>WIND {snap ? `${Math.round(snap.weather.windSpeed)}km/h ${compass(snap.weather.windDir)}` : '—'}</span>
        </div>
      </div>

      <div className="metric">
        <div className="metric__label"><span>UV INDEX</span><span>{snap?.derived.uvCategory}</span></div>
        <div className="metric__value">{snap ? snap.weather.uv.toFixed(1) : '—'}</div>
        <div className="metric__label"><span>AIR QUALITY</span></div>
        <div className="metric__value" style={{ fontSize: 13, color: aqiColor(snap?.derived.aqiCategory ?? '') }}>
          {snap?.derived.aqiValue ?? '—'} <small style={{ color: 'inherit' }}>{snap?.derived.aqiCategory}</small>
        </div>
      </div>

      <div className="sentiment">
        <div className="sentiment__row">
          <span>BIOSPHERE INDEX</span>
          <b>{health}</b>
        </div>
        <div className="sentiment__track bio">
          <span className="sentiment__needle" style={{ left: `${health}%` }} />
        </div>
        <div className="sentiment__row">
          <span>DEGRADED</span>
          <span style={{ color: 'var(--good)' }}>{health > 66 ? 'THRIVING' : health > 40 ? 'STABLE' : 'STRESSED'}</span>
          <span>THRIVING</span>
        </div>
      </div>
    </div>
  )
}
