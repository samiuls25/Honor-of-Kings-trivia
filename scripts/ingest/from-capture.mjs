import fs from 'node:fs/promises'
import https from 'node:https'
import path from 'node:path'

const DEFAULT_CAPTURE_CANDIDATES = [
  'data/raw/hok-skins-capture.har',
  'data/raw/hok-skins-capture.json',
]

const HERO_NAME_KEYS = [
  'heroName',
  'hero_name',
  'heroTitle',
  'hero_title',
  'hero.name',
  'heroInfo.name',
  'hero_info.name',
  'character.name',
  'characterName',
  'character_name',
]

const SKIN_NAME_KEYS = [
  'skinName',
  'skin_name',
  'skinTitle',
  'skin_title',
  'title',
  'name',
  'skin.name',
  'skinInfo.name',
  'skin_info.name',
]

const HERO_ID_KEYS = [
  'heroId',
  'hero_id',
  'hero.id',
  'heroInfo.id',
  'hero_info.id',
  'characterId',
  'character_id',
]

const SKIN_ID_KEYS = [
  'skinId',
  'skin_id',
  'id',
  'skin.id',
  'skinInfo.id',
  'skin_info.id',
]

const IMAGE_KEYS = [
  'imageUrl',
  'image_url',
  'imgUrl',
  'img_url',
  'image',
  'img',
  'poster',
  'splash',
  'cover',
  'icon',
  'pic',
  'avatar',
  'displayImage',
  'display_image',
  'image.url',
  'cover.url',
  'skin.image',
  'skin.imageUrl',
  'skin.cover',
]

const HERO_ALIAS_KEYS = [
  'heroAliases',
  'hero_aliases',
  'heroAlias',
  'hero_alias',
]

const SKIN_ALIAS_KEYS = [
  'skinAliases',
  'skin_aliases',
  'skinAlias',
  'skin_alias',
]

const KNOWN_HOK_JSON_URL_PATTERN = /\/zlkdatasys\/.+\.json/i

async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function resolveCapturePath(argPath) {
  if (argPath) {
    if (!(await fileExists(argPath))) {
      throw new Error(`Capture file not found: ${argPath}`)
    }
    return argPath
  }

  for (const candidate of DEFAULT_CAPTURE_CANDIDATES) {
    if (await fileExists(candidate)) {
      return candidate
    }
  }

  throw new Error(
    `No capture file found. Add one of: ${DEFAULT_CAPTURE_CANDIDATES.join(', ')}`,
  )
}

function parseJsonSafe(input, fallback = null) {
  try {
    return JSON.parse(input)
  } catch {
    return fallback
  }
}

function getByPath(obj, keyPath) {
  if (!obj || typeof obj !== 'object') {
    return undefined
  }

  if (!keyPath.includes('.')) {
    return obj[keyPath]
  }

  return keyPath.split('.').reduce((acc, part) => {
    if (!acc || typeof acc !== 'object') {
      return undefined
    }
    return acc[part]
  }, obj)
}

function getFirstString(obj, keys) {
  for (const key of keys) {
    const value = getByPath(obj, key)

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }

    if (value && typeof value === 'object') {
      if (typeof value.url === 'string' && value.url.trim()) {
        return value.url.trim()
      }
      if (typeof value.src === 'string' && value.src.trim()) {
        return value.src.trim()
      }
      if (typeof value.name === 'string' && value.name.trim()) {
        return value.name.trim()
      }
    }
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

function toSlug(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 96)
}

