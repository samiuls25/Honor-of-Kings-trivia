import fs from 'node:fs/promises'

const inputPath = process.argv[2] || 'data/processed/skins.normalized.json'

function isAscii(value) {
  return !/[^\x00-\x7F]/.test(value)
}

async function main() {
  const raw = await fs.readFile(inputPath, 'utf8')
  const records = JSON.parse(raw)

  if (!Array.isArray(records)) {
    throw new Error(`Expected array in ${inputPath}`)
  }

  const heroSet = new Set()
  const duplicateKeys = new Set()
  const seenKeys = new Set()

  let nonEnglishRows = 0
  let missingImageRows = 0

  for (const record of records) {
    heroSet.add(record.heroName)

    const pairKey = `${record.heroName}::${record.skinName}`.toLowerCase()
    if (seenKeys.has(pairKey)) {
      duplicateKeys.add(pairKey)
    }
    seenKeys.add(pairKey)

    if (!record.imageUrl || !String(record.imageUrl).startsWith('http')) {
      missingImageRows += 1
    }

    if (!isAscii(`${record.heroName} ${record.skinName}`)) {
      nonEnglishRows += 1
    }
  }

  const report = {
    inputPath,
    records: records.length,
    uniqueHeroes: heroSet.size,
    nonEnglishRows,
    missingImageRows,
    duplicateHeroSkinPairs: duplicateKeys.size,
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
