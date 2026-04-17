import { recordMetricEvent } from './metrics-store.js'

const ALLOWED_EVENTS = new Set([
  'site_view',
  'share_generated',
  'share_visited',
  'share_redirect_hit',
  'game_started',
])

function baseHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
  }
}

async function parseBody(request) {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return request.json()
  }

  const text = await request.text()
  if (!text) {
    return {}
  }

  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('', {
      status: 204,
      headers: baseHeaders(),
    })
  }

  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Method not allowed.',
      }),
      {
        status: 405,
        headers: baseHeaders(),
      },
    )
  }

  const payload = await parseBody(request)
  const eventType = String(payload?.eventType ?? payload?.event ?? '').trim().toLowerCase()
  const category =
    typeof payload?.category === 'string' ? payload.category.trim().toLowerCase() : null

  if (!ALLOWED_EVENTS.has(eventType)) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Unknown event type.',
      }),
      {
        status: 400,
        headers: baseHeaders(),
      },
    )
  }

  try {
    const snapshot = await recordMetricEvent({
      eventType,
      category,
      headers: request.headers,
    })

    return new Response(
      JSON.stringify({
        ok: true,
        snapshot,
      }),
      {
        status: 200,
        headers: baseHeaders(),
      },
    )
  } catch {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Could not record event.',
      }),
      {
        status: 500,
        headers: baseHeaders(),
      },
    )
  }
}
