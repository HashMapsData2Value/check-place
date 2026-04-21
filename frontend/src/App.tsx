import { type FormEvent, useEffect, useState, useMemo } from 'react'
import './App.css'
import './ui.css'
import Map from './components/Map'
import type {
  CategoryKey,
  Landmark,
  CategoryMeta,
  Match,
  CategoryResult,
  AnalysisResult,
} from './types'
import { haversineMiles, formatMiles } from './utils/geo'
import { geocodeAddress, fetchNearbyPlaces, apiUrl } from './api/places'

function isZillowUrl(value: string) {
  try {
    const u = new URL(value)
    return /(^|\.)zillow\.com$/.test(u.host)
  } catch (e) {
    return /^https?:\/\/(www\.)?zillow\.com\//i.test(value)
  }
}

const CATEGORY_META: Record<CategoryKey, CategoryMeta> = {
  campus: {
    title: 'University Shuttle',
    eyebrow: 'Campus mobility',
    description: 'Starter UMD shuttle landmarks and campus pickup anchors.',
    weight: 0.3,
  },
  transit: {
    title: 'Train stations',
    eyebrow: 'Regional rail',
    description: 'Major train and rail stations (Metro, MARC, Amtrak) around College Park and DC.',
    weight: 0.3,
  },
  healthcare: {
    title: 'Hospitals',
    eyebrow: 'Healthcare coverage',
    description: 'Major hospitals that matter for emergency and routine access.',
    weight: 0.2,
  },
  grocery: {
    title: 'Grocery Stores',
    eyebrow: 'Daily essentials',
    description: 'A practical mix of full-size grocery and warehouse options.',
    weight: 0.2,
  },
}

const LANDMARKS: Landmark[] = [
  {
    name: 'Stamp Student Union Shuttle Stop',
    category: 'campus',
    latitude: 38.98895,
    longitude: -76.94463,
    area: 'College Park',
    description: 'High-traffic UMD shuttle hub near the center of campus.',
  },
  {
    name: 'Regents Drive Garage Shuttle Stop',
    category: 'campus',
    latitude: 38.99037,
    longitude: -76.94071,
    area: 'College Park',
    description: 'Useful anchor for east-campus bus circulation.',
  },
  {
    name: 'The Hotel at UMD Shuttle Stop',
    category: 'campus',
    latitude: 38.98092,
    longitude: -76.93752,
    area: 'College Park',
    description: 'Common pickup point connecting Route 1 housing to campus.',
  },
  {
    name: 'Courtyards at UMD Shuttle Stop',
    category: 'campus',
    latitude: 38.99445,
    longitude: -76.93411,
    area: 'College Park',
    description: 'Important shuttle access point for off-campus student housing.',
  },
  {
    name: 'College Park-U of Md Metro Station',
    category: 'transit',
    latitude: 38.97854,
    longitude: -76.92822,
    area: 'College Park',
    description: 'Green Line and MARC Camden Line access.',
  },
  {
    name: 'Greenbelt Metro Station',
    category: 'transit',
    latitude: 39.01104,
    longitude: -76.91162,
    area: 'Greenbelt',
    description: 'Northern Green Line terminus with strong commuter value.',
  },
  {
    name: 'New Carrollton Station',
    category: 'transit',
    latitude: 38.94875,
    longitude: -76.87192,
    area: 'New Carrollton',
    description: 'Metro, MARC, and Amtrak access in one hub.',
  },
  {
    name: 'Union Station',
    category: 'transit',
    latitude: 38.8971,
    longitude: -77.00637,
    area: 'Washington, DC',
    description: 'Major intercity and commuter rail destination.',
  },
  {
    name: 'MedStar Washington Hospital Center',
    category: 'healthcare',
    latitude: 38.92927,
    longitude: -77.01464,
    area: 'Washington, DC',
    description: 'Large regional hospital and trauma center.',
  },
  {
    name: 'University of Maryland Capital Region Medical Center',
    category: 'healthcare',
    latitude: 38.85374,
    longitude: -76.83229,
    area: 'Largo',
    description: 'Major Prince George\'s County hospital.',
  },
  {
    name: 'Holy Cross Hospital',
    category: 'healthcare',
    latitude: 39.01591,
    longitude: -77.01572,
    area: 'Silver Spring',
    description: 'Well-known hospital option north of DC.',
  },
  {
    name: 'Adventist HealthCare White Oak Medical Center',
    category: 'healthcare',
    latitude: 39.04916,
    longitude: -76.96589,
    area: 'Silver Spring',
    description: 'Important hospital access for northeastern DMV trips.',
  },
  {
    name: 'Trader Joe\'s College Park',
    category: 'grocery',
    latitude: 38.98034,
    longitude: -76.93774,
    area: 'College Park',
    description: 'Compact but valuable grocery option near Route 1.',
  },
  {
    name: 'Whole Foods Market Riverdale Park',
    category: 'grocery',
    latitude: 38.96392,
    longitude: -76.93651,
    area: 'Riverdale Park',
    description: 'High-amenity grocery anchor south of College Park.',
  },
  {
    name: 'Costco Wholesale Beltsville',
    category: 'grocery',
    latitude: 39.04306,
    longitude: -76.90733,
    area: 'Beltsville',
    description: 'Warehouse grocery run for bulk shopping.',
  },
  {
    name: 'Giant Food Hyattsville',
    category: 'grocery',
    latitude: 38.95733,
    longitude: -76.93978,
    area: 'Hyattsville',
    description: 'Full-size supermarket option for regular weekly needs.',
  },
]

