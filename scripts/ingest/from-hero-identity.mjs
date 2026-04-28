import fs from 'node:fs/promises'
import path from 'node:path'

const HERO_PAGE_ORIGIN = 'https://world.honorofkings.com'
const HERO_DETAIL_BASE = `${HERO_PAGE_ORIGIN}/zlkdatasys/yuzhouzhan/hero/detail/en/`

function toCleanString(value) {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return ''
}

function toAbsoluteUrl(rawUrl) {
  const value = toCleanString(rawUrl)
  if (!value) {
    return ''
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value
  }

  if (value.startsWith('//')) {
    return `https:${value}`
  }

  if (value.startsWith('/')) {
    return `${HERO_PAGE_ORIGIN}${value}`
  }

  return value
}

function collectHeroSeeds(payload) {
  const sourceArray = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.heroes)
      ? payload.heroes
      : Array.isArray(payload?.yzzyxl_5891)
        ? payload.yzzyxl_5891
        : []

  const records = []
  const seen = new Set()

  for (const item of sourceArray) {
    const heroId = toCleanString(item?.id_6123 || item?.heroId || item?.id)
    if (!heroId || seen.has(heroId) || !/^\d+$/.test(heroId)) {
      continue
    }

    seen.add(heroId)

    const heroName =
      toCleanString(item?.mz_6951) ||
      toCleanString(item?.heroName) ||
      toCleanString(item?.yxpy_5883)

    const alias = toCleanString(item?.yxpy_5883)
    const aliases = alias && alias !== heroName ? [alias] : []

    records.push({
      heroId,
      heroName,
      heroAliases: aliases,
      fallbackRegion: toCleanString(item?.yxqy_2536 || item?.region),
      fallbackImage: toCleanString(item?.yxlbfm_2561 || item?.imageUrl),
    })
  }

  return records
}

async function fetchWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'hok-trivia-ingest/1.0',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

async function mapWithConcurrency(items, worker, concurrency = 6) {
  const output = new Array(items.length)
  let cursor = 0

  async function runNext() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      output[index] = await worker(items[index], index)
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => runNext())
  await Promise.all(workers)
  return output
}

async function main() {
  const inputPath = process.argv[2] || 'data/processed/_heroList-en.json'
  const outputPath = process.argv[3] || 'data/processed/hero-identity.normalized.json'
  const metaPath = process.argv[4] || 'data/processed/hero-identity-meta.json'

  const payload = JSON.parse(await fs.readFile(inputPath, 'utf8'))
  const seeds = collectHeroSeeds(payload)

  if (seeds.length === 0) {
    throw new Error(`No hero seeds found in ${inputPath}`)
  }

  const failures = []

  const records = await mapWithConcurrency(
    seeds,
    async (seed) => {
      const heroDetailUrl = `${HERO_DETAIL_BASE}${seed.heroId}.json`

      try {
        const detail = await fetchWithTimeout(heroDetailUrl)

        const heroName =
          toCleanString(detail?.mz_6951) ||
          toCleanString(seed.heroName)

        const imageUrl = toAbsoluteUrl(
          detail?.yxicon_3188 || detail?.kvmdhb_6199 || seed.fallbackImage,
        )

        const identity = toCleanString(detail?.sf_5061)
        if (!heroName || !identity || !imageUrl) {
          throw new Error('Missing heroName, identity, or imageUrl')
        }

        return {
          id: `identity-${seed.heroId}`,
          heroId: seed.heroId,
          heroName,
          heroAliases: seed.heroAliases,
          identity,
          energy: toCleanString(detail?.nl_7967),
          height: toCleanString(detail?.sg_9187),
          region: toCleanString(detail?.yxqy_2536) || seed.fallbackRegion,
          imageUrl,
          source: heroDetailUrl,
        }
      } catch (error) {
        failures.push({
          heroId: seed.heroId,
          heroName: seed.heroName,
          reason: error instanceof Error ? error.message : String(error),
        })
        return null
      }
    },
    6,
  )

  const normalized = records
    .filter(Boolean)
    .sort((left, right) => left.heroName.localeCompare(right.heroName))

  const generatedAt = new Date().toISOString()
  const meta = {
    version: generatedAt,
    source: 'hero-detail-api',
    inputFile: inputPath,
    totalSeeds: seeds.length,
    items: normalized.length,
    failed: failures.length,
    generatedAt,
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })

  await Promise.all([
    fs.writeFile(outputPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8'),
    fs.writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8'),
  ])

  if (failures.length > 0) {
    const failurePath = path.join(path.dirname(metaPath), 'hero-identity.failures.json')
    await fs.writeFile(failurePath, `${JSON.stringify(failures, null, 2)}\n`, 'utf8')
    console.log(`Wrote ${failurePath} (${failures.length} failed heroes)`)
  }

  console.log(`Extracted ${normalized.length} hero identity records from ${seeds.length} seeds`)
  console.log(`Wrote ${outputPath} and ${metaPath}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
