export type GuessTarget = 'hero-name' | 'skin-name' | 'ost-title'

export type AnswerMode = 'typed' | 'multiple-choice'

export type ScoringStyle =
  | 'five-minute-easy'
  | 'five-minute-hard'
  | 'sudden-death'

export interface GameConfig {
  target: GuessTarget
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

export type TriviaRecord = SkinRecord | OstRecord

export interface Question {
  id: string
  recordId: string
  imageUrl: string
  audioUrl: string | null
  mediaType: 'image' | 'audio'
  prompt: string
  target: GuessTarget
  correctAnswer: string
  acceptedAnswers: string[]
  options: string[]
}