function getAccessLabel(distanceMiles: number) {
  if (distanceMiles <= 0.5) {
    return 'Walkable'
  }

  if (distanceMiles <= 1.5) {
    return 'Quick trip'
  }

  if (distanceMiles <= 4) {
    return 'Short drive'
  }

  if (distanceMiles <= 8) {
    return 'Regular commute'
  }

  return 'Farther outing'
}

function scoreDistance(distanceMiles: number, category: CategoryKey) {
  // Map distance (miles) → approximate walking minutes (1 mile ≈ 20 minutes)
  if (!isFinite(distanceMiles) || distanceMiles > 900) return 1
  const minutes = distanceMiles * 20

  // Return integer walkability score 1..5 (5 = best)
  switch (category) {
    case 'campus': {
      if (minutes <= 5) return 5
      if (minutes <= 15) return 4
      if (minutes <= 30) return 3
      if (minutes <= 45) return 2
      return 1
    }
    case 'transit': {
      if (minutes <= 5) return 5
      if (minutes <= 15) return 4
      if (minutes <= 30) return 3
      if (minutes <= 45) return 2
      return 1
    }
    case 'healthcare': {
      if (minutes <= 10) return 5
      if (minutes <= 20) return 4
      if (minutes <= 30) return 3
      if (minutes <= 45) return 2
      return 1
    }
    case 'grocery': {
      if (minutes <= 5) return 5
      if (minutes <= 15) return 4
      if (minutes <= 30) return 3
      if (minutes <= 45) return 2
      return 1
    }
    default: {
      if (minutes <= 5) return 5
      if (minutes <= 15) return 4
      if (minutes <= 30) return 3
      if (minutes <= 45) return 2
      return 1
    }
  }
}

function getRating(score: number) {
  // score is on a 1..5 walkability scale (may be fractional for aggregated score)
  if (score >= 4.5) return 'Excellent'
  if (score >= 3.5) return 'Strong'
  if (score >= 2.5) return 'Balanced'
  if (score >= 1.5) return 'Limited'
  return 'Weak'
}

// `formatMiles` moved to `src/utils/geo.ts` and is imported at top



// geocoding moved to src/api/places.ts

const PLACE_TYPE_BY_CATEGORY: Record<CategoryKey, string | string[]> = {
  campus: '',
  transit: ['train_station', 'railway_station', 'subway_station', 'transit_station'],
  healthcare: ['hospital', 'medical_center'],
  grocery: ['grocery_or_supermarket', 'supermarket', 'grocery_store'],
}

// fetchNearbyPlaces moved to `src/api/places.ts`

function computeCampusMatches(lat: number, lng: number, stations?: any[]): Match[] {
  if (stations && stations.length > 0) {
    return stations
      .filter((s: any) => s && typeof s.lat === 'number' && typeof s.lng === 'number')
      .map((s: any) => {
        const distanceMiles = haversineMiles(lat, lng, s.lat, s.lng)
        return {
          name: s.name,
          category: 'campus' as CategoryKey,
          latitude: s.lat,
          longitude: s.lng,
          area: s.area ?? '',
          description: (s.lines ?? []).join(', '),
          types: s.lines ?? [],
          distanceMiles,
          accessLabel: getAccessLabel(distanceMiles),
        }
      })
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
  }

  return LANDMARKS.filter((l) => l.category === 'campus')
    .map((landmark) => {
      const distanceMiles = haversineMiles(lat, lng, landmark.latitude, landmark.longitude)
      return {
        ...landmark,
        distanceMiles,
        accessLabel: getAccessLabel(distanceMiles),
      }
    })
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
}

