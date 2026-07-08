# BIOSPHERE // Environmental Lattice

A full-viewport **Progressive Web App** that grows a living, iridescent organism which
reacts in real time to the **actual air quality, weather and pollen** at any location on
Earth — wrapped in a premium "classified biotech" schematic HUD. Everything flows under
the cursor.

Data is live and public via **[Open-Meteo](https://open-meteo.com)** (no API key, CORS-
enabled). Clean air / low pollen / calm weather → a lush, vivid, iridescent bloom; poor
air → the organism hazes into a toxic amber and desaturates. The numbers on screen are real.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle + service worker → dist/
npm run preview    # serve the built PWA
```

Requires Node 18+ and a WebGL2 browser. **Move your mouse** — the organism turns and
re-lights toward the cursor.

## Systems

**1 · The organism (WebGL hero)** — a fullscreen **raymarched** translucent metaball body
(`engine/raymarch.ts`). A sphere-traced SDF with fresnel **thin-film iridescence**, a
signature pink/cool rim, and a living **green-gold interior** marched through the glass
shell. Orientation and light follow the cursor with inertia; vitality, hue and haze are
driven by the live snapshot. Post: bloom, chromatic aberration, film grain, vignette.

**2 · Real environmental data** — `lib/environment.ts` pulls current weather + air quality
+ pollen and normalizes it into one snapshot with a composite **Biosphere Index**. Fetching
is async, refreshes every 10 min, and supports geocoded city search + device geolocation.

**3 · Premium schematic HUD** — a locked, non-scrolling grid:
- **Top** — location, synced local time, conditions, UV, AQI, Biosphere Index.
- **Left** — live air-quality spectrum (PM2.5 / PM10 / O₃ / NO₂ / SO₂) + pollen load.
- **Right** — atmospheric field with a wind compass, and a Growth-Response legend mapping
  the real conditions onto what the organism is doing.
- **Bottom** — the Observation-Point console: search any place or use your location.
- **Overlay** — floating leader-line **callouts** annotating the organism, a custom inertial
  **cursor**, cursor **parallax**, and film grain.

**4 · Feel** — a custom cursor + ring, parallaxing annotations, and a shader that leans and
glints toward the pointer. All motion is GPU/transform-driven; React only eases uniforms.

## Architecture

```
src/
  lib/environment.ts     Open-Meteo fetch + normalization + Biosphere Index
  state/store.ts         zustand store + geolocation + refresh loop
  engine/
    raymarch.ts          fullscreen vertex + raymarch fragment shader
    RaymarchOrganism.tsx  quad + cursor inertia + data → uniforms
    Biosphere.tsx        Canvas + post FX
  hud/
    Hud.tsx  TopBar  AirPanel  WeatherPanel  LocationConsole
    Annotations.tsx  CursorFX.tsx
  styles/global.css
```

## Stack
Vite · React 18 · TypeScript · three.js · @react-three/fiber ·
@react-three/postprocessing · zustand · vite-plugin-pwa.

Add `?nofx` to the URL to bypass post-processing for debugging.
