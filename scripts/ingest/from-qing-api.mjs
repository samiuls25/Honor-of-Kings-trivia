import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_ENDPOINT = 'https://qing762.is-a.dev/api/wangzhe'

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
    return value.replace(/^https:/, '')
  }

  if (value.startsWith('http:http://')) {
    return value.replace(/^http:/, '')
  }

  // Some rows include protocol-relative wrappers around full URLs.
  if (value.startsWith('//https://') || value.startsWith('//http://')) {
    return value.slice(2)
  }

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value
  }

  if (value.startsWith('//')) {
    return `https:${value}`
  }

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

function normalizeSkinRecords(heroes, source) {
  const records = []
  const seenIds = new Set()
  let heroesWithoutSkins = 0
  let nonEnglishRows = 0

  for (const hero of heroes) {
    if (!hero || typeof hero !== 'object') {
      continue
    }

    const heroName = toCleanString(hero.name)
    const heroAlias = toCleanString(hero.title)
    const heroId = parseHeroId(hero)
    const skins = Array.isArray(hero.skins) ? hero.skins : []

    if (skins.length === 0) {
      heroesWithoutSkins += 1
      continue
    }

    for (const skin of skins) {
      if (!skin || typeof skin !== 'object') {
        continue
      }

      const skinName = toCleanString(skin.skinName || skin.name)
      const imageUrl = absolutizeImage(toCleanString(skin.skinImg || skin.image || skin.img))

      if (!heroName || !skinName || !imageUrl) {
        continue
      }

      if (!looksMostlyEnglish(heroName + skinName)) {
        nonEnglishRows += 1
      }

      const skinSlug = toSlug(skinName) || toSlug(imageUrl) || 'skin'
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

  if (heroes.length === 0) {
    throw new Error('No hero payloads found in qing source.')
  }

  const { records, quality } = normalizeSkinRecords(heroes, endpoint)

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
