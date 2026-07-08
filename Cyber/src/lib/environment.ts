// Real environmental data via Open-Meteo (no API key, CORS-enabled). We pull
// current weather + air quality + pollen and normalize it into one snapshot the
// UI and the 3D organism both read from. All values are real and public.

const FORECAST = 'https://api.open-meteo.com/v1/forecast'
const AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality'
const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search'

export interface GeoPlace {
  name: string
  lat: number
  lng: number
  country: string
  admin?: string
  timezone: string
}

export interface EnvSnapshot {
  place: GeoPlace
  fetchedAt: number
  weather: {
    temp: number
    apparent: number
    humidity: number
    windSpeed: number
    windDir: number
    cloud: number
    precip: number
    isDay: boolean
    code: number
    label: string
    uv: number
  }
  air: {
    usAqi: number | null
    euAqi: number | null
    pm25: number | null
    pm10: number | null
    ozone: number | null
    no2: number | null
    so2: number | null
    co: number | null
  }
  pollen: {
    grass: number | null
    birch: number | null
    ragweed: number | null
    alder: number | null
    max: number | null
    available: boolean
  }
  derived: {
    health: number // 0..1 — the "Biosphere Index" driving the bloom
    aqiValue: number | null
    aqiCategory: string
    uvCategory: string
    pollenCategory: string
  }
}

const WMO: Record<number, string> = {
  0: 'CLEAR', 1: 'MAINLY CLEAR', 2: 'PARTLY CLOUDY', 3: 'OVERCAST',
  45: 'FOG', 48: 'RIME FOG', 51: 'LIGHT DRIZZLE', 53: 'DRIZZLE', 55: 'DENSE DRIZZLE',
  61: 'LIGHT RAIN', 63: 'RAIN', 65: 'HEAVY RAIN', 66: 'FREEZING RAIN', 67: 'FREEZING RAIN',
  71: 'LIGHT SNOW', 73: 'SNOW', 75: 'HEAVY SNOW', 77: 'SNOW GRAINS',
  80: 'RAIN SHOWERS', 81: 'RAIN SHOWERS', 82: 'VIOLENT SHOWERS', 85: 'SNOW SHOWERS', 86: 'SNOW SHOWERS',
  95: 'THUNDERSTORM', 96: 'THUNDERSTORM + HAIL', 99: 'THUNDERSTORM + HAIL',
}

export const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
export const compass = (deg: number) => COMPASS[Math.round(((deg % 360) / 22.5)) % 16]

export function aqiCategory(aqi: number | null): string {
  if (aqi == null) return 'N/A'
  if (aqi <= 50) return 'GOOD'
  if (aqi <= 100) return 'MODERATE'
  if (aqi <= 150) return 'SENSITIVE'
  if (aqi <= 200) return 'UNHEALTHY'
  if (aqi <= 300) return 'VERY UNHEALTHY'
  return 'HAZARDOUS'
}

export function uvCategory(uv: number): string {
  if (uv < 3) return 'LOW'
  if (uv < 6) return 'MODERATE'
  if (uv < 8) return 'HIGH'
  if (uv < 11) return 'VERY HIGH'
  return 'EXTREME'
}

