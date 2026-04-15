import type {
  GameConfig,
  GuessTarget,
  Question,
  ScoringStyle,
  SkinRecord,
} from '../types'

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}

export function normalizeGuess(input: string): string {
  return input
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function uniqueNormalized(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const normalized = normalizeGuess(value)
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    result.push(value)
  }

  return result
}

function answerForTarget(skin: SkinRecord, target: GuessTarget): string {
  return target === 'hero-name' ? skin.heroName : skin.skinName
}

function acceptedAnswersForTarget(
  skin: SkinRecord,
  target: GuessTarget,
): string[] {
  if (target === 'hero-name') {
    return uniqueNormalized([skin.heroName, ...skin.heroAliases])
  }

  return uniqueNormalized([skin.skinName, ...skin.skinAliases])
}

function candidatesForTarget(pool: SkinRecord[], target: GuessTarget): string[] {
  const values = pool.map((skin) => answerForTarget(skin, target))
  return uniqueNormalized(values)
}

function buildMultipleChoiceOptions(
  correctAnswer: string,
  candidates: string[],
): string[] {
  const normalizedCorrect = normalizeGuess(correctAnswer)
  const distractors = shuffle(
    candidates.filter((candidate) => normalizeGuess(candidate) !== normalizedCorrect),
  ).slice(0, 3)

  return shuffle([correctAnswer, ...distractors])
}

export function createQuestion(
  skin: SkinRecord,
  config: GameConfig,
  pool: SkinRecord[],
): Question {
  const correctAnswer = answerForTarget(skin, config.target)
  const acceptedAnswers = acceptedAnswersForTarget(skin, config.target)
  const prompt =
    config.target === 'hero-name'
      ? 'Which hero owns this skin?'
      : 'What is the skin name shown here?'
  const options =
    config.answerMode === 'multiple-choice'
      ? buildMultipleChoiceOptions(
          correctAnswer,
          candidatesForTarget(pool, config.target),
        )
      : []

  return {
    id: `${skin.id}-${config.target}-${config.answerMode}`,
    skinId: skin.id,
    imageUrl: skin.imageUrl,
    prompt,
    target: config.target,
    correctAnswer,
    acceptedAnswers,
    options,
  }
}

export function isAnswerCorrect(input: string, acceptedAnswers: string[]): boolean {
  const normalizedInput = normalizeGuess(input)
  return acceptedAnswers.some(
    (answer) => normalizeGuess(answer) === normalizedInput,
  )
}

export function getScoreDelta(style: ScoringStyle, isCorrect: boolean): number {
  if (style === 'five-minute-hard') {
    return isCorrect ? 1 : -1
  }

  if (style === 'five-minute-easy') {
    return isCorrect ? 1 : 0
  }

  return isCorrect ? 1 : 0
}

export function shouldEndAfterAnswer(
  style: ScoringStyle,
  isCorrect: boolean,
): boolean {
  return style === 'sudden-death' && !isCorrect
}

export function initialTimeLimitMs(style: ScoringStyle): number | null {
  return style === 'sudden-death' ? null : 5 * 60 * 1000
}

export function formatTimeRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function calculateAccuracy(correct: number, wrong: number): number {
  const attempts = correct + wrong
  if (attempts === 0) {
    return 0
  }
  return Math.round((correct / attempts) * 100)
}

export function nextSkinFromQueue(
  queue: SkinRecord[],
  currentIndex: number,
  currentSkinId: string,
): {
  queue: SkinRecord[]
  queueIndex: number
  nextSkin: SkinRecord
} {
  if (queue.length === 0) {
    throw new Error('Question queue cannot be empty.')
  }

  let queueIndex = currentIndex + 1
  let nextQueue = queue

  if (queueIndex >= queue.length) {
    nextQueue = shuffle([...queue])
    queueIndex = 0

    if (nextQueue.length > 1 && nextQueue[0].id === currentSkinId) {
      ;[nextQueue[0], nextQueue[1]] = [nextQueue[1], nextQueue[0]]
    }
  }

  return {
    queue: nextQueue,
    queueIndex,
    nextSkin: nextQueue[queueIndex],
  }
}

export function validateSkinDataset(skins: SkinRecord[]): string[] {
  const issues: string[] = []
  const ids = new Set<string>()

  for (const skin of skins) {
    if (!skin.id.trim()) {
      issues.push('A skin record is missing an id.')
    }
    if (ids.has(skin.id)) {
      issues.push(`Duplicate skin id found: ${skin.id}`)
    }
    ids.add(skin.id)

    if (!skin.heroName.trim()) {
      issues.push(`Missing hero name for skin ${skin.id}.`)
    }
    if (!skin.skinName.trim()) {
      issues.push(`Missing skin name for skin ${skin.id}.`)
    }
    if (!skin.imageUrl.startsWith('http')) {
      issues.push(`Image URL must be absolute for skin ${skin.id}.`)
    }
  }

  return issues
}
