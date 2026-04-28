import fs from 'node:fs/promises'

const recordsPath = process.argv[2] || 'data/processed/hero-identity.normalized.json'
const metaPath = process.argv[3] || 'data/processed/hero-identity-meta.json'
const outputPath = process.argv[4] || 'src/data/heroIdentity.generated.ts'

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

  const fileContents = `import type { HeroIdentityRecord } from '../types'\n\nexport const GENERATED_HERO_IDENTITY_RECORDS: HeroIdentityRecord[] = ${JSON.stringify(records, null, 2)}\n\nexport const GENERATED_HERO_IDENTITY_DATASET_META = ${JSON.stringify(meta, null, 2)} as const\n`

  await fs.writeFile(outputPath, fileContents, 'utf8')

  console.log(`Generated ${outputPath} from ${recordsPath}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
