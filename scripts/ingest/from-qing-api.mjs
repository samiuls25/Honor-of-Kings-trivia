import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_ENDPOINT = 'https://qing762.is-a.dev/api/wangzhe'
const DEFAULT_HEROLIST_ENDPOINT = 'https://pvp.qq.com/web201605/js/herolist.json'

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

function absolutizeImage(imageValue) {
  const value = toCleanString(imageValue)
  if (!value) {
    return ''
  }

  // Some rows come back as malformed protocol chains like "https:https://..."
  if (value.startsWith('https:https://')) {
    return toFullSizeImage(value.replace(/^https:/, ''))
  }

  if (value.startsWith('http:http://')) {
    return toFullSizeImage(value.replace(/^http:/, ''))
  }

  // Some rows include protocol-relative wrappers around full URLs.
  if (value.startsWith('//https://') || value.startsWith('//http://')) {
    return toFullSizeImage(value.slice(2))
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return toFullSizeImage(value)
  }

  if (value.startsWith('//')) {
    return toFullSizeImage(`https:${value}`)
  }

  return toFullSizeImage(value)
}

function toFullSizeImage(urlValue) {
  const value = toCleanString(urlValue)
  if (!value || !value.includes('?')) {
    return value
  }

  // qing source often appends thumbnail crop transforms to otherwise high-res images.
  if (value.includes('imageMogr2/crop/120x120')) {
    return value.split('?')[0]
  }

  // Keep unknown query parameters intact.
  return value
}

function parseHeroId(hero) {
  const urlValue = toCleanString(hero.url)
  if (urlValue) {
    const match = urlValue.match(/\/herodetail\/([^./]+)\./i)
    if (match?.[1]) {
      return toSlug(match[1])
    }
  }

  return toSlug(toCleanString(hero.name) || 'hero')
}

function parseHeroSlug(hero) {
  const urlValue = toCleanString(hero.url)
  if (!urlValue) {
    return ''
  }

  const match = urlValue.match(/\/herodetail\/([^./]+)\./i)
  return match?.[1] ? toSlug(match[1]) : ''
}

function looksMostlyEnglish(value) {
  return /[a-z]/i.test(value)
}

function getHeroObjects(payload) {
  const container = payload?.main && typeof payload.main === 'object'
    ? payload.main
    : payload

  if (Array.isArray(container)) {
    return container
  }

  if (!container || typeof container !== 'object') {
    return []
  }

  return Object.values(container)
}

function buildBigSkinUrl(heroNumericId, skinNumber) {
  return `https://game.gtimg.cn/images/yxzj/img201606/skin/hero-info/${heroNumericId}/${heroNumericId}-bigskin-${skinNumber}.jpg`
}

async function fetchHeroNumericMap() {
  const response = await fetch(DEFAULT_HEROLIST_ENDPOINT)
  if (!response.ok) {
    throw new Error(`Failed to fetch official hero map: HTTP ${response.status}`)
  }

  const payload = await response.json()
  const map = new Map()

  for (const row of payload) {
    const slug = toCleanString(row?.id_name)
    const numeric = Number(row?.ename)
    if (!slug || !Number.isFinite(numeric) || numeric <= 0) {
      continue
    }
    map.set(toSlug(slug), numeric)
  }

  return map
}

async function urlExists(url, cache) {
  if (cache.has(url)) {
    return cache.get(url)
  }

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        accept: 'image/*,*/*',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135 Safari/537.36',
      },
    })

    const exists = response.ok
    cache.set(url, exists)
    return exists
  } catch {
    cache.set(url, false)
    return false
  }
}

