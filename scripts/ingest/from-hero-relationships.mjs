import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_SOURCE_URL =
  'https://world.honorofkings.com/act/a20240723relationship/relavance/en/data.js'
const BASE_ORIGIN = 'https://world.honorofkings.com'

const OUTPUT_PATH = path.join(
  process.cwd(),
  'data',
  'processed',
  'hero-relationships.normalized.json'
)
const FAILURES_PATH = path.join(
  process.cwd(),
  'data',
  'processed',
  'hero-relationships.failures.json'
)

const toCleanString = (value) =>
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()

const normalizeText = (value) =>
  toCleanString(value)
    .replace(/[\u00A0\u00C2]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const isHttpUrl = (value) => value.startsWith('http://') || value.startsWith('https://')

const toAbsoluteUrl = (value) => {
  const cleaned = toCleanString(value)
  if (!cleaned) {
    return ''
  }
  if (cleaned.startsWith('//')) {
    return `https:${cleaned}`
  }
  if (cleaned.startsWith('http://')) {
    return cleaned.replace(/^http:\/\//, 'https://')
  }
  if (cleaned.startsWith('https://')) {
    return cleaned
  }
  if (cleaned.startsWith('/')) {
    return `${BASE_ORIGIN}${cleaned}`
  }
  return cleaned
}

const extractCallArguments = (source, marker) => {
  const markerIndex = source.indexOf(marker)
  if (markerIndex === -1) {
    throw new Error(`Unable to find marker: ${marker}`)
  }

  const startIndex = source.indexOf('(', markerIndex)
  if (startIndex === -1) {
    throw new Error(`Unable to locate call start for: ${marker}`)
  }

  let depth = 0
  let inString = false
  let stringQuote = ''
  let escaped = false
  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === stringQuote) {
        inString = false
        stringQuote = ''
      }
      continue
    }

    if (char === '"' || char === "'") {
      inString = true
      stringQuote = char
      continue
    }

    if (char === '(') {
      depth += 1
      continue
    }

    if (char === ')') {
      depth -= 1
      if (depth === 0) {
        return source.slice(startIndex + 1, index)
      }
    }
  }

  throw new Error(`Unable to locate call end for: ${marker}`)
}

const parseFunctionArrayArguments = (source, marker) => {
  const literal = extractCallArguments(source, marker)
  return Function(`"use strict"; return ([${literal}])`)()
}

const loadSource = async (input) => {
  if (isHttpUrl(input)) {
    const response = await fetch(input)
    if (!response.ok) {
      throw new Error(`Failed to fetch ${input}: ${response.status}`)
    }
    return { raw: await response.text(), source: input }
  }

  const filePath = path.isAbsolute(input)
    ? input
    : path.join(process.cwd(), input)
  return { raw: await fs.readFile(filePath, 'utf8'), source: filePath }
}

const normalizeRoles = (rawRoles) => {
  const heroes = []
  const failures = []
  const byId = new Map()

  rawRoles.forEach((entry, index) => {
    if (!Array.isArray(entry)) {
      failures.push({ reason: 'role-not-array', index, entry })
      return
    }

    const id = toCleanString(entry[0])
    const name = normalizeText(entry[1])
    const imageUrl = toAbsoluteUrl(entry[3])

    if (!id || !name) {
      failures.push({ reason: 'role-missing-id-name', index, entry })
      return
    }

    const hero = {
      heroId: id,
      heroName: name,
      heroImageUrl: imageUrl,
    }

    if (!byId.has(id)) {
      heroes.push(hero)
      byId.set(id, hero)
    }
  })

  return { heroes, byId, failures }
}

const normalizeRelations = (rawRelations, heroById, source) => {
  const records = []
  const failures = []

  rawRelations.forEach((entry, index) => {
    if (!Array.isArray(entry)) {
      failures.push({ reason: 'relation-not-array', index, entry })
      return
    }

    const heroId = toCleanString(entry[0])
    const relatedHeroId = toCleanString(entry[1])
    const relation = normalizeText(entry[2])
    const relationScore = Number(entry[3])
    const relationImageUrl = toAbsoluteUrl(entry[4])
    const relationDescription = normalizeText(entry[5])

    const hero = heroById.get(heroId)
    const relatedHero = heroById.get(relatedHeroId)

    if (!hero || !relatedHero || !relation) {
      failures.push({
        reason: 'relation-missing-hero-or-label',
        index,
        entry,
        heroId,
        relatedHeroId,
      })
      return
    }

    records.push({
      id: `relationship-${heroId}-${relatedHeroId}-${index}`,
      heroId,
      heroName: hero.heroName,
      heroImageUrl: hero.heroImageUrl,
      relatedHeroId,
      relatedHeroName: relatedHero.heroName,
      relatedHeroImageUrl: relatedHero.heroImageUrl,
      relation,
      relationScore: Number.isFinite(relationScore) ? relationScore : null,
      relationImageUrl,
      relationDescription,
      heroAliases: [],
      relatedHeroAliases: [],
      source,
    })
  })

  return { records, failures }
}

const main = async () => {
  const input = process.argv[2] || DEFAULT_SOURCE_URL
  const { raw, source } = await loadSource(input)

  const rawRoles = parseFunctionArrayArguments(raw, 'stage.addRoles')
  const rawRelations = parseFunctionArrayArguments(raw, 'stage.relate')

  const { heroes, byId, failures: roleFailures } = normalizeRoles(rawRoles)
  const { records, failures: relationFailures } = normalizeRelations(
    rawRelations,
    byId,
    source
  )

  const output = {
    meta: {
      version: new Date().toISOString(),
      source,
      items: records.length,
      heroes: heroes.length,
      rawRelations: Array.isArray(rawRelations) ? rawRelations.length : 0,
      failures: roleFailures.length + relationFailures.length,
    },
    heroes,
    records: records.sort((a, b) => {
      const heroCompare = a.heroName.localeCompare(b.heroName)
      if (heroCompare !== 0) {
        return heroCompare
      }
      const relatedCompare = a.relatedHeroName.localeCompare(b.relatedHeroName)
      if (relatedCompare !== 0) {
        return relatedCompare
      }
      return a.relation.localeCompare(b.relation)
    }),
  }

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8')

  const failures = [...roleFailures, ...relationFailures]
  if (failures.length > 0) {
    await fs.writeFile(FAILURES_PATH, JSON.stringify(failures, null, 2), 'utf8')
  }

  console.log(
    `Hero relationships normalized: ${records.length} records (${failures.length} failures).`
  )
  console.log(`Output: ${OUTPUT_PATH}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
