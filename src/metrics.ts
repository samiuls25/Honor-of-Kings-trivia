export type ShareMetricCategory = 'challenge' | 'gallery' | 'ost'
export type GameMetricCategory = 'standard' | 'ost'

export type MetricEventType =
  | 'site_view'
  | 'share_generated'
  | 'share_visited'
  | 'game_started'

export interface MetricsSnapshot {
  site_views: number
  unique_site_visitors: number
  share_links_generated: number
  share_links_generated_challenge: number
  share_links_generated_gallery: number
  share_links_generated_ost: number
  share_links_visited: number
  share_links_visited_challenge: number
  share_links_visited_gallery: number
  share_links_visited_ost: number
  share_redirect_hits: number
  games_played: number
  games_played_standard: number
  games_played_ost: number
  updated_at: string | null
}

const METRICS_EVENT_PATH = '/metrics/event'
const METRICS_SUMMARY_PATH = '/metrics/summary'

const EMPTY_METRICS: MetricsSnapshot = {
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
}

function toCount(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }
  return parsed
}

function normalizeSnapshot(raw: unknown): MetricsSnapshot {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_METRICS }
  }

  const data = raw as Record<string, unknown>

  return {
    site_views: toCount(data.site_views),
    unique_site_visitors: toCount(data.unique_site_visitors),
    share_links_generated: toCount(data.share_links_generated),
    share_links_generated_challenge: toCount(data.share_links_generated_challenge),
    share_links_generated_gallery: toCount(data.share_links_generated_gallery),
    share_links_generated_ost: toCount(data.share_links_generated_ost),
    share_links_visited: toCount(data.share_links_visited),
    share_links_visited_challenge: toCount(data.share_links_visited_challenge),
    share_links_visited_gallery: toCount(data.share_links_visited_gallery),
    share_links_visited_ost: toCount(data.share_links_visited_ost),
    share_redirect_hits: toCount(data.share_redirect_hits),
    games_played: toCount(data.games_played),
    games_played_standard: toCount(data.games_played_standard),
    games_played_ost: toCount(data.games_played_ost),
    updated_at: typeof data.updated_at === 'string' ? data.updated_at : null,
  }
}

export function detectSharedVisitCategory(params: URLSearchParams): ShareMetricCategory | null {
  const view = params.get('view')
  if (params.get('challenge') === '1') {
    return 'challenge'
  }

  if (view === 'gallery' && params.has('skin')) {
    return 'gallery'
  }

  if (view === 'ost-hall' && params.has('track')) {
    return 'ost'
  }

  return null
}

export function formatCompactCount(value: number): string {
  const safe = Number.isFinite(value) && value >= 0 ? value : 0
  if (safe < 1000) {
    return String(Math.floor(safe))
  }

  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(safe)
}

export function trackMetricEvent(
  eventType: MetricEventType,
  category?: ShareMetricCategory | GameMetricCategory,
) {
  if (typeof window === 'undefined') {
    return
  }

  const body = JSON.stringify({
    eventType,
    ...(category ? { category } : {}),
  })

  if (navigator.sendBeacon) {
    const payload = new Blob([body], { type: 'application/json' })
    const sent = navigator.sendBeacon(METRICS_EVENT_PATH, payload)
    if (sent) {
      return
    }
  }

  void fetch(METRICS_EVENT_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
    keepalive: true,
  }).catch(() => {
    // No-op: metrics should never break gameplay.
  })
}

export async function fetchMetricsSummary(): Promise<MetricsSnapshot | null> {
  try {
    const response = await fetch(METRICS_SUMMARY_PATH, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    const payload = await response.json()
    return normalizeSnapshot(payload)
  } catch {
    return null
  }
}
