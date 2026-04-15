export type GuessTarget = 'hero-name' | 'skin-name'

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

export interface Question {
  id: string
  skinId: string
  imageUrl: string
  prompt: string
  target: GuessTarget
  correctAnswer: string
  acceptedAnswers: string[]
  options: string[]
}
