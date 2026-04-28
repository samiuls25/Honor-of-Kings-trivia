import fs from 'node:fs/promises'

const inputPath = process.argv[2] || 'data/processed/hero-identity.normalized.json'

async function main() {
  const raw = await fs.readFile(inputPath, 'utf8')
  const records = JSON.parse(raw)

  if (!Array.isArray(records)) {
    throw new Error(`Expected array in ${inputPath}`)
  }

  const issues = []
  const ids = new Set()

  records.forEach((record, index) => {
    const entry = `record ${index + 1}`

    if (!record || typeof record !== 'object') {
      issues.push(`${entry}: value must be an object`)
      return
    }

    if (!record.id || typeof record.id !== 'string') {
      issues.push(`${entry}: missing string id`)
    } else if (ids.has(record.id)) {
      issues.push(`${entry}: duplicate id ${record.id}`)
    } else {
      ids.add(record.id)
    }

    if (!record.heroId || typeof record.heroId !== 'string') {
      issues.push(`${entry}: missing string heroId`)
    }

    if (!record.heroName || typeof record.heroName !== 'string') {
      issues.push(`${entry}: missing string heroName`)
    }

    if (!Array.isArray(record.heroAliases)) {
      issues.push(`${entry}: heroAliases must be an array`)
    }

    if (!record.identity || typeof record.identity !== 'string') {
      issues.push(`${entry}: missing string identity`)
    }

    if (!record.energy || typeof record.energy !== 'string') {
      issues.push(`${entry}: missing string energy`)
    }

    if (!record.height || typeof record.height !== 'string') {
      issues.push(`${entry}: missing string height`)
    }

    if (!record.region || typeof record.region !== 'string') {
      issues.push(`${entry}: missing string region`)
    }

    if (!record.imageUrl || typeof record.imageUrl !== 'string') {
      issues.push(`${entry}: missing string imageUrl`)
    } else if (!record.imageUrl.startsWith('http://') && !record.imageUrl.startsWith('https://')) {
      issues.push(`${entry}: imageUrl should be absolute URL`)
    }

    if (!record.source || typeof record.source !== 'string') {
      issues.push(`${entry}: missing string source`)
    }
  })

  if (issues.length > 0) {
    console.error(`Validation failed with ${issues.length} issue(s):`)
    for (const issue of issues) {
      console.error(`- ${issue}`)
    }
    process.exit(1)
  }

  console.log(`Validation passed: ${records.length} hero identity records`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