function normalizeGuess(input) {
  return String(input)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function absolutizeImage(imageValue, sourceUrl) {
  if (!imageValue) {
    return ''
  }

  if (imageValue.startsWith('http://') || imageValue.startsWith('https://')) {
    return imageValue
  }

  if (imageValue.startsWith('//')) {
    return `https:${imageValue}`
  }

  if (imageValue.startsWith('data:')) {
    return imageValue
  }

  if (!sourceUrl) {
    return imageValue
  }

  try {
    return new URL(imageValue, sourceUrl).toString()
  } catch {
    return imageValue
  }
}

function collectObjects(input, output) {
  if (Array.isArray(input)) {
    for (const item of input) {
      collectObjects(item, output)
    }
    return
  }

  if (!input || typeof input !== 'object') {
    return
  }

  output.push(input)

  for (const value of Object.values(input)) {
    collectObjects(value, output)
  }
}

function buildRecord(obj, sourceUrl) {
  const heroName = getFirstString(obj, HERO_NAME_KEYS)
  const skinName = getFirstString(obj, SKIN_NAME_KEYS)
  const imageRaw = getFirstString(obj, IMAGE_KEYS)

  if (!heroName || !skinName || !imageRaw) {
    return null
  }

  if (heroName.length < 2 || skinName.length < 2) {
    return null
  }

  const heroIdRaw = getFirstString(obj, HERO_ID_KEYS)
  const skinIdRaw = getFirstString(obj, SKIN_ID_KEYS)

  const heroAliases = [
    ...parseAliases(getByPath(obj, HERO_ALIAS_KEYS[0])),
    ...parseAliases(getByPath(obj, HERO_ALIAS_KEYS[1])),
    ...parseAliases(getByPath(obj, HERO_ALIAS_KEYS[2])),
    ...parseAliases(getByPath(obj, HERO_ALIAS_KEYS[3])),
  ]

  const skinAliases = [
    ...parseAliases(getByPath(obj, SKIN_ALIAS_KEYS[0])),
    ...parseAliases(getByPath(obj, SKIN_ALIAS_KEYS[1])),
    ...parseAliases(getByPath(obj, SKIN_ALIAS_KEYS[2])),
    ...parseAliases(getByPath(obj, SKIN_ALIAS_KEYS[3])),
  ]

  const heroId = heroIdRaw || toSlug(heroName)
  const skinId = skinIdRaw || `${toSlug(heroName)}-${toSlug(skinName)}`

  return {
    id: skinId,
    heroId,
    heroName,
    heroAliases: [...new Set(heroAliases)],
    skinName,
    skinAliases: [...new Set(skinAliases)],
    imageUrl: absolutizeImage(imageRaw, sourceUrl),
    source: sourceUrl || 'capture',
  }
}

function normalizeRecords(records) {
  const deduped = new Map()

  for (const record of records) {
    const key = record.id

    if (!deduped.has(key)) {
      deduped.set(key, record)
      continue
    }

    const previous = deduped.get(key)
    const previousScore = Number(previous.imageUrl.startsWith('http'))
    const newScore = Number(record.imageUrl.startsWith('http'))

    if (newScore > previousScore) {
      deduped.set(key, record)
    }
  }

  return [...deduped.values()].sort((a, b) => {
    const hero = a.heroName.localeCompare(b.heroName)
    if (hero !== 0) {
      return hero
    }
    return a.skinName.localeCompare(b.skinName)
  })
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

function parseKnownHokRecords(payloads) {
  const records = []
  const heroAliasesById = new Map()

  for (const payloadInfo of payloads) {
    const heroList = payloadInfo?.payload?.yzzyxl_5891
    if (!Array.isArray(heroList)) {
      continue
    }

    for (const hero of heroList) {
      if (!hero || typeof hero !== 'object') {
        continue
      }

      const heroId = toCleanString(hero.id_6123)
      if (!heroId) {
        continue
      }

      const aliasCandidates = [
        toCleanString(hero.yxpy_5883),
        toCleanString(hero.mz_6951),
        toCleanString(hero.ch_1965),
        toCleanString(hero.zyyx_9786),
      ].filter(Boolean)

      const existing = heroAliasesById.get(heroId) ?? new Set()
      for (const alias of aliasCandidates) {
        existing.add(alias)
      }
      heroAliasesById.set(heroId, existing)
    }
  }

  for (const payloadInfo of payloads) {
    const skinList = payloadInfo?.payload?.pflbzt_5151
    if (!Array.isArray(skinList)) {
      continue
    }

    for (const skin of skinList) {
      if (!skin || typeof skin !== 'object') {
        continue
      }

      const heroName = toCleanString(skin.pfjstc_2455)
      const skinName = toCleanString(skin.btpfjs_7484)
      const heroId = toCleanString(skin.pfjsgy_4147) || toSlug(heroName)
      const skinSeriesName = toCleanString(skin.pftxmc_8315)
      const imageRaw =
        toCleanString(skin.pfjspc_4348) ||
        toCleanString(skin.pfjsyd_1886) ||
        toCleanString(skin.yddsbf_5441)

      if (!heroName || !skinName || !imageRaw) {
        continue
      }

      const heroAliases = [...(heroAliasesById.get(heroId) ?? new Set())].filter(
        (alias) => normalizeGuess(alias) !== normalizeGuess(heroName),
      )

      const skinAliases = [skinSeriesName].filter(Boolean)

      records.push({
        id: `${heroId}-${toSlug(skinName)}`,
        heroId,
        heroName,
        heroAliases,
        skinName,
        skinAliases,
        imageUrl: absolutizeImage(imageRaw, payloadInfo.sourceUrl),
        source: payloadInfo.sourceUrl,
      })
    }
  }

  return records
}

function fetchJsonText(url, serverIp) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)

    const options = {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      path: `${parsed.pathname}${parsed.search}`,
      method: 'GET',
      servername: parsed.hostname,
      timeout: 15000,
      headers: {
        accept: 'application/json,text/plain,*/*',
        'accept-encoding': 'identity',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135 Safari/537.36',
      },
    }

    if (serverIp && /^\d+\.\d+\.\d+\.\d+$/.test(serverIp)) {
      options.lookup = (_hostname, lookupOptions, callback) => {
        if (lookupOptions?.all) {
          callback(null, [{ address: serverIp, family: 4 }])
          return
        }

        callback(null, serverIp, 4)
      }
    }

    const request = https.request(options, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8')
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`HTTP ${response.statusCode} for ${url}`))
          return
        }
        resolve(body)
      })
    })

    request.on('error', reject)
    request.on('timeout', () => {
      request.destroy(new Error(`Request timeout for ${url}`))
    })
    request.end()
  })
}

