// BOTTOM DOCK — set the observation point. Type any place (Open-Meteo geocoding)
// or hand over to device geolocation. Drives the whole dashboard.
import { useState } from 'react'
import { useEnv } from '../state/store'

export function LocationConsole() {
  const [value, setValue] = useState('')
  const search = useEnv((s) => s.search)
  const locateMe = useEnv((s) => s.locateMe)
  const status = useEnv((s) => s.status)
  const error = useEnv((s) => s.error)
  const place = useEnv((s) => s.place)
  const busy = status === 'loading'

  const submit = () => {
    if (!value.trim() || busy) return
    search(value)
  }

  return (
    <div className="pane dock">
      <span className="dock__label">Observation Point</span>
      <div className="dock__prompt" onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}>
        <span className="sigil">⌖</span>
        <div className="dock__mirror">
          {value ? value : <span className="ph">enter a city, region or place…</span>}
          <span className="dock__cursor" />
        </div>
        <input
          className="dock__input"
          value={value}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>

      <button className="btn-decrypt" onClick={submit} disabled={busy}>
        {busy ? '◊ SYNCING' : '▶ SET COORDINATES'}
      </button>
      <button className="btn-ghost" onClick={() => locateMe()} disabled={busy} title="Use device location">
        ◎ MY LOCATION
      </button>

      <span className="dock__status">
        {error ? (
          <span style={{ color: 'var(--danger)' }}>⚠ {error}</span>
        ) : place ? (
          <span>{place.lat.toFixed(2)}, {place.lng.toFixed(2)}</span>
        ) : (
          <span>—</span>
        )}
      </span>
    </div>
  )
}
