import type { SkinRecord } from '../types'
import { GENERATED_DATASET_META, GENERATED_SKINS } from './skins.generated'
import {
  GENERATED_DATASET_META as GENERATED_QING_DATASET_META,
  GENERATED_SKINS as GENERATED_QING_SKINS,
} from './skins.qing.generated'

type SeedSkin = Omit<SkinRecord, 'imageUrl' | 'source'>

const PALETTES = [
  { bg: '1f2f4a', fg: 'f5ddb0' },
  { bg: '3a244a', fg: 'f7e6c6' },
  { bg: '2d3f2a', fg: 'f4e2b8' },
  { bg: '433020', fg: 'f7dfba' },
]

function buildPlaceholderImage(heroName: string, skinName: string, index: number) {
  const palette = PALETTES[index % PALETTES.length]
  const text = encodeURIComponent(`${heroName} - ${skinName}`)
  return `https://placehold.co/960x540/${palette.bg}/${palette.fg}?text=${text}`
}

const seedSkins: SeedSkin[] = [
  {
    id: 'allain-astral-duelist',
    heroId: 'allain',
    heroName: 'Allain',
    heroAliases: ['alan'],
    skinName: 'Astral Duelist',
    skinAliases: ['astral'],
  },
  {
    id: 'allain-sunrise-vanguard',
    heroId: 'allain',
    heroName: 'Allain',
    heroAliases: ['alan'],
    skinName: 'Sunrise Vanguard',
    skinAliases: ['sunrise'],
  },
  {
    id: 'angela-candy-arcanist',
    heroId: 'angela',
    heroName: 'Angela',
    heroAliases: [],
    skinName: 'Candy Arcanist',
    skinAliases: ['candy'],
  },
  {
    id: 'angela-star-classroom',
    heroId: 'angela',
    heroName: 'Angela',
    heroAliases: [],
    skinName: 'Star Classroom',
    skinAliases: ['classroom star'],
  },
  {
    id: 'arli-lantern-mirage',
    heroId: 'arli',
    heroName: 'Arli',
    heroAliases: [],
    skinName: 'Lantern Mirage',
    skinAliases: ['lantern'],
  },
  {
    id: 'arli-petal-tempest',
    heroId: 'arli',
    heroName: 'Arli',
    heroAliases: [],
    skinName: 'Petal Tempest',
    skinAliases: ['petal'],
  },
  {
    id: 'biron-iron-bastion',
    heroId: 'biron',
    heroName: 'Biron',
    heroAliases: [],
    skinName: 'Iron Bastion',
    skinAliases: ['bastion'],
  },
  {
    id: 'biron-thunderbreaker',
    heroId: 'biron',
    heroName: 'Biron',
    heroAliases: [],
    skinName: 'Thunderbreaker',
    skinAliases: ['thunder breaker'],
  },
  {
    id: 'caiyan-jade-melody',
    heroId: 'cai-yan',
    heroName: 'Cai Yan',
    heroAliases: ['caiyan'],
    skinName: 'Jade Melody',
    skinAliases: ['jade'],
  },
  {
    id: 'caiyan-moonlit-zither',
    heroId: 'cai-yan',
    heroName: 'Cai Yan',
    heroAliases: ['caiyan'],
    skinName: 'Moonlit Zither',
    skinAliases: ['zither'],
  },
  {
    id: 'consortyu-crimson-hawk',
    heroId: 'consort-yu',
    heroName: 'Consort Yu',
    heroAliases: ['yu'],
    skinName: 'Crimson Hawk',
    skinAliases: ['crimson'],
  },
  {
    id: 'consortyu-royal-archer',
    heroId: 'consort-yu',
    heroName: 'Consort Yu',
    heroAliases: ['yu'],
    skinName: 'Royal Archer',
    skinAliases: ['royal'],
  },
  {
    id: 'daqiao-tidal-court',
    heroId: 'da-qiao',
    heroName: 'Da Qiao',
    heroAliases: ['daqiao'],
    skinName: 'Tidal Court',
    skinAliases: ['tidal'],
  },
  {
    id: 'daqiao-azure-bloom',
    heroId: 'da-qiao',
    heroName: 'Da Qiao',
    heroAliases: ['daqiao'],
    skinName: 'Azure Bloom',
    skinAliases: ['azure'],
  },
  {
    id: 'dharma-temple-guardian',
    heroId: 'dharma',
    heroName: 'Dharma',
    heroAliases: [],
    skinName: 'Temple Guardian',
    skinAliases: ['temple'],
  },
  {
    id: 'dharma-sandstorm-vow',
    heroId: 'dharma',
    heroName: 'Dharma',
    heroAliases: [],
    skinName: 'Sandstorm Vow',
    skinAliases: ['sandstorm'],
  },
  {
    id: 'diaochan-frost-waltz',
    heroId: 'diao-chan',
    heroName: 'Diao Chan',
    heroAliases: ['diaochan'],
    skinName: 'Frost Waltz',
    skinAliases: ['frost'],
  },
  {
    id: 'diaochan-blossom-reverie',
    heroId: 'diao-chan',
    heroName: 'Diao Chan',
    heroAliases: ['diaochan'],
    skinName: 'Blossom Reverie',
    skinAliases: ['reverie'],
  },
  {
    id: 'dolia-coral-whisper',
    heroId: 'dolia',
    heroName: 'Dolia',
    heroAliases: [],
    skinName: 'Coral Whisper',
    skinAliases: ['coral'],
  },
  {
    id: 'dolia-ocean-cantata',
    heroId: 'dolia',
    heroName: 'Dolia',
    heroAliases: [],
    skinName: 'Ocean Cantata',
    skinAliases: ['cantata'],
  },
  {
    id: 'erin-forest-warden',
    heroId: 'erin',
    heroName: 'Erin',
    heroAliases: [],
    skinName: 'Forest Warden',
    skinAliases: ['forest'],
  },
  {
    id: 'erin-emerald-oath',
    heroId: 'erin',
    heroName: 'Erin',
    heroAliases: [],
    skinName: 'Emerald Oath',
    skinAliases: ['emerald'],
  },
  {
    id: 'fang-night-pursuit',
    heroId: 'fang',
    heroName: 'Fang',
    heroAliases: [],
    skinName: 'Night Pursuit',
    skinAliases: ['night'],
  },
  {
    id: 'fang-city-phantom',
    heroId: 'fang',
    heroName: 'Fang',
    heroAliases: [],
    skinName: 'City Phantom',
    skinAliases: ['phantom'],
  },
  {
    id: 'ganandmo-twin-eclipse',
    heroId: 'gan-and-mo',
    heroName: 'Gan and Mo',
    heroAliases: ['gan & mo', 'gan mo'],
    skinName: 'Twin Eclipse',
    skinAliases: ['eclipse'],
  },
  {
    id: 'ganandmo-arcane-resonance',
    heroId: 'gan-and-mo',
    heroName: 'Gan and Mo',
    heroAliases: ['gan & mo', 'gan mo'],
    skinName: 'Arcane Resonance',
    skinAliases: ['resonance'],
  },
  {
    id: 'heino-clockwork-scholar',
    heroId: 'heino',
    heroName: 'Heino',
    heroAliases: [],
    skinName: 'Clockwork Scholar',
    skinAliases: ['clockwork'],
  },
  {
    id: 'heino-infinity-prism',
    heroId: 'heino',
    heroName: 'Heino',
    heroAliases: [],
    skinName: 'Infinity Prism',
    skinAliases: ['prism'],
  },
  {
    id: 'luban7-rocket-workshop',
    heroId: 'luban-no-7',
    heroName: 'Luban No.7',
    heroAliases: ['luban 7', 'luban no 7'],
    skinName: 'Rocket Workshop',
    skinAliases: ['rocket'],
  },
  {
    id: 'luban7-neon-inventor',
    heroId: 'luban-no-7',
    heroName: 'Luban No.7',
    heroAliases: ['luban 7', 'luban no 7'],
    skinName: 'Neon Inventor',
    skinAliases: ['inventor'],
  },
]

