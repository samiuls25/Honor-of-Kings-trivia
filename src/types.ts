export type GuessTarget =
  | 'hero-name'
  | 'skin-name'
  | 'ost-title'
  | 'hero-identity'
  | 'hero-relationship'
export type SkinDataSource = 'official' | 'qing-en' | 'hybrid'

export type AnswerMode = 'typed' | 'multiple-choice'

export type ScoringStyle =
  | 'five-minute-easy'
  | 'five-minute-hard'
  | 'sudden-death'

export interface GameConfig {
  target: GuessTarget
  skinSource: SkinDataSource
  answerMode: AnswerMode
  scoringStyle: ScoringStyle
}

export interface SkinRecord {
  id: string
  heroId: string
  heroName: string
  heroAliases: string[]
  skinName: string
  skinAliases: string[]
  imageUrl: string
  source: string
}

export interface OstRecord {
  id: string
  trackTitle: string
  trackAliases: string[]
  artistName: string
  artistAliases: string[]
  imageUrl: string
  audioUrl: string
  source: string
}

export interface HeroIdentityRecord {
  id: string
  heroId: string
  heroName: string
  heroAliases: string[]
  identity: string
  energy: string
  height: string
  region: string
  imageUrl: string
  source: string
}

export interface HeroRelationshipRecord {
  id: string
  heroId: string
  heroName: string
  heroImageUrl: string
  relatedHeroId: string
  relatedHeroName: string
  relatedHeroImageUrl: string
  relation: string
  relationScore: number | null
  relationImageUrl: string
  relationDescription: string
  heroAliases: string[]
  relatedHeroAliases: string[]
  source: string
}

export type TriviaRecord =
  | SkinRecord
  | OstRecord
  | HeroIdentityRecord
  | HeroRelationshipRecord

export interface RelationshipHint {
  heroName: string
  heroImageUrl: string
  relation: string
  relationDescription: string
}

export interface Question {
  id: string
  recordId: string
  imageUrl: string
  audioUrl: string | null
  identityHint: string | null
  relationshipHint: RelationshipHint | null
  mediaType: 'image' | 'audio' | 'identity' | 'relationship'
  prompt: string
  target: GuessTarget
  correctAnswer: string
  acceptedAnswers: string[]
  options: string[]
}
