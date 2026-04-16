import fs from 'node:fs/promises'

const recordsPath = process.argv[2] || 'data/processed/ost.normalized.json'
const metaPath = process.argv[3] || 'data/processed/ost-meta.json'
const outputPath = process.argv[4] || 'src/data/ost.generated.ts'

async function main() {
  const [recordsRaw, metaRaw] = await Promise.all([
    fs.readFile(recordsPath, 'utf8'),
    fs.readFile(metaPath, 'utf8'),
  ])

  const records = JSON.parse(recordsRaw)
  const meta = JSON.parse(metaRaw)

  if (!Array.isArray(records)) {
    throw new Error(`Expected array in ${recordsPath}`)
  }

  const fileContents = `import type { OstRecord } from '../types'\n\nexport const GENERATED_OST_TRACKS: OstRecord[] = ${JSON.stringify(records, null, 2)}\n\nexport const GENERATED_OST_DATASET_META = ${JSON.stringify(meta, null, 2)} as const\n`

  await fs.writeFile(outputPath, fileContents, 'utf8')

  console.log(`Generated ${outputPath} from ${recordsPath}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