async function normalizeSkinRecords(heroes, source, heroNumericBySlug) {
  const records = []
  const seenIds = new Set()
  let heroesWithoutSkins = 0
  let nonEnglishRows = 0
  const headCache = new Map()

  for (const hero of heroes) {
    if (!hero || typeof hero !== 'object') {
      continue
    }

    const heroName = toCleanString(hero.name)
    const heroAlias = toCleanString(hero.title)
    const heroId = parseHeroId(hero)
    const heroSlug = parseHeroSlug(hero) || heroId
    const heroNumericId = heroNumericBySlug.get(heroSlug)
    const skins = Array.isArray(hero.skins) ? hero.skins : []

    if (skins.length === 0) {
      heroesWithoutSkins += 1
      continue
    }

    for (const [skinIndex, skin] of skins.entries()) {
      if (!skin || typeof skin !== 'object') {
        continue
      }

      const skinName = toCleanString(skin.skinName || skin.name)
      const fallbackImageUrl = absolutizeImage(
        toCleanString(skin.skinImg || skin.image || skin.img),
      )

      const bigSkinUrl = heroNumericId
        ? buildBigSkinUrl(heroNumericId, skinIndex + 1)
        : ''

      let imageUrl = fallbackImageUrl
      if (bigSkinUrl) {
        if (await urlExists(bigSkinUrl, headCache)) {
          imageUrl = bigSkinUrl
        }
      }

      if (!heroName || !skinName || !imageUrl) {
        continue
      }

      if (!looksMostlyEnglish(heroName + skinName)) {
        nonEnglishRows += 1
      }

      const skinSlug =
        toSlug(skinName) ||
        `skin-${String(skinIndex + 1).padStart(3, '0')}`
      const skinId = `${heroId}-${skinSlug}`
      if (seenIds.has(skinId)) {
        continue
      }
      seenIds.add(skinId)

      records.push({
        id: skinId,
        heroId,
        heroName,
        heroAliases: heroAlias ? [heroAlias] : [],
        skinName,
        skinAliases: [],
        imageUrl,
        source,
      })
    }
  }

  return {
    records: records.sort((left, right) => {
      const byHero = left.heroName.localeCompare(right.heroName)
      if (byHero !== 0) {
        return byHero
      }
      return left.skinName.localeCompare(right.skinName)
    }),
    quality: {
      heroesTotal: heroes.length,
      heroesWithoutSkins,
      nonEnglishRows,
    },
  }
}

async function main() {
  const endpoint = process.argv[2] || DEFAULT_ENDPOINT
  const outputPath = process.argv[3] || 'data/processed/skins.qing.normalized.json'
  const metaPath = process.argv[4] || 'data/processed/meta.qing.json'
  const qualityPath = process.argv[5] || 'data/processed/quality.qing.json'

  const response = await fetch(endpoint)
  if (!response.ok) {
    throw new Error(`Failed to fetch qing dataset: HTTP ${response.status}`)
  }

  const payload = await response.json()
  const heroes = getHeroObjects(payload)
  const heroNumericBySlug = await fetchHeroNumericMap()

  if (heroes.length === 0) {
    throw new Error('No hero payloads found in qing source.')
  }

  const { records, quality } = await normalizeSkinRecords(
    heroes,
    endpoint,
    heroNumericBySlug,
  )

  if (records.length === 0) {
    throw new Error('No usable skin records extracted from qing source.')
  }

  const generatedAt = new Date().toISOString()

  await fs.mkdir(path.dirname(outputPath), { recursive: true })

  await Promise.all([
    fs.writeFile(outputPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8'),
    fs.writeFile(
      metaPath,
      `${JSON.stringify(
        {
          version: generatedAt,
          source: 'qing762-api',
          endpoint,
          items: records.length,
          generatedAt,
        },
        null,
        2,
      )}\n`,
      'utf8',
    ),
    fs.writeFile(
      qualityPath,
      `${JSON.stringify(
        {
          ...quality,
          records: records.length,
          generatedAt,
        },
        null,
        2,
      )}\n`,
      'utf8',
    ),
  ])

  console.log(`Extracted ${records.length} records from ${endpoint}`)
  console.log(`Wrote ${outputPath}`)
  console.log(`Wrote ${metaPath}`)
  console.log(`Wrote ${qualityPath}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
