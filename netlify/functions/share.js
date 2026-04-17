const APP_NAME = 'Honor of Kings Trivia'
const DEFAULT_DESCRIPTION =
  'Guess heroes, skins, and OST tracks. Can you beat this challenge?'

const TARGET_LABELS = {
  'hero-name': 'Guess Hero Name',
  'skin-name': 'Guess Skin Name',
  'ost-title': 'Guess OST Track',
}

const SOURCE_LABELS = {
  official: 'Official Capture',
  'qing-en': 'Qing API (Translated)',
  hybrid: 'Hybrid Backfill',
}

const ANSWER_LABELS = {
  typed: 'Typed Entry',
  'multiple-choice': 'Multiple Choice',
}

const SCORING_LABELS = {
  'five-minute-easy': '5 Minute Easy',
  'five-minute-hard': '5 Minute Hard',
  'sudden-death': 'Sudden Death',
}

function cleanText(input, maxLength = 120) {
  if (!input) {
    return ''
  }

  return String(input)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function clampInt(input, max = 9999) {
  const parsed = Number.parseInt(String(input ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }
  return Math.min(parsed, max)
}

function escapeHtml(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
}

function buildChallengeMetadata(url) {
  const score = clampInt(url.searchParams.get('score'))
  const correct = clampInt(url.searchParams.get('correct'))
  const wrong = clampInt(url.searchParams.get('wrong'))
  const best = clampInt(url.searchParams.get('best'))
  const target = TARGET_LABELS[url.searchParams.get('target')] || 'Custom Mode'
  const answer = ANSWER_LABELS[url.searchParams.get('answer')] || 'Unknown Answer Mode'
  const scoring = SCORING_LABELS[url.searchParams.get('scoring')] || 'Unknown Scoring'
  const source = SOURCE_LABELS[url.searchParams.get('source')] || null

  const modeParts = [target, source, answer, scoring].filter(Boolean)

  return {
    title: `Challenge Score ${score} | ${APP_NAME}`,
    description:
      `I scored ${score} (${correct} correct, ${wrong} wrong, best streak ${best}). ` +
      `Mode: ${modeParts.join(' | ')}. Try this challenge.`,
  }
}

function buildGalleryMetadata(url) {
  const skinName = cleanText(url.searchParams.get('skinName'), 80)
  const heroName = cleanText(url.searchParams.get('heroName'), 80)

  if (skinName && heroName) {
    return {
      title: `${skinName} | ${APP_NAME}`,
      description: `${skinName} for ${heroName}. Open this link to jump directly to the gallery card.`,
    }
  }

  return {
    title: `Gallery Card | ${APP_NAME}`,
    description: 'Open this link to jump directly to the selected gallery card.',
  }
}

function buildOstMetadata(url) {
  const trackTitle = cleanText(url.searchParams.get('trackTitle'), 100)
  const artistName = cleanText(url.searchParams.get('artistName'), 80)

  if (trackTitle && artistName) {
    return {
      title: `${trackTitle} | ${APP_NAME}`,
      description: `Listen to ${trackTitle} by ${artistName} in the Honor of Kings OST Hall.`,
    }
  }

  if (trackTitle) {
    return {
      title: `${trackTitle} | ${APP_NAME}`,
      description: 'Open this link to jump directly to the OST Hall track.',
    }
  }

  return {
    title: `OST Hall Track | ${APP_NAME}`,
    description: 'Open this link to jump directly to the selected OST Hall track.',
  }
}

function getMetadata(url) {
  const view = url.searchParams.get('view')

  if (view === 'gallery') {
    return buildGalleryMetadata(url)
  }

  if (view === 'ost-hall') {
    return buildOstMetadata(url)
  }

  if (url.searchParams.get('challenge') === '1') {
    return buildChallengeMetadata(url)
  }

  return {
    title: APP_NAME,
    description: DEFAULT_DESCRIPTION,
  }
}

function getSafeImage(url) {
  const image = cleanText(url.searchParams.get('image'), 2048)
  if (!image) {
    return `${url.origin}/favicon.svg`
  }

  try {
    const parsed = new URL(image)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return `${url.origin}/favicon.svg`
    }
    return parsed.toString()
  } catch {
    return `${url.origin}/favicon.svg`
  }
}

function buildAppTarget(url) {
  const params = new URLSearchParams(url.searchParams)
  const query = params.toString()
  return query ? `${url.origin}/?${query}` : `${url.origin}/`
}

export default async (request) => {
  const url = new URL(request.url)
  const appTarget = buildAppTarget(url)
  const metadata = getMetadata(url)
  const imageUrl = getSafeImage(url)

  const title = escapeHtml(metadata.title)
  const description = escapeHtml(metadata.description)
  const canonical = escapeHtml(url.toString())
  const target = escapeHtml(appTarget)
  const image = escapeHtml(imageUrl)

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:site_name" content="${APP_NAME}" />
    <meta property="og:image" content="${image}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
    <meta http-equiv="refresh" content="0;url=${target}" />
    <link rel="canonical" href="${canonical}" />
  </head>
  <body>
    <p>Redirecting to ${APP_NAME}...</p>
    <p><a href="${target}">Continue to the app</a></p>
    <script>window.location.replace(${JSON.stringify(appTarget)});</script>
  </body>
</html>`

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  })
}
