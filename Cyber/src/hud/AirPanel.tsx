// LEFT MODULE — live air-quality composition and pollen load. Bars are scaled to
// rough health reference maxima so degraded air reads instantly.
import { useEnv } from '../state/store'

function Row({ label, value, unit, max }: { label: string; value: number | null; unit: string; max: number }) {
  const frac = value == null ? 0 : Math.min(1, value / max)
  const cls = frac > 0.75 ? 'crit' : frac > 0.5 ? 'warn' : ''
  return (
    <div className="air-row">
      <span className="air-row__k">{label}</span>
      <div className={`bar ${cls}`}>
        <i style={{ width: `${frac * 100}%` }} />
      </div>
      <span className="air-row__v">{value == null ? '—' : value.toFixed(value < 10 ? 1 : 0)}{unit}</span>
    </div>
  )
}

export function AirPanel() {
  const snap = useEnv((s) => s.snapshot)
  const a = snap?.air
  const p = snap?.pollen

  return (
    <div className="pane" style={{ height: '100%' }}>
      <div className="pane__title">
        Air Quality Spectrum<span className="spacer" />
        <span className="tag">{snap?.derived.aqiValue != null ? `AQI ${snap.derived.aqiValue}` : '—'}</span>
      </div>
      <div className="pane__body air-body">
        <div className="air-headline" style={{ color: 'var(--teal)' }}>
          <b>{snap?.derived.aqiCategory ?? '—'}</b>
          <span>US AQI {a?.usAqi ?? '—'} · EU {a?.euAqi ?? '—'}</span>
        </div>

        <div className="air-section">PARTICULATES &amp; GASES</div>
        <Row label="PM2.5" value={a?.pm25 ?? null} unit="" max={75} />
        <Row label="PM10" value={a?.pm10 ?? null} unit="" max={150} />
        <Row label="OZONE" value={a?.ozone ?? null} unit="" max={180} />
        <Row label="NO₂" value={a?.no2 ?? null} unit="" max={200} />
        <Row label="SO₂" value={a?.so2 ?? null} unit="" max={100} />

        <div className="air-section">POLLEN LOAD {p && !p.available && <span className="tag">EU COVERAGE ONLY</span>}</div>
        {p?.available ? (
          <>
            <Row label="GRASS" value={p.grass ?? null} unit="" max={120} />
            <Row label="BIRCH" value={p.birch ?? null} unit="" max={120} />
            <Row label="RAGWEED" value={p.ragweed ?? null} unit="" max={120} />
            <Row label="ALDER" value={p.alder ?? null} unit="" max={120} />
          </>
        ) : (
          <div className="air-note">No pollen feed for this region — organism shows ambient spores only.</div>
        )}
      </div>
    </div>
  )
}
