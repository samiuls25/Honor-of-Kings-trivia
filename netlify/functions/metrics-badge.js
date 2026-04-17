import { getMetricsSnapshot } from './metrics-store.js'

const METRIC_CONFIG = {
  site_views: { label: 'site views', color: '3e8ed0' },
  unique_site_visitors: { label: 'unique visitors', color: '1f9d7a' },
  share_links_generated: { label: 'share links generated', color: '158f8f' },
  share_links_visited: { label: 'share links visited', color: '0d7c66' },
  share_redirect_hits: { label: 'share redirects', color: '17658c' },
  games_played: { label: 'games played', color: '8b6ad1' },
  games_played_standard: { label: 'normal games', color: '5f8f2f' },
  games_played_ost: { label: 'ost games', color: '9464c9' },
}

function formatCount(value) {
  const safe = Number.isFinite(value) && value >= 0 ? value : 0
  if (safe >= 1_000_000) {
    return `${(safe / 1_000_000).toFixed(1)}M`
  }

  if (safe >= 1_000) {
    return `${(safe / 1_000).toFixed(1)}k`
  }

  return String(Math.floor(safe))
}

function endpointHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=120, s-maxage=300',
  }
}

export default async (request) => {
  const url = new URL(request.url)
  const metricKey = String(url.searchParams.get('metric') || '').trim()
  const metric = METRIC_CONFIG[metricKey]

  if (!metric) {
    return new Response(
      JSON.stringify({
        schemaVersion: 1,
        label: 'metrics',
        message: 'unknown metric',
        color: '9f4d4d',
      }),
      {
        status: 400,
        headers: endpointHeaders(),
      },
    )
  }

  let snapshot
  try {
    snapshot = await getMetricsSnapshot()
  } catch {
    snapshot = {
      [metricKey]: 0,
    }
  }

  const value = Number(snapshot?.[metricKey] ?? 0)

  return new Response(
    JSON.stringify({
      schemaVersion: 1,
      label: metric.label,
      message: formatCount(value),
      color: metric.color,
      cacheSeconds: 300,
    }),
    {
      status: 200,
      headers: endpointHeaders(),
    },
  )
}
