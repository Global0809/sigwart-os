// Locked absolute grid + the premium overlay layers (annotations, cursor, grain).
// Container passes pointer events through to the 3D stage; each pane re-enables
// its own.
import { TopBar } from './TopBar'
import { AirPanel } from './AirPanel'
import { WeatherPanel } from './WeatherPanel'
import { LocationConsole } from './LocationConsole'
import { Annotations } from './Annotations'
import { CursorFX } from './CursorFX'

export function Hud() {
  return (
    <>
      <Annotations />
      <div className="area-top">
        <TopBar />
      </div>
      <div className="area-left">
        <AirPanel />
      </div>
      <div className="area-center" />
      <div className="area-right">
        <WeatherPanel />
      </div>
      <div className="area-dock">
        <LocationConsole />
      </div>
      <div className="grain" />
      <CursorFX />
    </>
  )
}