async function computePlacesMatches(key: CategoryKey, lat: number, lng: number): Promise<Match[]> {
  const placeType = PLACE_TYPE_BY_CATEGORY[key]
  const places = await fetchNearbyPlaces(lat, lng, placeType)

  const allMatches: Match[] = (places ?? []).map((p: any) => {
    const distanceMiles = haversineMiles(lat, lng, p.geometry.location.lat, p.geometry.location.lng)
    return {
      name: p.name,
      category: key,
      latitude: p.geometry.location.lat,
      longitude: p.geometry.location.lng,
      area: p.vicinity ?? '',
      description: (p.types ?? []).join(', '),
      types: p.types ?? [],
      distanceMiles,
      accessLabel: getAccessLabel(distanceMiles),
    }
  })

  allMatches.sort((a, b) => a.distanceMiles - b.distanceMiles)

  if (allMatches.length > 0 && key === 'transit') {
    const preferredTypes = new Set(['subway_station', 'train_station', 'railway_station', 'transit_station'])
    const preferred = allMatches.find((m) => (m.types ?? []).some((t) => preferredTypes.has(t)) || /metro|mta|marc|station/.test(m.name.toLowerCase()))
    if (preferred) {
      allMatches.sort((a, b) => (a === preferred ? -1 : b === preferred ? 1 : a.distanceMiles - b.distanceMiles))
    }
  }

  return allMatches
}

function makeCategoryResult(key: CategoryKey, meta: CategoryMeta, matches: Match[]): CategoryResult {
  if (!matches || matches.length === 0) {
    const nearest = {
      name: `No ${meta.title} found`,
      category: key,
      latitude: 0,
      longitude: 0,
      area: '',
      description: '',
      distanceMiles: 999,
      accessLabel: getAccessLabel(999),
      types: [],
    } as Match

    const score = scoreDistance(nearest.distanceMiles, key)

    return {
      key,
      meta,
      score,
      rating: getRating(score),
      nearest,
      matches: [],
    }
  }

  const nearest = matches[0]
  const score = scoreDistance(nearest.distanceMiles, key)

  return {
    key,
    meta,
    score,
    rating: getRating(score),
    nearest,
    matches: matches.slice(0, 3),
  }
}

async function analyzeLocation(formattedAddress: string, lat: number, lng: number, stations?: any[]): Promise<AnalysisResult> {
  const categories: CategoryResult[] = []

  for (const key of Object.keys(CATEGORY_META) as CategoryKey[]) {
    const meta = CATEGORY_META[key]

    if (key === 'campus') {
      const matches = computeCampusMatches(lat, lng, stations)
      categories.push(makeCategoryResult(key, meta, matches))
      continue
    }

    try {
      const allMatches = await computePlacesMatches(key, lat, lng)
      const matches = allMatches.slice(0, 6)
      categories.push(makeCategoryResult(key, meta, matches))
    } catch (err) {
      const nearest = {
        name: `No ${meta.title} found`,
        category: key,
        latitude: lat,
        longitude: lng,
        area: '',
        description: err instanceof Error ? err.message : String(err),
        distanceMiles: 999,
        accessLabel: getAccessLabel(999),
        types: [],
      } as Match

      const score = scoreDistance(nearest.distanceMiles, key)

      categories.push({
        key,
        meta,
        score,
        rating: getRating(score),
        nearest,
        matches: [],
      })
    }
  }

  const weightedScore = categories.reduce((total, category) => total + category.score * category.meta.weight, 0)
  const score = Math.round(weightedScore * 10) / 10
  const rating = getRating(score)
  const strongest = [...categories].sort((a, b) => b.score - a.score)[0]
  const weakest = [...categories].sort((a, b) => a.score - b.score)[0]
  const summary = `${strongest.meta.title} is the strongest category here, while ${weakest.meta.title.toLowerCase()} is the main tradeoff.`

  return {
    formattedAddress,
    latitude: lat,
    longitude: lng,
    score,
    rating,
    summary,
    categories,
  }
}

