import type { GeocodeResponse, GeocodeResult, PlacesNearbyResult } from '../types'

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? ''

export async function loadGoogleMapsSdk(): Promise<void> {
  if ((window as any).google && (window as any).google.maps && (window as any).google.maps.places) return

  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-gmaps-sdk]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Google Maps SDK failed to load')))
      return
    }

    const script = document.createElement('script')
    script.setAttribute('data-gmaps-sdk', '1')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Maps SDK failed to load'))
    document.head.appendChild(script)
  })
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const searchParams = new URLSearchParams({
    address,
    key: GOOGLE_API_KEY,
  })
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${searchParams.toString()}`,
  )

  if (!response.ok) {
    throw new Error('Google Geocoding request failed.')
  }

  const payload = (await response.json()) as GeocodeResponse

  if (payload.status !== 'OK' || !payload.results?.length) {
    throw new Error(payload.error_message ?? 'No address match was returned.')
  }

  return payload.results[0]
}

export async function fetchNearbyPlaces(lat: number, lng: number, type: string | string[]): Promise<PlacesNearbyResult[]> {
  if (!GOOGLE_API_KEY) throw new Error('Google API key not configured for Places API.')
  await loadGoogleMapsSdk()

  const google = (window as any).google
  const service = new google.maps.places.PlacesService(document.createElement('div'))

  const tryType = async (t: string) => {
    return new Promise<PlacesNearbyResult[]>((resolve) => {
      const request: any = {
        location: new google.maps.LatLng(lat, lng),
        rankBy: google.maps.places.RankBy.DISTANCE,
        type: t,
      }

      service.nearbySearch(request, (results: any[], status: any) => {
        console.log('Places JS SDK status for type', t, { status, resultsCount: results?.length ?? 0 })

        if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length) {
          const mapped = results.map((r) => ({
            name: r.name ?? r.formatted_address ?? '',
            geometry: { location: { lat: r.geometry.location.lat(), lng: r.geometry.location.lng() } },
            vicinity: r.vicinity ?? r.formatted_address ?? '',
            place_id: r.place_id ?? undefined,
            types: r.types ?? [],
          }))

          resolve(mapped)
        } else {
          resolve([])
        }
      })
    })
  }

  if (Array.isArray(type)) {
    for (const t of type) {
      try {
        const results = await tryType(t)
        if (results.length > 0) {
          console.log('Places: returning results for type', t, 'count', results.length)
          return results
        }
        console.log('Places: no results for type', t, { lat, lng })
      } catch (err) {
        console.error('Places SDK type failed', t, err)
      }
    }

    console.log('Places: no results for any tried types', { tried: type, lat, lng })
    return []
  }

  return await tryType(type)
}
