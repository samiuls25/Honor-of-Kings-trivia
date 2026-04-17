import { createHash } from 'node:crypto'
import { getStore } from '@netlify/blobs'

const STORE_NAME = 'hok-trivia-metrics'
const COUNTERS_KEY = 'counters-v1'
const VISITOR_PREFIX = 'visitor-v1/'

const DEFAULT_COUNTERS = Object.freeze({
  site_views: 0,
  unique_site_visitors: 0,
  share_links_generated: 0,
  share_links_generated_challenge: 0,
  share_links_generated_gallery: 0,
  share_links_generated_ost: 0,
  share_links_visited: 0,
  share_links_visited_challenge: 0,
  share_links_visited_gallery: 0,
  share_links_visited_ost: 0,
  share_redirect_hits: 0,
  games_played: 0,
  games_played_standard: 0,
  games_played_ost: 0,
  updated_at: null,
})

const SHARE_CATEGORIES = new Set(['challenge', 'gallery', 'ost'])
const GAME_CATEGORIES = new Set(['standard', 'ost'])

function toNonNegativeInt(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }

  return parsed
}

function normalizeCounters(input) {
  return {
    site_views: toNonNegativeInt(input?.site_views),
    unique_site_visitors: toNonNegativeInt(input?.unique_site_visitors),
    share_links_generated: toNonNegativeInt(input?.share_links_generated),
    share_links_generated_challenge: toNonNegativeInt(input?.share_links_generated_challenge),
    share_links_generated_gallery: toNonNegativeInt(input?.share_links_generated_gallery),
    share_links_generated_ost: toNonNegativeInt(input?.share_links_generated_ost),
    share_links_visited: toNonNegativeInt(input?.share_links_visited),
    share_links_visited_challenge: toNonNegativeInt(input?.share_links_visited_challenge),
    share_links_visited_gallery: toNonNegativeInt(input?.share_links_visited_gallery),
    share_links_visited_ost: toNonNegativeInt(input?.share_links_visited_ost),
    share_redirect_hits: toNonNegativeInt(input?.share_redirect_hits),
    games_played: toNonNegativeInt(input?.games_played),
    games_played_standard: toNonNegativeInt(input?.games_played_standard),
    games_played_ost: toNonNegativeInt(input?.games_played_ost),
    updated_at: typeof input?.updated_at === 'string' ? input.updated_at : null,
  }
}

async function readCounters(store) {
  const serialized = await store.get(COUNTERS_KEY)
  if (!serialized) {
    return { ...DEFAULT_COUNTERS }
  }

  try {
    const parsed = JSON.parse(serialized)
    return normalizeCounters(parsed)
  } catch {
    return { ...DEFAULT_COUNTERS }
  }
}

async function writeCounters(store, counters) {
  const payload = {
    ...normalizeCounters(counters),
    updated_at: new Date().toISOString(),
  }

  await store.set(COUNTERS_KEY, JSON.stringify(payload))
  return payload
}

function toShareCategory(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return SHARE_CATEGORIES.has(normalized) ? normalized : null
}

function toGameCategory(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return GAME_CATEGORIES.has(normalized) ? normalized : null
}

function buildVisitorFingerprint(headers) {
  const ip =
    headers.get('x-nf-client-connection-ip') ||
    headers.get('x-forwarded-for') ||
    headers.get('client-ip') ||
    ''
  const userAgent = headers.get('user-agent') || ''

  if (!ip && !userAgent) {
    return null
  }

  return createHash('sha256')
    .update(`${ip}|${userAgent}`)
    .digest('hex')
    .slice(0, 32)
}

async function markUniqueVisitor(store, fingerprint) {
  if (!fingerprint) {
    return false
  }

  const key = `${VISITOR_PREFIX}${fingerprint}`
  const existing = await store.get(key)
  if (existing) {
    return false
  }

  await store.set(key, '1')
  return true
}

export async function getMetricsSnapshot() {
  const store = getStore(STORE_NAME)
  const counters = await readCounters(store)
  return normalizeCounters(counters)
}

export async function recordMetricEvent({ eventType, category = null, headers }) {
  const store = getStore(STORE_NAME)
  const counters = await readCounters(store)

  if (eventType === 'site_view') {
    counters.site_views += 1
    const fingerprint = buildVisitorFingerprint(headers)
    const isUnique = await markUniqueVisitor(store, fingerprint)
    if (isUnique) {
      counters.unique_site_visitors += 1
    }
  }

  if (eventType === 'share_generated') {
    counters.share_links_generated += 1
    const shareCategory = toShareCategory(category)
    if (shareCategory === 'challenge') {
      counters.share_links_generated_challenge += 1
    }
    if (shareCategory === 'gallery') {
      counters.share_links_generated_gallery += 1
    }
    if (shareCategory === 'ost') {
      counters.share_links_generated_ost += 1
    }
  }

  if (eventType === 'share_visited') {
    counters.share_links_visited += 1
    const shareCategory = toShareCategory(category)
    if (shareCategory === 'challenge') {
      counters.share_links_visited_challenge += 1
    }
    if (shareCategory === 'gallery') {
      counters.share_links_visited_gallery += 1
    }
    if (shareCategory === 'ost') {
      counters.share_links_visited_ost += 1
    }
  }

  if (eventType === 'share_redirect_hit') {
    counters.share_redirect_hits += 1
  }

  if (eventType === 'game_started') {
    counters.games_played += 1
    const gameCategory = toGameCategory(category)
    if (gameCategory === 'ost') {
      counters.games_played_ost += 1
    } else {
      counters.games_played_standard += 1
    }
  }

  const updated = await writeCounters(store, counters)
  return normalizeCounters(updated)
}
