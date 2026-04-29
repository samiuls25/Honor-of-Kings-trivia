import type { HeroRelationshipRecord } from '../types'
import {
  GENERATED_HERO_RELATIONSHIP_DATASET_META,
  GENERATED_HERO_RELATIONSHIP_RECORDS,
} from './heroRelationships.generated'

const fallbackRecords: HeroRelationshipRecord[] = []

const usingGeneratedData = GENERATED_HERO_RELATIONSHIP_RECORDS.length > 0

export const HERO_RELATIONSHIP_RECORDS: HeroRelationshipRecord[] = usingGeneratedData
  ? GENERATED_HERO_RELATIONSHIP_RECORDS
  : fallbackRecords

export const HERO_RELATIONSHIP_DATASET_META = {
  ...(usingGeneratedData
    ? GENERATED_HERO_RELATIONSHIP_DATASET_META
    : {
        version: '0.1.0',
        source: 'starter-empty',
        items: HERO_RELATIONSHIP_RECORDS.length,
        note:
          'No hero relationship data loaded yet. Run ingest:hero-relationships:all to enable this mode.',
      }),
} as const
