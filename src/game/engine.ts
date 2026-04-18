import type {
  GameConfig,
  GuessTarget,
  OstRecord,
  Question,
  ScoringStyle,
  SkinRecord,
  TriviaRecord,
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

function levenshteinDistanceWithinLimit(left: string, right: string, limit: number): number {
  if (left === right) {
    return 0
  }

  const leftLength = left.length
  const rightLength = right.length

  if (Math.abs(leftLength - rightLength) > limit) {
    return limit + 1
  }

  const previous = new Array<number>(rightLength + 1)
  const current = new Array<number>(rightLength + 1)

  for (let index = 0; index <= rightLength; index += 1) {
    previous[index] = index
  }

  for (let row = 1; row <= leftLength; row += 1) {
    current[0] = row
    let minInRow = current[0]

    for (let column = 1; column <= rightLength; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + substitutionCost,
      )

      if (current[column] < minInRow) {
        minInRow = current[column]
      }
    }

    if (minInRow > limit) {
      return limit + 1
    }

    for (let index = 0; index <= rightLength; index += 1) {
      previous[index] = current[index]
    }
  }

  return previous[rightLength]
}

function abbreviationFor(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((token) => token[0])
    .join('')
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

function isSkinRecord(record: TriviaRecord): record is SkinRecord {
  return 'heroName' in record && 'skinName' in record
}

function isOstRecord(record: TriviaRecord): record is OstRecord {
  return 'trackTitle' in record && 'audioUrl' in record
}

function answerForTarget(record: TriviaRecord, target: GuessTarget): string {
  if (target === 'ost-title') {
    return isOstRecord(record) ? record.trackTitle : ''
  }

  if (!isSkinRecord(record)) {
    return ''
  }

  return target === 'hero-name' ? record.heroName : record.skinName
}

function acceptedAnswersForTarget(record: TriviaRecord, target: GuessTarget): string[] {
  if (target === 'ost-title') {
    if (!isOstRecord(record)) {
      return []
    }
    return uniqueNormalized([record.trackTitle, ...record.trackAliases])
  }

  if (!isSkinRecord(record)) {
    return []
  }

  if (target === 'hero-name') {
    return uniqueNormalized([record.heroName, ...record.heroAliases])
  }

  return uniqueNormalized([record.skinName, ...record.skinAliases])
}

function candidatesForTarget(pool: TriviaRecord[], target: GuessTarget): string[] {
  const values = pool
    .map((record) => answerForTarget(record, target))
    .filter((value) => value.trim().length > 0)
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
  record: TriviaRecord,
  config: GameConfig,
  pool: TriviaRecord[],
): Question {
  const correctAnswer = answerForTarget(record, config.target)
  const acceptedAnswers = acceptedAnswersForTarget(record, config.target)

  const prompt = (() => {
    if (config.target === 'hero-name') {
      return 'Which hero owns this skin?'
    }
    if (config.target === 'skin-name') {
      return 'What is the skin name shown here?'
    }
    return 'What is the title of this Honor of Kings track?'
  })()

  const options =
    config.answerMode === 'multiple-choice'
      ? buildMultipleChoiceOptions(
          correctAnswer,
          candidatesForTarget(pool, config.target),
        )
      : []

  const mediaType = isOstRecord(record) ? 'audio' : 'image'
  const audioUrl = isOstRecord(record) ? record.audioUrl : null

  return {
    id: `${record.id}-${config.target}-${config.answerMode}`,
    recordId: record.id,
    imageUrl: record.imageUrl,
    audioUrl,
    mediaType,
    prompt,
    target: config.target,
    correctAnswer,
    acceptedAnswers,
    options,
  }
}

export function isAnswerCorrect(input: string, acceptedAnswers: string[]): boolean {
  const normalizedInput = normalizeGuess(input)
  if (!normalizedInput) {
    return false
  }

  const normalizedAccepted = acceptedAnswers
    .map((answer) => normalizeGuess(answer))
    .filter(Boolean)

  if (normalizedAccepted.some((answer) => answer === normalizedInput)) {
    return true
  }

  if (
    normalizedInput.length >= 4 &&
    normalizedAccepted.some((answer) => answer.startsWith(normalizedInput))
  ) {
    return true
  }

  if (
    normalizedInput.length >= 2 &&
    normalizedAccepted.some((answer) => {
      const abbreviation = abbreviationFor(answer)
      return abbreviation.length >= normalizedInput.length && abbreviation.startsWith(normalizedInput)
    })
  ) {
    return true
  }

  return normalizedAccepted.some((answer) => {
    const maxLength = Math.max(answer.length, normalizedInput.length)
    const typoLimit = maxLength >= 11 ? 2 : maxLength >= 6 ? 1 : 0

    if (typoLimit === 0) {
      return false
    }

    return levenshteinDistanceWithinLimit(normalizedInput, answer, typoLimit) <= typoLimit
  })
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

export function nextSkinFromQueue<TRecord extends { id: string }>(
  queue: TRecord[],
  currentIndex: number,
  currentRecordId: string,
): {
  queue: TRecord[]
  queueIndex: number
  nextSkin: TRecord
} {
  if (queue.length === 0) {
    throw new Error('Question queue cannot be empty.')
  }

  let queueIndex = currentIndex + 1
  let nextQueue = queue

  if (queueIndex >= queue.length) {
    nextQueue = shuffle([...queue])
    queueIndex = 0

    if (nextQueue.length > 1 && nextQueue[0].id === currentRecordId) {
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

export function validateOstDataset(records: OstRecord[]): string[] {
  const issues: string[] = []
  const ids = new Set<string>()

  for (const record of records) {
    if (!record.id.trim()) {
      issues.push('An OST record is missing an id.')
    }
    if (ids.has(record.id)) {
      issues.push(`Duplicate OST id found: ${record.id}`)
    }
    ids.add(record.id)

    if (!record.trackTitle.trim()) {
      issues.push(`Missing track title for OST ${record.id}.`)
    }
    if (!record.artistName.trim()) {
      issues.push(`Missing artist name for OST ${record.id}.`)
    }
    if (!record.imageUrl.startsWith('http')) {
      issues.push(`Image URL must be absolute for OST ${record.id}.`)
    }
    if (!record.audioUrl.startsWith('http')) {
      issues.push(`Audio URL must be absolute for OST ${record.id}.`)
    }
  }

  return issues
}
