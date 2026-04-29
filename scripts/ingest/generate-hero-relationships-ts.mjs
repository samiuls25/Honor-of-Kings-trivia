import fs from 'node:fs/promises'
import path from 'node:path'

const INPUT_PATH = path.join(
  process.cwd(),
  'data',
  'processed',
  'hero-relationships.normalized.json'
)
const OUTPUT_PATH = path.join(
  process.cwd(),
  'src',
  'data',
  'heroRelationships.generated.ts'
)

const main = async () => {
  const raw = await fs.readFile(INPUT_PATH, 'utf8')
  const payload = JSON.parse(raw)
  const records = payload.records || []
  const meta = payload.meta || {}

  const output = `import type { HeroRelationshipRecord } from '../types'\n\nexport const GENERATED_HERO_RELATIONSHIP_RECORDS: HeroRelationshipRecord[] = ${JSON.stringify(
    records,
    null,
    2
  )}\n\nexport const GENERATED_HERO_RELATIONSHIP_DATASET_META = ${JSON.stringify(
    meta,
    null,
    2
  )} as const\n`

  await fs.writeFile(OUTPUT_PATH, output, 'utf8')

  console.log(`Hero relationship dataset written to ${OUTPUT_PATH}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
