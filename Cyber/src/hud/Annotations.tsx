// Floating schematic callouts: thin leader lines from labels to points on the
// central organism, with live values. Parallaxes against the cursor (CSS vars
// from CursorFX) for depth. Non-interactive overlay.
import { useEnv } from '../state/store'

export function Annotations() {
  const snap = useEnv((s) => s.snapshot)
  const health = snap ? Math.round(snap.derived.health * 100) : null

  // Positioned in the central band (between the side panels) so lines reach the organism cleanly.
  const callouts = [
    { x: 31, y: 19, tx: 44, ty: 35, title: 'SPECIMEN 01', sub: 'IRIDESCENT MEMBRANE', align: 'left' },
    { x: 69, y: 21, tx: 57, ty: 38, title: health != null ? `VITALITY ${health}%` : 'VITALITY —', sub: snap?.derived.aqiCategory ?? 'SCANNING', align: 'right' },
    { x: 32, y: 82, tx: 45, ty: 62, title: 'LIVING INTERIOR', sub: 'CHLOROPHYLL LATTICE', align: 'left' },
    { x: 68, y: 80, tx: 56, ty: 60, title: snap ? `${snap.place.lat.toFixed(2)}·${snap.place.lng.toFixed(2)}` : '—', sub: 'OBSERVATION SECTOR', align: 'right' },
  ]

  return (
    <div className="annotations">
      <svg className="anno-lines" preserveAspectRatio="none">
        {callouts.map((c, i) => (
          <g key={i}>
            <line x1={`${c.x}%`} y1={`${c.y + 1}%`} x2={`${c.tx}%`} y2={`${c.ty}%`} />
            <circle className="anno-target" cx={`${c.tx}%`} cy={`${c.ty}%`} r="4" />
            <circle className="anno-dot" cx={`${c.tx}%`} cy={`${c.ty}%`} r="1.4" />
          </g>
        ))}
      </svg>
      {callouts.map((c, i) => (
        <div key={i} className={`anno-label ${c.align}`} style={{ left: `${c.x}%`, top: `${c.y}%` }}>
          <b>{c.title}</b>
          <span>{c.sub}</span>
        </div>
      ))}
    </div>
  )
}
