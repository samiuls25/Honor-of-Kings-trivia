import fs from 'node:fs/promises'

const CHANNEL_PLAYLISTS_URL = 'https://www.youtube.com/@HonorofKingsAudioTeam/playlists'
const DEFAULT_OUTPUT = 'data/raw/hok-ost-source.json'
const SOUNDTRACK_TOKEN = 'honor of kings original game soundtrack'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135 Safari/537.36',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

function extractBalancedJson(text, startMarker) {
  const markerIndex = text.indexOf(startMarker)
  if (markerIndex === -1) {
    return null
  }

  const jsonStart = text.indexOf('{', markerIndex + startMarker.length)
  if (jsonStart === -1) {
    return null
  }

  let inString = false
  let escaped = false
  let depth = 0

  for (let index = jsonStart; index < text.length; index += 1) {
    const char = text[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') {
      depth += 1
      continue
    }

    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return text.slice(jsonStart, index + 1)
      }
    }
  }

  return null
}

function textFromRuns(value) {
  if (!value || typeof value !== 'object') {
    return ''
  }

  if (typeof value.simpleText === 'string') {
    return value.simpleText.trim()
  }

  if (Array.isArray(value.runs)) {
    return value.runs
      .map((run) => String(run?.text || ''))
      .join('')
      .trim()
  }

  return ''
}

function isWantedOstTitle(title) {
  return String(title || '').toLowerCase().includes(SOUNDTRACK_TOKEN)
}

function stripQuery(urlValue) {
  try {
    const parsed = new URL(String(urlValue || ''))
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return String(urlValue || '').split('?')[0]
  }
}

async function imageExists(urlValue) {
  try {
    const response = await fetch(urlValue, {
      method: 'HEAD',
      headers: {
        accept: 'image/*,*/*',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135 Safari/537.36',
      },
    })

    if (!response.ok) {
      return false
    }

    const type = String(response.headers.get('content-type') || '')
    return type.includes('image')
  } catch {
    return false
  }
}

async function resolveBestThumbnail(videoId, fallbackUrl) {
  const cleanFallback = stripQuery(fallbackUrl)
  const candidates = [
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    cleanFallback,
  ]

  for (const candidate of candidates) {
    if (!candidate) {
      continue
    }

    if (await imageExists(candidate)) {
      return candidate
    }
  }

  return cleanFallback
}

function pickThumbnail(value) {
  const thumbnails =
    value?.thumbnail?.thumbnails ||
    value?.thumbnails ||
    value?.thumbnailRenderer?.showCustomThumbnailRenderer?.thumbnail?.thumbnails ||
    []

  if (!Array.isArray(thumbnails) || thumbnails.length === 0) {
    return ''
  }

  const sorted = [...thumbnails].sort((left, right) => {
    const leftArea = Number(left?.width || 0) * Number(left?.height || 0)
    const rightArea = Number(right?.width || 0) * Number(right?.height || 0)
    return rightArea - leftArea
  })

  return typeof sorted[0]?.url === 'string' ? sorted[0].url : ''
}

function collectPlaylistEntries(node, entries) {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectPlaylistEntries(item, entries)
    }
    return
  }

  if (!node || typeof node !== 'object') {
    return
  }

  const candidatePlaylistId =
    typeof node.playlistId === 'string'
      ? node.playlistId
      : typeof node.playlistEndpoint?.watchEndpoint?.playlistId === 'string'
        ? node.playlistEndpoint.watchEndpoint.playlistId
        : ''

  if (candidatePlaylistId) {
    const title =
      textFromRuns(node.title) ||
      textFromRuns(node.playlistTitle) ||
      textFromRuns(node.longBylineText) ||
      textFromRuns(node.shortBylineText)

    const videoCountText =
      textFromRuns(node.videoCountText) || textFromRuns(node.thumbnailText)

    entries.push({
      playlistId: candidatePlaylistId,
      title: title || `Playlist ${candidatePlaylistId}`,
      videoCountText,
    })
  }

  for (const value of Object.values(node)) {
    collectPlaylistEntries(value, entries)
  }
}

