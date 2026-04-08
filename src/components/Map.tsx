import { useEffect, useRef, useState } from 'react'
import { loadGoogleMapsSdk } from '../api/places'

type MarkerData = {
  lat: number
  lng: number
  title?: string
  label?: string
  color?: string
  labelColor?: string
  scale?: number
  emoji?: string
  iconUrl?: string
  pin?: boolean
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
  const prevMarkersKeyRef = useRef<string | null>(null)
  const prevCenterKeyRef = useRef<string | null>(null)

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

        // compute simple keys to detect whether markers/center changed
        const makeMarkersKey = (arr: any[]) =>
          (arr || [])
            .map((it) => `${it.lat},${it.lng},${it.iconUrl ?? it.emoji ?? it.label ?? ''},${it.pin ? '1' : '0'},${it.color ?? ''},${it.scale ?? 0}`)
            .join('|')

        const markersKey = makeMarkersKey(markers)
        const centerKey = center ? `${center.lat},${center.lng}` : ''

        // if markers and center didn't change since last render, skip re-adding markers / fitting bounds
        if (mapRef.current && prevMarkersKeyRef.current === markersKey && prevCenterKeyRef.current === centerKey) {
          // nothing to do
          return
        }

        // remember current keys
        prevMarkersKeyRef.current = markersKey
        prevCenterKeyRef.current = centerKey

        // remove existing markers
        markerRefs.current.forEach((m) => m.setMap(null))
        markerRefs.current = []

        const bounds = new google.maps.LatLngBounds()
        let added = false

        if (center) {
          bounds.extend(center)
          added = true
        }

        // helper to create an emoji-based SVG data URL
        const createEmojiSvgDataUrl = (emoji: string, bgColor: string, size: number, textColor: string) => {
          const fontSize = Math.round(size * 0.6)
          const svg = ` <svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>` +
            `<rect width='100%' height='100%' rx='${Math.round(size * 0.2)}' fill='${bgColor}' />` +
            `<text x='50%' y='50%' dominant-baseline='central' text-anchor='middle' font-size='${fontSize}px' font-family='Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, Android Emoji, sans-serif' fill='${textColor}'>${emoji}</text>` +
            `</svg>`

          return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg)
        }

        // helper to create a teardrop pin SVG data URL
        const createPinSvgDataUrl = (color: string, size: number) => {
          const svg = ` <svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 24 24'>` +
            `<path d='M12 2C8.13 2 5 5.13 5 9c0 4.98 7 13 7 13s7-8.02 7-13c0-3.87-3.13-7-7-7z' fill='${color}' stroke='#ffffff' stroke-width='0.6'/>` +
            `<circle cx='12' cy='9' r='3' fill='white'/>` +
            `</svg>`

          return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg)
        }

        markers.forEach((m) => {
          if (typeof m.lat !== 'number' || typeof m.lng !== 'number') return

          const markerOptions: any = {
            position: { lat: m.lat, lng: m.lng },
            map: mapRef.current,
            title: m.title,
          }

          // prefer explicit icon or emoji/pin over label overlay
          const pixelSize = Math.round((m.scale ?? 9) * 4)

          if (m.iconUrl) {
            markerOptions.icon = {
              url: m.iconUrl,
              scaledSize: new google.maps.Size(pixelSize, pixelSize),
              anchor: new google.maps.Point(Math.round(pixelSize / 2), Math.round(pixelSize / 2)),
            }
          } else if (m.pin) {
            const url = createPinSvgDataUrl(m.color ?? '#000000', pixelSize)
            markerOptions.icon = {
              url,
              scaledSize: new google.maps.Size(pixelSize, pixelSize),
              anchor: new google.maps.Point(Math.round(pixelSize / 2), pixelSize),
            }
          } else if (m.emoji) {
            const url = createEmojiSvgDataUrl(m.emoji, m.color ?? '#333333', pixelSize, m.labelColor ?? '#ffffff')
            markerOptions.icon = {
              url,
              scaledSize: new google.maps.Size(pixelSize, pixelSize),
              anchor: new google.maps.Point(Math.round(pixelSize / 2), Math.round(pixelSize / 2)),
            }
          } else if (m.label) {
            markerOptions.label = { text: String(m.label), color: m.labelColor ?? 'white', fontWeight: '700' }
          } else if (m.color) {
            // fallback to circular symbol if color-only provided
            markerOptions.icon = {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: m.color,
              fillOpacity: 1,
              scale: m.scale ?? 9,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }
          }

          const marker = new google.maps.Marker(markerOptions)
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
