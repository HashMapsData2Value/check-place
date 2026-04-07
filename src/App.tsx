import { type FormEvent, useState } from 'react'
import './App.css'
import './ui.css'
import type {
  CategoryKey,
  Landmark,
  CategoryMeta,
  Match,
  CategoryResult,
  AnalysisResult,
} from './types'
import { haversineMiles, formatMiles } from './utils/geo'
import { geocodeAddress, fetchNearbyPlaces } from './api/places'
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? ''

const CATEGORY_META: Record<CategoryKey, CategoryMeta> = {
  campus: {
    title: 'University shuttle access',
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
    title: 'Big supermarkets',
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

const EXAMPLE_ADDRESS = '7313 Baltimore Ave, College Park, MD 20740'

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

function scoreDistance(distanceMiles: number) {
  if (distanceMiles <= 0.5) {
    return 100
  }

  if (distanceMiles <= 1.5) {
    return 88
  }

  if (distanceMiles <= 3) {
    return 74
  }

  if (distanceMiles <= 6) {
    return 58
  }

  if (distanceMiles <= 10) {
    return 42
  }

  return 24
}

function getRating(score: number) {
  if (score >= 85) {
    return 'Excellent'
  }

  if (score >= 70) {
    return 'Strong'
  }

  if (score >= 55) {
    return 'Balanced'
  }

  if (score >= 40) {
    return 'Limited'
  }

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

async function analyzeLocation(formattedAddress: string, lat: number, lng: number): Promise<AnalysisResult> {
  const categories: CategoryResult[] = []

  for (const key of Object.keys(CATEGORY_META) as CategoryKey[]) {
    const meta = CATEGORY_META[key]

    if (key === 'campus') {
      const matches = LANDMARKS.filter((l) => l.category === key)
        .map((landmark) => {
          const distanceMiles = haversineMiles(lat, lng, landmark.latitude, landmark.longitude)
          return {
            ...landmark,
            distanceMiles,
            accessLabel: getAccessLabel(distanceMiles),
          }
        })
        .sort((a, b) => a.distanceMiles - b.distanceMiles)

      const nearest = matches[0] ?? {
        name: 'No campus landmark',
        category: key,
        latitude: lat,
        longitude: lng,
        area: '',
        description: '',
        distanceMiles: 999,
        accessLabel: getAccessLabel(999),
      }

      const score = scoreDistance((nearest as Match).distanceMiles)

      categories.push({
        key,
        meta,
        score,
        rating: getRating(score),
        nearest: nearest as Match,
        matches: matches.slice(0, 3) as Match[],
      })
      continue
    }

    // try Places API for other categories
    try {
      const placeType = PLACE_TYPE_BY_CATEGORY[key]
      const places = await fetchNearbyPlaces(lat, lng, placeType)
      console.debug('analyzeLocation places for', key, { count: places.length, sample: places.slice(0, 3).map(p => p.name) })

      const matches: Match[] = places.slice(0, 6).map((p) => {
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

      // prefer matches that clearly indicate subway/train/rail over generic transit stops
      if (matches.length > 0 && key === 'transit') {
        const preferredTypes = new Set(['subway_station', 'train_station', 'railway_station', 'transit_station'])
        const preferred = matches.find((m) => (m.types ?? []).some((t) => preferredTypes.has(t)) || /metro|mta|marc|station/.test(m.name.toLowerCase()))
        if (preferred) {
          // move preferred to front
          matches.sort((a, b) => (a === preferred ? -1 : b === preferred ? 1 : a.distanceMiles - b.distanceMiles))
        }
      }

      if (matches.length === 0) {
        const nearest = {
          name: `No ${meta.title} found`,
          category: key,
          latitude: lat,
          longitude: lng,
          area: '',
          description: '',
          distanceMiles: 999,
          accessLabel: getAccessLabel(999),
          types: [],
        } as Match

        const score = scoreDistance(nearest.distanceMiles)

        categories.push({
          key,
          meta,
          score,
          rating: getRating(score),
          nearest,
          matches: [],
        })
      } else {
        const nearest = matches[0]
        const score = scoreDistance(nearest.distanceMiles)

        categories.push({
          key,
          meta,
          score,
          rating: getRating(score),
          nearest,
          matches: matches.slice(0, 3),
        })
      }
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

      const score = scoreDistance(nearest.distanceMiles)

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
  const score = Math.round(weightedScore)
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
  const [address, setAddress] = useState(EXAMPLE_ADDRESS)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Record<CategoryKey, boolean>>({} as Record<CategoryKey, boolean>)

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

    if (!GOOGLE_API_KEY) {
      setErrorMessage('Add VITE_GOOGLE_MAPS_API_KEY in your local environment first.')
      setAnalysis(null)
      return
    }

    setIsLoading(true)
    setErrorMessage('')

    try {
      const result = await geocodeAddress(nextAddress)
      const lat = result.geometry.location.lat
      const lng = result.geometry.location.lng
      console.log('Geocoded coordinates:', lat, lng)

      const nextAnalysis = await analyzeLocation(result.formatted_address, lat, lng)
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

      <div className="results-area">
        {errorMessage ? <div className="error">{errorMessage}</div> : null}

        {analysis ? (
          <div className="results">
            <h2 className="address">{analysis.formattedAddress}</h2>
            <div className="overview">
              <strong className="score">{analysis.score}/100</strong>
              <span className="rating">{analysis.rating}</span>
            </div>
            <p className="summary">{analysis.summary}</p>

            <div className="category-list">
              {analysis.categories.map((c) => (
                <div key={c.key} className="category">
                  <div className="cat-head">
                    <h3>{c.meta.title}</h3>
                    <div className="cat-controls">
                      <button type="button" className="details-button" onClick={() => toggleCategory(c.key)}>
                        {expandedCategories[c.key] ? 'Hide' : 'Details'}
                      </button>
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
