import type { OstRecord } from '../types'
import { GENERATED_OST_DATASET_META, GENERATED_OST_TRACKS } from './ost.generated'

const fallbackTracks: OstRecord[] = []

const usingGeneratedData = GENERATED_OST_TRACKS.length > 0

export const OST_TRACKS: OstRecord[] = usingGeneratedData
  ? GENERATED_OST_TRACKS
  : fallbackTracks

export const OST_DATASET_META = {
  ...(usingGeneratedData
    ? GENERATED_OST_DATASET_META
    : {
        version: '0.1.0',
        source: 'starter-empty',
        items: OST_TRACKS.length,
        note:
          'No OST data loaded yet. Add data/raw/hok-ost-source.json and run ingest:ost:all.',
      }),
}
