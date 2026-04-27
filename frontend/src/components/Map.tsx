import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker, Tooltip } from 'react-leaflet'
import L from 'leaflet'

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

function FitBounds({ markers, center }: { markers: MarkerData[]; center?: { lat: number; lng: number } | null }) {
  const map = useMap()
  useEffect(() => {
    const bounds = L.latLngBounds([])
    if (center) bounds.extend([center.lat, center.lng])
    markers.forEach((m) => bounds.extend([m.lat, m.lng]))
    if (bounds.isValid()) {
      try {
        map.fitBounds(bounds, { padding: [40, 40] })
      } catch (e) {
        if (center) map.setView([center.lat, center.lng], map.getZoom())
      }
    }
  }, [markers, center, map])
  return null
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
  const initial = useMemo(() => center ?? { lat: 39.0, lng: -77.0 }, [center])

  const makeEmojiIcon = (emoji: string, size = 36) => {
    const html = `<div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:${Math.round(
      size / 6,
    )}px;background:#333;color:white;font-size:${Math.round(size * 0.6)}px">${emoji}</div>`
    return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [Math.round(size / 2), Math.round(size / 2)] })
  }

  const makePinIcon = (color = '#007bff', size = 36) => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 24 24'><path d='M12 2C8.13 2 5 5.13 5 9c0 4.98 7 13 7 13s7-8.02 7-13c0-3.87-3.13-7-7-7z' fill='${color}' stroke='#ffffff' stroke-width='0.6'/><circle cx='12' cy='9' r='3' fill='white'/></svg>`
    return L.divIcon({ html: svg, className: '', iconSize: [size, size], iconAnchor: [Math.round(size / 2), size] })
  }

  return (
    <MapContainer center={[initial.lat, initial.lng]} zoom={zoom} style={{ width: '100%', height: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />

      {markers.map((m, idx) => {
        if (typeof m.lat !== 'number' || typeof m.lng !== 'number') return null

        if (m.iconUrl) {
          const icon = L.icon({ iconUrl: m.iconUrl, iconSize: [36, 36], iconAnchor: [18, 18] })
          return (
            <Marker key={idx} position={[m.lat, m.lng]} icon={icon}>
              {m.title ? <Popup>{m.title}</Popup> : null}
            </Marker>
          )
        }

        if (m.pin) {
          const icon = makePinIcon(m.color ?? '#333333', (m.scale ?? 9) * 4)
          return (
            <Marker key={idx} position={[m.lat, m.lng]} icon={icon}>
              {m.title ? <Popup>{m.title}</Popup> : null}
            </Marker>
          )
        }

        if (m.emoji) {
          const icon = makeEmojiIcon(m.emoji, (m.scale ?? 9) * 4)
          return (
            <Marker key={idx} position={[m.lat, m.lng]} icon={icon}>
              {m.title ? <Popup>{m.title}</Popup> : null}
            </Marker>
          )
        }

        if (m.label) {
          return (
            <Marker key={idx} position={[m.lat, m.lng]}>
              <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent>
                <span style={{ fontWeight: 700, color: m.labelColor ?? '#000' }}>{m.label}</span>
              </Tooltip>
            </Marker>
          )
        }

        // fallback: colored circle marker
        return (
          <CircleMarker key={idx} center={[m.lat, m.lng]} radius={(m.scale ?? 6)} pathOptions={{ color: m.color ?? '#333333', fillColor: m.color ?? '#333333', fillOpacity: 1 }}>
            {m.title ? <Tooltip direction="top" offset={[0, -10]} permanent>{m.title}</Tooltip> : null}
          </CircleMarker>
        )
      })}

      <FitBounds markers={markers} center={center ?? null} />
    </MapContainer>
  )
}
