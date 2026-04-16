import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_SOURCE = 'data/raw/hok-ost-source.json'

function toSlug(value) {
  return String(value)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 96)
}

function toCleanString(value) {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return ''
}

function parseAliases(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(/[|,;/]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

function imageFromThumbnail(thumbnails) {
  if (!thumbnails || typeof thumbnails !== 'object') {
    return ''
  }

  const picks = [
    thumbnails.maxres?.url,
    thumbnails.standard?.url,
    thumbnails.high?.url,
    thumbnails.medium?.url,
    thumbnails.default?.url,
  ]

  return toCleanString(picks.find(Boolean))
}

function toEmbedUrl(rawUrl, videoId) {
  const id = toCleanString(videoId)
  if (id) {
    return `https://www.youtube-nocookie.com/embed/${id}?rel=0`
  }

  const url = toCleanString(rawUrl)
  if (!url) {
    return ''
  }

  try {
    const parsed = new URL(url)

    if (parsed.hostname.includes('youtube.com') && parsed.searchParams.get('v')) {
      return `https://www.youtube-nocookie.com/embed/${parsed.searchParams.get('v')}?rel=0`
    }

    if (parsed.hostname === 'youtu.be') {
      const shortId = parsed.pathname.replace('/', '')
      if (shortId) {
        return `https://www.youtube-nocookie.com/embed/${shortId}?rel=0`
      }
    }

    if (parsed.hostname.includes('youtube.com') && parsed.pathname.includes('/embed/')) {
      return parsed.toString()
    }
  } catch {
    return ''
  }

  return ''
}

function collectTrackObjects(payload) {
  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload?.tracks)) {
    return payload.tracks
  }

  if (Array.isArray(payload?.items)) {
    return payload.items
  }

  if (Array.isArray(payload?.playlist?.items)) {
    return payload.playlist.items
  }

  return []
}

function parseJsonSafe(input) {
  try {
    return JSON.parse(input)
  } catch {
    return null
  }
}

function normalizeTrack(raw, sourceLabel) {
  const snippet = raw?.snippet && typeof raw.snippet === 'object' ? raw.snippet : {}
  const contentDetails =
    raw?.contentDetails && typeof raw.contentDetails === 'object'
      ? raw.contentDetails
      : {}

  const videoId = toCleanString(
    raw.videoId ||
      raw.id?.videoId ||
      contentDetails.videoId ||
      snippet.resourceId?.videoId,
  )

  const trackTitle = toCleanString(
    raw.trackTitle || raw.title || raw.name || snippet.title,
  )

  const artistName = toCleanString(
    raw.artistName ||
      raw.artist ||
      snippet.videoOwnerChannelTitle ||
      snippet.channelTitle ||
      'Honor of Kings Audio Team',
  )

  const imageUrl = toCleanString(
    raw.imageUrl || raw.thumbnail || imageFromThumbnail(snippet.thumbnails),
  )

  const audioUrl = toEmbedUrl(raw.audioUrl || raw.embedUrl || raw.url || raw.watchUrl, videoId)

  if (!trackTitle || !imageUrl || !audioUrl) {
    return null
  }

  const id = `ost-${videoId || toSlug(trackTitle)}`

  return {
    id,
    trackTitle,
    trackAliases: [
      ...new Set(parseAliases(raw.trackAliases).concat(parseAliases(raw.aliases))),
    ],
    artistName,
    artistAliases: [
      ...new Set(parseAliases(raw.artistAliases).concat(parseAliases(raw.artistAlias))),
    ],
    imageUrl,
    audioUrl,
    source: videoId ? `youtube:${videoId}` : sourceLabel,
  }
}

async function main() {
  const inputPath = process.argv[2] || DEFAULT_SOURCE
  const outputPath = process.argv[3] || 'data/processed/ost.normalized.json'
  const metaPath = process.argv[4] || 'data/processed/ost-meta.json'

  const raw = await fs.readFile(inputPath, 'utf8')
  const trimmed = raw.trim()
  const payload = trimmed ? parseJsonSafe(trimmed) : []

  if (payload === null) {
    throw new Error(
      `Invalid JSON in ${inputPath}. Provide a valid JSON array/object for OST records.`,
    )
  }

  const tracks = collectTrackObjects(payload)

  const normalized = []
  const seen = new Set()

  for (const track of tracks) {
    const record = normalizeTrack(track, path.basename(inputPath))
    if (!record || seen.has(record.id)) {
      continue
    }
    seen.add(record.id)
    normalized.push(record)
  }

  if (tracks.length > 0 && normalized.length === 0) {
    throw new Error(`No valid OST records found in ${inputPath}.`)
  }

  normalized.sort((left, right) => left.trackTitle.localeCompare(right.trackTitle))

  const generatedAt = new Date().toISOString()
  const meta = {
    version: generatedAt,
    source: 'ost-source-json',
    inputFile: inputPath,
    items: normalized.length,
    hasInputTracks: tracks.length > 0,
    generatedAt,
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })

  await Promise.all([
    fs.writeFile(outputPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8'),
    fs.writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8'),
  ])

  if (tracks.length === 0) {
    console.log(
      `No OST tracks found in ${inputPath}. Wrote empty dataset so OST mode remains disabled until data is added.`,
    )
  } else {
    console.log(`Extracted ${normalized.length} OST records from ${inputPath}`)
  }
  console.log(`Wrote ${outputPath} and ${metaPath}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
