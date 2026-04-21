import Fastify from 'fastify'
import cors from 'fastify-cors'
import LRU from 'lru-cache'
import fetch from 'node-fetch'

const server = Fastify({ logger: true })

server.register(cors, {
  origin: (origin, cb) => {
    // Allow requests from local dev and the frontend; adjust as needed
    if (!origin || origin.includes('localhost') || origin.includes('render')) {
      cb(null, true)
      return
    }
    cb(null, false)
  }
})

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