const fallbackSkins: SkinRecord[] = seedSkins.map((skin, index) => ({
  ...skin,
  imageUrl: buildPlaceholderImage(skin.heroName, skin.skinName, index),
  source: 'starter-curated-v1',
}))

function normalizeKey(value: string) {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function looksPlayableInEnglish(value: string): boolean {
  return /[a-z]/i.test(value)
}

function skinPairKey(skin: SkinRecord): string {
  return `${normalizeKey(skin.heroName)}|${normalizeKey(skin.skinName)}`
}

function mergeQingBackfill(primary: SkinRecord[], fallback: SkinRecord[]) {
  const seenKeys = new Set(primary.map((skin) => skinPairKey(skin)))
  const merged = [...primary]
  let added = 0
  let skippedNonEnglish = 0

  for (const candidate of fallback) {
    const key = skinPairKey(candidate)

    if (seenKeys.has(key)) {
      continue
    }

    if (!looksPlayableInEnglish(candidate.heroName + candidate.skinName)) {
      skippedNonEnglish += 1
      continue
    }

    seenKeys.add(key)
    merged.push(candidate)
    added += 1
  }

  return {
    merged,
    added,
    skippedNonEnglish,
  }
}

const usingGeneratedData = GENERATED_SKINS.length > 0

const primarySkins = usingGeneratedData ? GENERATED_SKINS : fallbackSkins
const qingSkins = GENERATED_QING_SKINS
const qingBackfill = mergeQingBackfill(primarySkins, GENERATED_QING_SKINS)
const hybridSkins = qingBackfill.merged

export const SKINS_OFFICIAL: SkinRecord[] = primarySkins
export const SKINS_QING: SkinRecord[] = qingSkins
export const SKINS_HYBRID: SkinRecord[] = hybridSkins

// Keep a default export path for callers that expect a single array.
export const SKINS: SkinRecord[] = SKINS_OFFICIAL

const primaryMeta = usingGeneratedData
  ? GENERATED_DATASET_META
  : {
      version: '0.1.0',
      source: 'starter-curated-v1',
      items: primarySkins.length,
      note:
        'Starter fan dataset using placeholders; replace with official mappings via ingestion pipeline.',
    }

export const DATASET_META = {
  ...primaryMeta,
  itemsPrimary: primarySkins.length,
  items: SKINS_OFFICIAL.length,
  qing: {
    source: GENERATED_QING_DATASET_META.source,
    items: GENERATED_QING_DATASET_META.items,
    backfillAdded: qingBackfill.added,
    skippedNonEnglish: qingBackfill.skippedNonEnglish,
  },
}

export const SKIN_SOURCE_META = {
  official: {
    source: primaryMeta.source,
    items: SKINS_OFFICIAL.length,
  },
  'qing-en': {
    source: GENERATED_QING_DATASET_META.source,
    items: SKINS_QING.length,
  },
  hybrid: {
    source: `${primaryMeta.source}+${GENERATED_QING_DATASET_META.source}`,
    items: SKINS_HYBRID.length,
    backfillAdded: qingBackfill.added,
  },
} as const
