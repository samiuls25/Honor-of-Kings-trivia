import { isChallengeSignatureValid } from './challenge-signature.js'

function headers() {
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
      headers: headers(),
    })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, valid: false }), {
      status: 405,
      headers: headers(),
    })
  }

  const payload = await parseBody(request)
  const params = new URLSearchParams()
  params.set('challenge', String(payload?.challenge ?? '1'))
  params.set('target', String(payload?.target ?? ''))
  params.set('source', String(payload?.source ?? ''))
  params.set('answer', String(payload?.answer ?? ''))
  params.set('scoring', String(payload?.scoring ?? ''))
  params.set('score', String(payload?.score ?? ''))
  params.set('correct', String(payload?.correct ?? ''))
  params.set('wrong', String(payload?.wrong ?? ''))
  params.set('best', String(payload?.best ?? ''))

  const valid = isChallengeSignatureValid(params, String(payload?.sig ?? ''))

  return new Response(
    JSON.stringify({
      ok: true,
      valid,
    }),
    {
      status: 200,
      headers: headers(),
    },
  )
}
