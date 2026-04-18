import { createHmac, timingSafeEqual } from 'node:crypto'

const CHALLENGE_SIGNATURE_FIELDS = [
  'challenge',
  'target',
  'source',
  'answer',
  'scoring',
  'score',
  'correct',
  'wrong',
  'best',
]

function getSecret() {
  return process.env.CHALLENGE_SIGNATURE_SECRET || 'hok-share-default-secret-v1'
}

export function buildChallengePayloadFromParams(params) {
  return CHALLENGE_SIGNATURE_FIELDS.map((field) => `${field}=${params.get(field) || ''}`).join('&')
}

export function signChallengePayload(payload) {
  return createHmac('sha256', getSecret()).update(payload).digest('hex')
}

export function signChallengeFromParams(params) {
  return signChallengePayload(buildChallengePayloadFromParams(params))
}

export function isChallengeSignatureValid(params, providedSignature) {
  if (!providedSignature || typeof providedSignature !== 'string') {
    return false
  }

  const expected = signChallengeFromParams(params)
  const received = providedSignature.trim().toLowerCase()

  if (!/^[a-f0-9]{64}$/i.test(received) || expected.length !== received.length) {
    return false
  }

  try {
    return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(received, 'utf8'))
  } catch {
    return false
  }
}
