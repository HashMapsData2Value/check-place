export type CategoryKey = 'campus' | 'transit' | 'healthcare' | 'grocery'

export type Landmark = {
  name: string
  category: CategoryKey
  latitude: number
  longitude: number
  area: string
  description: string
}

export type CategoryMeta = {
  title: string
  eyebrow: string
  description: string
  weight: number
}

export type Match = Landmark & {
  distanceMiles: number
  accessLabel: string
  types?: string[]
}

export type CategoryResult = {
  key: CategoryKey
  meta: CategoryMeta
  score: number
  rating: string
  nearest: Match
  matches: Match[]
}

export type AnalysisResult = {
  formattedAddress: string
  latitude: number
  longitude: number
  score: number
  rating: string
  summary: string
  categories: CategoryResult[]
}

export type GeocodeResult = {
  formatted_address: string
  geometry: { location: { lat: number; lng: number } }
}

export type GeocodeResponse = {
  status: string
  error_message?: string
  results?: GeocodeResult[]
}

export type PlacesNearbyResult = {
  name: string
  geometry: { location: { lat: number; lng: number } }
  vicinity?: string
  place_id?: string
  types?: string[]
}

export type PlacesNearbyResponse = {
  status: string
  results?: PlacesNearbyResult[]
  error_message?: string
}