async function fetchPayloadsFromSanitizedHar(harObject) {
  const entries = Array.isArray(harObject?.log?.entries) ? harObject.log.entries : []
  const candidates = new Map()

  for (const entry of entries) {
    const url = entry?.request?.url || ''
    const serverIp = entry?.serverIPAddress || ''

    if (!KNOWN_HOK_JSON_URL_PATTERN.test(url)) {
      continue
    }

    if (!candidates.has(url)) {
      candidates.set(url, serverIp)
    }
  }

  const prioritized = [...candidates.entries()].sort((left, right) => {
    const leftScore = Number(/pfjs|heroList/i.test(left[0]))
    const rightScore = Number(/pfjs|heroList/i.test(right[0]))
    return rightScore - leftScore
  })

  const payloads = []

  for (const [url, serverIp] of prioritized.slice(0, 24)) {
    try {
      const body = await fetchJsonText(url, serverIp)
      const parsed = parseJsonSafe(body)
      if (parsed) {
        payloads.push({ sourceUrl: url, payload: parsed })
      }
    } catch {
      // Ignore individual fetch failures; at least one successful payload is enough.
    }
  }

  return payloads
}

function extractPayloadsFromHar(harObject) {
  const entries = Array.isArray(harObject?.log?.entries) ? harObject.log.entries : []
  const payloads = []

  for (const entry of entries) {
    const sourceUrl = entry?.request?.url || ''
    const content = entry?.response?.content
    const mimeType = String(content?.mimeType || '')

    if (!mimeType.includes('json')) {
      continue
    }

    if (typeof content?.text !== 'string' || !content.text.trim()) {
      continue
    }

    const text = content.encoding === 'base64'
      ? Buffer.from(content.text, 'base64').toString('utf8')
      : content.text

    const parsed = parseJsonSafe(text)
    if (parsed) {
      payloads.push({ sourceUrl, payload: parsed })
    }
  }

  return payloads
}

async function readCapturePayloads(capturePath) {
  const raw = await fs.readFile(capturePath, 'utf8')
  const parsed = parseJsonSafe(raw)

  if (!parsed) {
    throw new Error(`Invalid JSON/HAR file: ${capturePath}`)
  }

  if (capturePath.endsWith('.har')) {
    const fromResponses = extractPayloadsFromHar(parsed)
    if (fromResponses.length > 0) {
      return fromResponses
    }

    const fromSanitizedFallback = await fetchPayloadsFromSanitizedHar(parsed)
    if (fromSanitizedFallback.length > 0) {
      return fromSanitizedFallback
    }

    return []
  }

  return [{ sourceUrl: path.basename(capturePath), payload: parsed }]
}

async function main() {
  const capturePath = await resolveCapturePath(process.argv[2])
  const payloads = await readCapturePayloads(capturePath)

  if (payloads.length === 0) {
    throw new Error(`No JSON payloads found in capture: ${capturePath}`)
  }

  const candidateRecords = []

  for (const record of parseKnownHokRecords(payloads)) {
    candidateRecords.push(record)
  }

  for (const payloadInfo of payloads) {
    const objects = []
    collectObjects(payloadInfo.payload, objects)

    for (const obj of objects) {
      const record = buildRecord(obj, payloadInfo.sourceUrl)
      if (record) {
        candidateRecords.push(record)
      }
    }
  }

  const normalized = normalizeRecords(candidateRecords)

  if (normalized.length === 0) {
    throw new Error(
      'No valid hero/skin/image records were extracted. Check input payload shape and update key mappings in scripts/ingest/from-capture.mjs.',
    )
  }

  const outputDir = 'data/processed'
  await fs.mkdir(outputDir, { recursive: true })

  const generatedAt = new Date().toISOString()
  const meta = {
    version: generatedAt,
    source: 'official-capture',
    captureFile: capturePath,
    items: normalized.length,
    generatedAt,
  }

  await fs.writeFile(
    path.join(outputDir, 'skins.normalized.json'),
    `${JSON.stringify(normalized, null, 2)}\n`,
    'utf8',
  )

  await fs.writeFile(
    path.join(outputDir, 'meta.json'),
    `${JSON.stringify(meta, null, 2)}\n`,
    'utf8',
  )

  console.log(`Extracted ${normalized.length} records from ${capturePath}`)
  console.log('Wrote data/processed/skins.normalized.json and data/processed/meta.json')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