function pollenCategory(v: number | null): string {
  if (v == null) return 'N/A'
  if (v < 10) return 'LOW'
  if (v < 50) return 'MODERATE'
  if (v < 100) return 'HIGH'
  return 'VERY HIGH'
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/** Composite "Biosphere Index" 0..1 — air quality dominates, UV + pollen nudge. */
function computeHealth(aqi: number | null, pm25: number | null, uv: number, pollenMax: number | null): number {
  const aqiScore = aqi != null ? clamp01(1 - (aqi - 15) / 185) : pm25 != null ? clamp01(1 - pm25 / 90) : 0.7
  const uvScore = clamp01(1 - Math.max(0, uv - 6) / 6) // only very high UV penalizes
  const pollenScore = pollenMax != null ? clamp01(1 - pollenMax / 120) : 1
  return clamp01(aqiScore * 0.7 + uvScore * 0.15 + pollenScore * 0.15)
}

async function getJSON(url: string, params: Record<string, string>, signal?: AbortSignal) {
  const u = new URL(url)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  const res = await fetch(u.toString(), { signal })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.json()
}

/** Resolve a place name → coordinates. */
export async function geocode(name: string, signal?: AbortSignal): Promise<GeoPlace | null> {
  const j = await getJSON(GEOCODE, { name, count: '1', language: 'en', format: 'json' }, signal)
  const r = j?.results?.[0]
  if (!r) return null
  return {
    name: r.name,
    lat: r.latitude,
    lng: r.longitude,
    country: r.country_code || r.country || '',
    admin: r.admin1,
    timezone: r.timezone || 'auto',
  }
}

/** Reverse-lookup a coarse label for raw coordinates (best-effort). */
export async function reverseLabel(lat: number, lng: number, signal?: AbortSignal): Promise<Partial<GeoPlace>> {
  try {
    const j = await getJSON(GEOCODE, { latitude: String(lat), longitude: String(lng), count: '1', language: 'en', format: 'json' }, signal)
    const r = j?.results?.[0]
    if (r) return { name: r.name, country: r.country_code || '', admin: r.admin1, timezone: r.timezone }
  } catch {
    /* geocoding reverse is optional */
  }
  return {}
}

/** Pull the full environmental snapshot for a coordinate. */
export async function fetchEnvironment(place: GeoPlace, signal?: AbortSignal): Promise<EnvSnapshot> {
  const coords = { latitude: String(place.lat), longitude: String(place.lng), timezone: 'auto' }
  const [fc, aq] = await Promise.all([
    getJSON(FORECAST, {
      ...coords,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m',
      daily: 'uv_index_max',
    }, signal),
    getJSON(AIR, {
      ...coords,
      current: 'us_aqi,european_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,uv_index,grass_pollen,birch_pollen,ragweed_pollen,alder_pollen',
    }, signal),
  ])

  const c = fc.current ?? {}
  const a = aq.current ?? {}
  const uv = a.uv_index ?? fc.daily?.uv_index_max?.[0] ?? 0

  const pollenVals = [a.grass_pollen, a.birch_pollen, a.ragweed_pollen, a.alder_pollen].filter(
    (v) => typeof v === 'number',
  ) as number[]
  const pollenMax = pollenVals.length ? Math.max(...pollenVals) : null

  const aqiValue = a.us_aqi ?? a.european_aqi ?? null

  return {
    place: { ...place, timezone: fc.timezone || place.timezone },
    fetchedAt: Date.now(),
    weather: {
      temp: c.temperature_2m ?? 0,
      apparent: c.apparent_temperature ?? c.temperature_2m ?? 0,
      humidity: c.relative_humidity_2m ?? 0,
      windSpeed: c.wind_speed_10m ?? 0,
      windDir: c.wind_direction_10m ?? 0,
      cloud: c.cloud_cover ?? 0,
      precip: c.precipitation ?? 0,
      isDay: (c.is_day ?? 1) === 1,
      code: c.weather_code ?? 0,
      label: WMO[c.weather_code ?? 0] ?? 'UNKNOWN',
      uv,
    },
    air: {
      usAqi: a.us_aqi ?? null,
      euAqi: a.european_aqi ?? null,
      pm25: a.pm2_5 ?? null,
      pm10: a.pm10 ?? null,
      ozone: a.ozone ?? null,
      no2: a.nitrogen_dioxide ?? null,
      so2: a.sulphur_dioxide ?? null,
      co: a.carbon_monoxide ?? null,
    },
    pollen: {
      grass: a.grass_pollen ?? null,
      birch: a.birch_pollen ?? null,
      ragweed: a.ragweed_pollen ?? null,
      alder: a.alder_pollen ?? null,
      max: pollenMax,
      available: pollenVals.length > 0,
    },
    derived: {
      health: computeHealth(aqiValue, a.pm2_5 ?? null, uv, pollenMax),
      aqiValue,
      aqiCategory: aqiCategory(aqiValue),
      uvCategory: uvCategory(uv),
      pollenCategory: pollenCategory(pollenMax),
    },
  }
}

export const DEFAULT_PLACE: GeoPlace = {
  name: 'London', lat: 51.5074, lng: -0.1278, country: 'GB', admin: 'England', timezone: 'Europe/London',
}
