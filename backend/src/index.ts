import Fastify from 'fastify'
import cors from '@fastify/cors'
import LRU from 'lru-cache'
import * as dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

const server = Fastify({ logger: true })

server.register(cors, {
  origin: (origin: string | undefined, cb: (err: Error | null, allow?: any) => void) => {
    // Allow requests from local dev and the frontend; adjust as needed
    if (!origin) {
      // no origin (server-to-server) — allow
      cb(null, true as any)
      return
    }
    if (origin.includes('localhost') || origin.includes('render')) {
      // echo origin to allow it (matches expected type)
      cb(null, origin)
      return
    }
    // disallow by returning undefined
    cb(null, false as any)
  }
})

// Load .env.local from a few common locations if present
try {
  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), 'backend', '.env.local'),
    path.resolve(__dirname, '..', '.env.local'),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p })
      server.log.info(`Loaded env from ${p}`)
      break
    }
  }
} catch (err) {
  server.log.warn('Failed to load .env.local: %s', String(err))
}

type CacheVal = any
const cache = new LRU<string, CacheVal>({ max: 500, ttl: 1000 * 60 * 5 })

function isZillowInput(q: string) {
  return q.includes('www.zillow.com') || q.includes('zillow.com')
}

async function callGoogleMaps(address: string) {
  const key = process.env.GOOGLE_API_KEY
  if (!key) throw new Error('GOOGLE_API_KEY not set')

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
  const res = await fetch(url)
  return res.json()
}

async function callPlacesNearby(lat: string | number, lng: string | number, type: string) {
  const key = process.env.GOOGLE_API_KEY
  if (!key) throw new Error('GOOGLE_API_KEY not set')

  const loc = `${lat},${lng}`
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${encodeURIComponent(loc)}&rankby=distance&type=${encodeURIComponent(
    type,
  )}&key=${key}`

  const res = await fetch(url)
  return res.json()
}

async function callHasDataProperty(urlStr: string) {
  const key = process.env.HASDATA_API_KEY
  if (!key) throw new Error('HASDATA_API_KEY not set')

  const encoded = encodeURIComponent(urlStr)
  const url = `https://api.hasdata.com/scrape/zillow/property?url=${encoded}`

  const res = await fetch(url, { headers: { 'Content-Type': 'application/json', 'x-api-key': key } })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HasData API error: ${res.status} ${res.statusText} ${text}`)
  }

  return res.json()
}

server.get('/api/search', async (request, reply) => {
  const q = (request.query as any).q || ''
  if (!q) return reply.status(400).send({ error: 'missing q' })

  const cacheKey = `search:${q}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  try {
    if (isZillowInput(q)) {
      // Very small example: extract last path segment as address fallback
      const url = new URL(q)
      const segments = url.pathname.split('/').filter(Boolean)
      const maybeAddress = segments.slice(-1)[0] || q
      const result = { source: 'zillow', input: q, parsed: maybeAddress }
      cache.set(cacheKey, result)
      return result
    }

    const gm = await callGoogleMaps(q)
    // perform lightweight computation or pass-through
    const out = { source: 'google', raw: gm }
    cache.set(cacheKey, out)
    return out
  } catch (err: any) {
    request.log.error(err)
    return reply.status(500).send({ error: err.message || 'server error' })
  }
})

server.get('/api/nearby', async (request, reply) => {
  const qp = request.query as any
  const lat = qp.lat
  const lng = qp.lng
  let type = qp.type

  if (!lat || !lng) return reply.status(400).send({ error: 'missing lat/lng' })
  if (!type) return reply.status(400).send({ error: 'missing type' })

  // allow comma-separated types
  const types = Array.isArray(type) ? type : String(type).split(',').map((s) => s.trim()).filter(Boolean)

  // try each type until results found
  for (const t of types) {
    const cacheKey = `nearby:${lat}:${lng}:${t}`
    const cached = cache.get(cacheKey)
    if (cached) return cached

    try {
      const payload = await callPlacesNearby(lat, lng, t)
      if (payload && payload.results && payload.results.length) {
        const mapped = payload.results.map((r: any) => ({
          name: r.name ?? r.formatted_address ?? '',
          geometry: { location: { lat: r.geometry?.location?.lat ?? r.geometry?.location?.lat, lng: r.geometry?.location?.lng ?? r.geometry?.location?.lng } },
          vicinity: r.vicinity ?? r.formatted_address ?? '',
          place_id: r.place_id ?? undefined,
          types: r.types ?? [],
        }))
        const out = { source: 'google_places', type: t, results: mapped }
        cache.set(cacheKey, out)
        return out
      }
    } catch (err: any) {
      request.log.error(err)
    }
  }

  return reply.send({ source: 'google_places', results: [] })
})

server.get('/api/hasdata', async (request, reply) => {
  const qp = request.query as any
  const url = qp.url
  if (!url) return reply.status(400).send({ error: 'missing url' })

  try {
    const payload = await callHasDataProperty(url)
    return reply.send(payload)
  } catch (err: any) {
    request.log.error(err)
    return reply.status(500).send({ error: err.message || 'hasdata proxy error' })
  }
})

const PORT = Number(process.env.PORT || 3001)

const start = async () => {
  try {
    await server.listen({ port: PORT, host: '0.0.0.0' })
    console.log(`server listening on ${PORT}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