function App() {
  const [address, setAddress] = useState('')
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Record<CategoryKey, boolean>>({} as Record<CategoryKey, boolean>)
  const [stations, setStations] = useState<any[] | null>(null)

  useEffect(() => {
    // load consolidated shuttle stations published under public/data at runtime
    void fetch('/data/umd_shuttles_consolidated.json')
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.stations)) setStations(data.stations)
      })
      .catch((err) => {
        console.warn('Failed to load consolidated stations', err)
        setStations(null)
      })
  }, [])

  function toggleCategory(key: CategoryKey) {
    setExpandedCategories((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextAddress = address.trim()

    if (!nextAddress) {
      setErrorMessage('Enter an address to analyze.')
      setAnalysis(null)
      return
    }

    // frontend no longer needs Google API keys; geocoding and places are proxied via backend

    setIsLoading(true)
    setErrorMessage('')

    try {
      // If user pasted a Zillow property URL, call HasData first
      if (isZillowUrl(nextAddress)) {
        const encoded = encodeURIComponent(nextAddress)
        const url = apiUrl(`/api/hasdata?url=${encoded}`)
        const res = await fetch(url)
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`HasData proxy error: ${res.status} ${res.statusText} ${text}`)
        }

        const hd = await res.json()
        const prop = hd?.property

        // prefer geo coordinates returned by HasData; otherwise fallback to geocoding the address
        const lat = prop?.geo?.latitude
        const lng = prop?.geo?.longitude
        const formatted = prop?.address?.addressRaw ?? prop?.address?.street ?? prop?.url ?? nextAddress

        let finalLat = lat
        let finalLng = lng

        if (typeof finalLat !== 'number' || typeof finalLng !== 'number') {
          // try geocoding the raw address
          const g = await geocodeAddress(formatted)
          finalLat = g.geometry.location.lat
          finalLng = g.geometry.location.lng
        }

        // ensure stations are available for analysis (load on-demand if not yet fetched)
        let stationsForAnalyze = stations
        if (!stationsForAnalyze) {
          try {
            const sr = await fetch('/data/umd_shuttles_consolidated.json')
            const sd = await sr.json()
            stationsForAnalyze = Array.isArray(sd.stations) ? sd.stations : null
          } catch (e) {
            stationsForAnalyze = null
          }
        }

        const nextAnalysis = await analyzeLocation(formatted, finalLat, finalLng, stationsForAnalyze ?? undefined)
        // attach property data to analysis for UI
        setAnalysis({ ...nextAnalysis, propertyData: prop })
        return
      }

      const result = await geocodeAddress(nextAddress)
      const lat = result.geometry.location.lat
      const lng = result.geometry.location.lng
      console.log('Geocoded coordinates:', lat, lng)

      // ensure stations are available for analysis (load on-demand if not yet fetched)
      let stationsForAnalyze = stations
      if (!stationsForAnalyze) {
        try {
          const sr = await fetch('/data/umd_shuttles_consolidated.json')
          const sd = await sr.json()
          stationsForAnalyze = Array.isArray(sd.stations) ? sd.stations : null
        } catch (e) {
          stationsForAnalyze = null
        }
      }

      const nextAnalysis = await analyzeLocation(result.formatted_address, lat, lng, stationsForAnalyze ?? undefined)
      setAnalysis(nextAnalysis)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'The address could not be analyzed right now.'

      setErrorMessage(message)
      setAnalysis(null)
    } finally {
      setIsLoading(false)
    }

  }

  const markers = useMemo(() => {
    if (!analysis) return []

    const CATEGORY_MARKERS: Record<CategoryKey, { color: string; emoji: string }> = {
      campus: { color: '#f97316', emoji: '🚌' },
      transit: { color: '#06b6d4', emoji: '🚆' },
      healthcare: { color: '#ef4444', emoji: '🏥' },
      grocery: { color: '#10b981', emoji: '🛒' },
    }

    const m = [
      { lat: analysis.latitude, lng: analysis.longitude, title: 'Search location', pin: true, color: '#000000', scale: 12 },
      ...analysis.categories.flatMap((c) => {
        if (!c.nearest || (c.nearest.distanceMiles ?? 999) >= 999) return []
        const meta = CATEGORY_MARKERS[c.key]
        return [{ lat: c.nearest.latitude, lng: c.nearest.longitude, title: `${c.meta.title}: ${c.nearest.name}`, emoji: meta.emoji, color: meta.color, scale: 8 }]
      }),
    ]

    return m
  }, [analysis])

  useEffect(() => {
    if (markers && markers.length) console.log('Map markers (memo):', markers)
  }, [markers])

  const center = useMemo(() => {
    if (!analysis) return null
    return { lat: analysis.latitude, lng: analysis.longitude }
  }, [analysis?.latitude, analysis?.longitude])

  return (
    <main className="page-shell simple">
      <header className="topbar">
        <h1>Check Place</h1>
        <p className="sub">Quick internal address convenience check</p>
      </header>

      <form className="search-panel centered" onSubmit={handleSubmit}>
        <div className="search-row">
          <input
            id="address-input"
            className="search-input large"
            type="text"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Enter an address"
            autoComplete="street-address"
          />
          <button className="search-button" type="submit" disabled={isLoading}>
            {isLoading ? 'Checking...' : 'Analyze'}
          </button>
        </div>
      </form>

      {analysis ? (
        <div>
          <div className="map-embed">
            <Map center={center} markers={markers} />
          </div>
        </div>
      ) : null}

      <div className="results-area">
        {errorMessage ? <div className="error">{errorMessage}</div> : null}

        {analysis ? (
          <div className="results">
            <h2 className="address">{analysis.formattedAddress}</h2>
            {analysis.propertyData ? (
              <div className="property-card">
                {analysis.propertyData.image ? (
                  <img src={analysis.propertyData.image} alt="property" className="property-thumb" />
                ) : null}
                <div className="property-info">
                  <div className="price">{analysis.propertyData.price != null ? `$${Number(analysis.propertyData.price).toLocaleString()}` : 'Price N/A'}</div>
                  <div className="muted">{analysis.propertyData.address?.addressRaw ?? analysis.propertyData.address?.street ?? ''}</div>
                  <div className="muted">Beds: {analysis.propertyData.beds ?? analysis.propertyData.resoData?.bedrooms ?? '—'} • Baths: {analysis.propertyData.baths ?? '—'}</div>
                  {analysis.propertyData.zestimate ? <div className="muted">Zestimate: {typeof analysis.propertyData.zestimate === 'number' ? `$${Number(analysis.propertyData.zestimate).toLocaleString()}` : analysis.propertyData.zestimate.zestimate ? `$${Number(analysis.propertyData.zestimate.zestimate).toLocaleString()}` : ''}</div> : null}
                  {analysis.propertyData.fees?.monthlyHoaFee ? <div className="muted">{analysis.propertyData.fees.monthlyHoaFee}</div> : null}
                  {analysis.propertyData.url ? (
                    <div><a href={analysis.propertyData.url} target="_blank" rel="noreferrer">View listing</a></div>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="overview">
              <strong className="score">{analysis.score}/5</strong>
              <span className="rating">{analysis.rating}</span>
            </div>
            <p className="summary">{analysis.summary}</p>

            <div className="category-list">
              {analysis.categories.map((c) => (
                <div key={c.key} className="category">
                  <div className="cat-head">
                    <h3>{c.meta.title}</h3>
                    <div className="cat-controls">
                      <div
                        role="button"
                        tabIndex={0}
                        className="details-button"
                        onClick={() => toggleCategory(c.key)}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                        onMouseUp={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleCategory(c.key)
                          }
                        }}
                        aria-pressed={expandedCategories[c.key] || false}
                      >
                        {expandedCategories[c.key] ? 'Hide' : 'Details'}
                      </div>
                      <span className="cat-score">{c.score}</span>
                    </div>
                  </div>

                  <div className="cat-nearest">
                    {c.matches && c.matches.length > 0 ? (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${c.nearest.latitude},${c.nearest.longitude}`} target="_blank" rel="noreferrer">
                        {c.nearest.name}
                      </a>
                    ) : (
                      <span>{c.nearest.name}</span>
                    )}{' '}
                    — {formatMiles(c.nearest.distanceMiles)}
                  </div>

                  {expandedCategories[c.key] ? (
                    c.matches && c.matches.length > 0 ? (
                      <ul className="match-list">
                        {c.matches.map((m, idx) => (
                          <li key={idx} className="match-item">
                            <a href={`https://www.google.com/maps/search/?api=1&query=${m.latitude},${m.longitude}`} target="_blank" rel="noreferrer">
                              {m.name}
                            </a>
                            <span className="muted"> — {formatMiles(m.distanceMiles)}{m.types && m.types.length ? ` • ${m.types.slice(0, 2).join(', ')}` : ''}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="no-results">No nearby results found.</div>
                    )
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty">Enter an address above and press Analyze.</div>
        )}
      </div>
    </main>
  )
}

export default App
