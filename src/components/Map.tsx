import { useEffect, useRef, useState } from 'react'
import { loadGoogleMapsSdk } from '../api/places'

type MarkerData = {
  lat: number
  lng: number
  title?: string
  label?: string
}

export default function Map({
  center,
  markers = [],
  zoom = 14,
}: {
  center?: { lat: number; lng: number } | null
  markers?: MarkerData[]
  zoom?: number
}) {
  const elRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any | null>(null)
  const markerRefs = useRef<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      try {
        await loadGoogleMapsSdk()
        const google = (window as any).google
        if (!elRef.current) return

        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(elRef.current, {
            center: center ?? { lat: 39.0, lng: -77.0 },
            zoom,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          })
        }

        // Update center if provided
        if (center && mapRef.current) {
          try {
            mapRef.current.setCenter(center)
          } catch (e) {
            console.debug('setCenter failed', e)
          }
        }

        // remove existing markers
        markerRefs.current.forEach((m) => m.setMap(null))
        markerRefs.current = []

        const bounds = new google.maps.LatLngBounds()
        let added = false

        if (center) {
          bounds.extend(center)
          added = true
        }

        markers.forEach((m) => {
          if (typeof m.lat !== 'number' || typeof m.lng !== 'number') return
          const marker = new google.maps.Marker({
            position: { lat: m.lat, lng: m.lng },
            map: mapRef.current,
            title: m.title,
            label: m.label,
          })
          markerRefs.current.push(marker)
          bounds.extend({ lat: m.lat, lng: m.lng })
          added = true
        })

        if (added) {
          try {
            mapRef.current.fitBounds(bounds, 40)
          } catch (e) {
            if (center) mapRef.current.setCenter(center)
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('Failed to load Google Maps SDK', message)
        setError(message)
      }
    }

    init()

    return () => {
      markerRefs.current.forEach((m) => m.setMap(null))
      markerRefs.current = []
      mapRef.current = null
    }
  }, [center, markers, zoom])

  return (
    <div ref={elRef} className="map-embed">
      {error ? <div className="map-error">{error}</div> : null}
    </div>
  )
}
