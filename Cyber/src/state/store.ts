// Environmental store. Holds the live snapshot + load status and exposes actions
// to change location. Fetching is async off the render loop; the 3D organism and
// HUD subscribe with narrow selectors.
import { create } from 'zustand'
import {
  fetchEnvironment, geocode, reverseLabel, DEFAULT_PLACE,
  type EnvSnapshot, type GeoPlace,
} from '../lib/environment'

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface EnvState {
  snapshot: EnvSnapshot | null
  place: GeoPlace | null
  status: Status
  error: string | null
  load: (place: GeoPlace) => Promise<void>
  search: (query: string) => Promise<void>
  locateMe: () => Promise<void>
  refresh: () => void
}

let ctrl: AbortController | null = null

export const useEnv = create<EnvState>((set, get) => ({
  snapshot: null,
  place: null,
  status: 'idle',
  error: null,

  load: async (place) => {
    ctrl?.abort()
    ctrl = new AbortController()
    set({ status: 'loading', error: null, place })
    try {
      const snap = await fetchEnvironment(place, ctrl.signal)
      set({ snapshot: snap, place: snap.place, status: 'ready', error: null })
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      set({ status: 'error', error: (e as Error).message || 'fetch failed' })
    }
  },

  search: async (query) => {
    const q = query.trim()
    if (!q) return
    set({ status: 'loading', error: null })
    try {
      const place = await geocode(q)
      if (!place) {
        set({ status: get().snapshot ? 'ready' : 'error', error: `no match for "${q}"` })
        return
      }
      await get().load(place)
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },

  locateMe: async () => {
    if (!('geolocation' in navigator)) {
      set({ error: 'geolocation unavailable' })
      return
    }
    set({ status: 'loading', error: null })
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        const meta = await reverseLabel(lat, lng)
        await get().load({
          name: meta.name || 'MY POSITION',
          lat, lng,
          country: meta.country || '',
          admin: meta.admin,
          timezone: meta.timezone || 'auto',
        })
      },
      (err) => set({ status: get().snapshot ? 'ready' : 'error', error: `location denied (${err.code})` }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    )
  },

  refresh: () => {
    const p = get().place
    if (p) get().load(p)
  },
}))

/** Boot the data stream: load a starting location, then refresh every 10 min. */
export function initEnvironment(): () => void {
  const { load, refresh } = useEnv.getState()
  load(DEFAULT_PLACE)
  const id = window.setInterval(refresh, 10 * 60 * 1000)
  return () => {
    window.clearInterval(id)
    ctrl?.abort()
  }
}
