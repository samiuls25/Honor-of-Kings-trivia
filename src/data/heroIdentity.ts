import type { HeroIdentityRecord } from '../types'
import {
  GENERATED_HERO_IDENTITY_DATASET_META,
  GENERATED_HERO_IDENTITY_RECORDS,
} from './heroIdentity.generated'

const fallbackRecords: HeroIdentityRecord[] = []

const usingGeneratedData = GENERATED_HERO_IDENTITY_RECORDS.length > 0

export const HERO_IDENTITY_RECORDS: HeroIdentityRecord[] = usingGeneratedData
  ? GENERATED_HERO_IDENTITY_RECORDS
  : fallbackRecords

export const HERO_IDENTITY_DATASET_META = {
  ...(usingGeneratedData
    ? GENERATED_HERO_IDENTITY_DATASET_META
    : {
        version: '0.1.0',
        source: 'starter-empty',
        items: HERO_IDENTITY_RECORDS.length,
        note:
          'No hero identity data loaded yet. Run ingest:hero-identity:all to enable this mode.',
      }),
}
