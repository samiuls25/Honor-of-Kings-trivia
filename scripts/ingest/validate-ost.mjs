import fs from 'node:fs/promises'

const inputPath = process.argv[2] || 'data/processed/ost.normalized.json'

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

    if (!record.trackTitle || typeof record.trackTitle !== 'string') {
      issues.push(`${entry}: missing string trackTitle`)
    }

    if (!record.artistName || typeof record.artistName !== 'string') {
      issues.push(`${entry}: missing string artistName`)
    }

    if (!Array.isArray(record.trackAliases)) {
      issues.push(`${entry}: trackAliases must be an array`)
    }

    if (!Array.isArray(record.artistAliases)) {
      issues.push(`${entry}: artistAliases must be an array`)
    }

    if (!record.imageUrl || typeof record.imageUrl !== 'string') {
      issues.push(`${entry}: missing string imageUrl`)
    } else if (!record.imageUrl.startsWith('http://') && !record.imageUrl.startsWith('https://')) {
      issues.push(`${entry}: imageUrl should be absolute URL`)
    }

    if (!record.audioUrl || typeof record.audioUrl !== 'string') {
      issues.push(`${entry}: missing string audioUrl`)
    } else if (!record.audioUrl.startsWith('http://') && !record.audioUrl.startsWith('https://')) {
      issues.push(`${entry}: audioUrl should be absolute URL`)
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

  console.log(`Validation passed: ${records.length} OST records`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
