import fs from 'node:fs/promises'
import path from 'node:path'

const INPUT_PATH = path.join(
  process.cwd(),
  'data',
  'processed',
  'hero-relationships.normalized.json'
)

const ensureString = (value) => typeof value === 'string'
const ensureArray = (value) => Array.isArray(value)
const ensureOptionalNumber = (value) =>
  value == null || (typeof value === 'number' && Number.isFinite(value))

const validate = (payload) => {
  const failures = []

  if (!payload || typeof payload !== 'object') {
    failures.push({ reason: 'payload-not-object' })
    return failures
  }

  if (!ensureArray(payload.records)) {
    failures.push({ reason: 'records-not-array' })
    return failures
  }

  payload.records.forEach((record, index) => {
    if (!record || typeof record !== 'object') {
      failures.push({ reason: 'record-not-object', index })
      return
    }

    const checks = [
      ['id', record.id],
      ['heroId', record.heroId],
      ['heroName', record.heroName],
      ['heroImageUrl', record.heroImageUrl],
      ['relatedHeroId', record.relatedHeroId],
      ['relatedHeroName', record.relatedHeroName],
      ['relatedHeroImageUrl', record.relatedHeroImageUrl],
      ['relation', record.relation],
      ['relationImageUrl', record.relationImageUrl],
      ['relationDescription', record.relationDescription],
      ['source', record.source],
    ]

    checks.forEach(([key, value]) => {
      if (!ensureString(value)) {
        failures.push({ reason: 'field-not-string', index, key, value })
      }
    })

    if (!ensureArray(record.heroAliases)) {
      failures.push({ reason: 'heroAliases-not-array', index })
    }

    if (!ensureArray(record.relatedHeroAliases)) {
      failures.push({ reason: 'relatedHeroAliases-not-array', index })
    }

    if (!ensureOptionalNumber(record.relationScore)) {
      failures.push({ reason: 'relationScore-not-number', index })
    }
  })

  return failures
}

const main = async () => {
  const raw = await fs.readFile(INPUT_PATH, 'utf8')
  const payload = JSON.parse(raw)
  const failures = validate(payload)

  if (failures.length > 0) {
    console.error(`Hero relationship validation failed (${failures.length}).`)
    console.error(JSON.stringify(failures.slice(0, 25), null, 2))
    process.exitCode = 1
    return
  }

  console.log('Hero relationship validation passed.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
