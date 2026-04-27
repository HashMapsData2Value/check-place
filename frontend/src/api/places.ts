import type { GeocodeResult, PlacesNearbyResult } from '../types'

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').trim()

function apiUrl(path: string) {
  if (!API_BASE) return path
  const base = API_BASE.replace(/\/$/, '')
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}
export { apiUrl }

// Load Google Maps JS SDK for client-side map rendering.
export async function loadGoogleMapsSdk(): Promise<void> {
  // No-op: frontend map rendering uses Leaflet + OpenStreetMap tiles
  return Promise.resolve()
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const resp = await fetch(apiUrl(`/api/search?q=${encodeURIComponent(address)}`))
  if (!resp.ok) throw new Error('Geocode request failed')

  const payload = await resp.json()
  if (payload.error) throw new Error(payload.error)

  if (payload.source === 'zillow') {
    // return a minimal GeocodeResult-like object for compatibility
    return {
      formatted_address: payload.parsed ?? address,
      geometry: { location: { lat: 0, lng: 0 } },
      place_id: undefined,
      types: [],
    } as GeocodeResult
  }

  if (payload.source === 'google' && payload.raw && payload.raw.results && payload.raw.results.length) {
    return payload.raw.results[0] as GeocodeResult
  }

  throw new Error('No address match was returned.')
}

export async function fetchNearbyPlaces(lat: number, lng: number, type: string | string[]): Promise<PlacesNearbyResult[]> {
  const types = Array.isArray(type) ? type.join(',') : type
  const resp = await fetch(apiUrl(`/api/nearby?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}&type=${encodeURIComponent(types)}`))
  if (!resp.ok) throw new Error('Nearby request failed')

  const payload = await resp.json()
  if (payload.error) throw new Error(payload.error)

  return payload.results ?? []
}