function collectVideoEntries(node, entries) {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectVideoEntries(item, entries)
    }
    return
  }

  if (!node || typeof node !== 'object') {
    return
  }

  const videoId = typeof node.videoId === 'string' ? node.videoId : ''
  if (videoId) {
    const title = textFromRuns(node.title)
    const author =
      textFromRuns(node.shortBylineText) ||
      textFromRuns(node.longBylineText) ||
      textFromRuns(node.ownerText)

    const imageUrl = pickThumbnail(node)

    if (
      title &&
      imageUrl &&
      !title.toLowerCase().includes('deleted video') &&
      isWantedOstTitle(title)
    ) {
      entries.push({
        videoId,
        title,
        author: author || 'Honor of Kings Audio Team',
        imageUrl,
      })
    }
  }

  for (const value of Object.values(node)) {
    collectVideoEntries(value, entries)
  }
}

async function extractYtInitialData(url) {
  const html = await fetchText(url)
  const jsonText =
    extractBalancedJson(html, 'var ytInitialData = ') ||
    extractBalancedJson(html, 'window["ytInitialData"] = ') ||
    extractBalancedJson(html, 'ytInitialData = ')

  if (!jsonText) {
    throw new Error(`Could not parse ytInitialData from ${url}`)
  }

  return JSON.parse(jsonText)
}

async function discoverPlaylists() {
  const initialData = await extractYtInitialData(CHANNEL_PLAYLISTS_URL)
  const entries = []
  collectPlaylistEntries(initialData, entries)

  const deduped = new Map()
  for (const entry of entries) {
    if (!entry.playlistId) {
      continue
    }
    if (!deduped.has(entry.playlistId)) {
      deduped.set(entry.playlistId, entry)
    }
  }

  return [...deduped.values()]
}

async function fetchVideosForPlaylist(playlistId) {
  const url = `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`
  const initialData = await extractYtInitialData(url)
  const videos = []
  collectVideoEntries(initialData, videos)

  const deduped = new Map()
  for (const video of videos) {
    if (!deduped.has(video.videoId)) {
      deduped.set(video.videoId, video)
    }
  }

  return [...deduped.values()]
}

async function main() {
  const outputPath = process.argv[2] || DEFAULT_OUTPUT
  const playlists = await discoverPlaylists()

  if (playlists.length === 0) {
    throw new Error('No playlists discovered on the Honor of Kings Audio Team page.')
  }

  const tracksByVideoId = new Map()
  const resolvedThumbnailByVideoId = new Map()

  for (const playlist of playlists) {
    const videos = await fetchVideosForPlaylist(playlist.playlistId)
    for (const video of videos) {
      if (!resolvedThumbnailByVideoId.has(video.videoId)) {
        const bestThumbnail = await resolveBestThumbnail(video.videoId, video.imageUrl)
        resolvedThumbnailByVideoId.set(video.videoId, bestThumbnail)
      }

      if (!tracksByVideoId.has(video.videoId)) {
        tracksByVideoId.set(video.videoId, {
          trackTitle: video.title,
          artistName: video.author,
          videoId: video.videoId,
          imageUrl: resolvedThumbnailByVideoId.get(video.videoId) || video.imageUrl,
          source: `youtube:${video.videoId}`,
        })
      }
    }

    await sleep(120)
  }

  const tracks = [...tracksByVideoId.values()].sort((left, right) =>
    left.trackTitle.localeCompare(right.trackTitle),
  )

  const payload = {
    source: 'youtube-playlist-html-scrape',
    fetchedAt: new Date().toISOString(),
    channel: {
      handleUrl: CHANNEL_PLAYLISTS_URL,
    },
    playlists,
    tracks,
  }

  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  console.log(`Fetched ${tracks.length} unique tracks across ${playlists.length} playlists.`)
  console.log(`Wrote ${outputPath}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
