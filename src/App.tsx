import { useEffect, useMemo, useRef, useState } from 'react'
import { OST_DATASET_META, OST_TRACKS } from './data/ost'
import {
  SKINS_HYBRID,
  SKINS_OFFICIAL,
  SKINS_QING,
  SKIN_SOURCE_META,
} from './data/skins'
import {
  calculateAccuracy,
  createQuestion,
  formatTimeRemaining,
  getScoreDelta,
  initialTimeLimitMs,
  isAnswerCorrect,
  nextSkinFromQueue,
  shouldEndAfterAnswer,
  shuffle,
  validateOstDataset,
  validateSkinDataset,
} from './game/engine'
import type {
  AnswerMode,
  GameConfig,
  GuessTarget,
  Question,
  ScoringStyle,
  SkinDataSource,
  SkinRecord,
  TriviaRecord,
} from './types'

type EndReason = 'timeout' | 'wrong-answer' | 'manual' | null

interface ActiveGame {
  status: 'playing' | 'ended'
  config: GameConfig
  queue: TriviaRecord[]
  queueIndex: number
  question: Question
  score: number
  correct: number
  wrong: number
  streak: number
  bestStreak: number
  deadlineMs: number | null
  timeRemainingMs: number | null
  endReason: EndReason
}

interface Option<TValue extends string> {
  value: TValue
  label: string
  description: string
  disabled?: boolean
}

type ViewMode = 'play' | 'gallery'

function buildTargetOptions(hasOstTracks: boolean): Option<GuessTarget>[] {
  return [
    {
      value: 'hero-name',
      label: 'Guess Hero Name',
      description: 'A skin image is shown. Identify the hero who owns it.',
    },
    {
      value: 'skin-name',
      label: 'Guess Skin Name',
      description: 'A skin image is shown. Identify the skin title.',
    },
    {
      value: 'ost-title',
      label: 'Guess OST Track',
      description: hasOstTracks
        ? 'An embedded track is played. Identify the track title.'
        : 'Load OST data first (run ingest:ost:all) to enable this mode.',
      disabled: !hasOstTracks,
    },
  ]
}

const skinSourceOptions: Option<SkinDataSource>[] = [
  {
    value: 'official',
    label: 'Official Capture (Recommended)',
    description: 'Best image quality and naming consistency from world.honorofkings capture.',
  },
  {
    value: 'qing-en',
    label: 'Qing API (Translated)',
    description: 'Expanded list translated to English from qing API source.',
  },
  {
    value: 'hybrid',
    label: 'Hybrid Backfill',
    description: 'Official dataset plus extra entries from translated qing backfill.',
  },
]

const answerModeOptions: Option<AnswerMode>[] = [
  {
    value: 'typed',
    label: 'Typed Entry',
    description: 'Type your guess and submit. Answers are case-insensitive.',
  },
  {
    value: 'multiple-choice',
    label: 'Multiple Choice',
    description: 'Pick one option from four possible answers.',
  },
]

const scoringOptions: Option<ScoringStyle>[] = [
  {
    value: 'five-minute-easy',
    label: '5 Minute Easy',
    description: '+1 for correct, no penalty for wrong answers.',
  },
  {
    value: 'five-minute-hard',
    label: '5 Minute Hard',
    description: '+1 for correct and -1 for each wrong answer.',
  },
  {
    value: 'sudden-death',
    label: 'Sudden Death',
    description: 'Guess until your first wrong answer.',
  },
]

const defaultConfig: GameConfig = {
  target: 'hero-name',
  skinSource: 'official',
  answerMode: 'multiple-choice',
  scoringStyle: 'five-minute-easy',
}

function getModeLabel<TValue extends string>(
  options: Option<TValue>[],
  value: TValue,
): string {
  return options.find((option) => option.value === value)?.label ?? value
}

function skinPoolForSource(source: SkinDataSource): SkinRecord[] {
  if (source === 'qing-en') {
    return SKINS_QING
  }

  if (source === 'hybrid') {
    return SKINS_HYBRID
  }

  return SKINS_OFFICIAL
}

function poolForTarget(target: GuessTarget, skinSource: SkinDataSource): TriviaRecord[] {
  return target === 'ost-title' ? OST_TRACKS : skinPoolForSource(skinSource)
}

function buildInitialGame(config: GameConfig): ActiveGame {
  const pool = poolForTarget(config.target, config.skinSource)
  if (pool.length === 0) {
    throw new Error('No records available for this mode yet.')
  }

  const queue = shuffle([...pool])
  const firstRecord = queue[0]
  const firstQuestion = createQuestion(firstRecord, config, pool)
  const initialLimit = initialTimeLimitMs(config.scoringStyle)

  return {
    status: 'playing',
    config,
    queue,
    queueIndex: 0,
    question: firstQuestion,
    score: 0,
    correct: 0,
    wrong: 0,
    streak: 0,
    bestStreak: 0,
    deadlineMs: initialLimit ? Date.now() + initialLimit : null,
    timeRemainingMs: initialLimit,
    endReason: null,
  }
}

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('play')
  const [config, setConfig] = useState<GameConfig>(defaultConfig)
  const [game, setGame] = useState<ActiveGame | null>(null)
  const [typedGuess, setTypedGuess] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [showOstArtwork, setShowOstArtwork] = useState(false)
  const [selectedGallerySkin, setSelectedGallerySkin] = useState<SkinRecord | null>(
    null,
  )
  const feedbackTimeoutRef = useRef<number | null>(null)

  const hasOstTracks = OST_TRACKS.length > 0
  const targetOptions = useMemo(() => buildTargetOptions(hasOstTracks), [hasOstTracks])
  const selectedSkinPool = useMemo(
    () => skinPoolForSource(config.skinSource),
    [config.skinSource],
  )
  const skinDatasetIssues = useMemo(
    () => validateSkinDataset(selectedSkinPool),
    [selectedSkinPool],
  )
  const ostDatasetIssues = useMemo(() => validateOstDataset(OST_TRACKS), [])
  const datasetIssues = useMemo(
    () => [...skinDatasetIssues, ...ostDatasetIssues.map((issue) => `OST: ${issue}`)],
    [ostDatasetIssues, skinDatasetIssues],
  )
  const gallerySkins = useMemo(
    () =>
      [...selectedSkinPool].sort(
        (left, right) =>
          left.heroName.localeCompare(right.heroName) ||
          left.skinName.localeCompare(right.skinName),
      ),
    [selectedSkinPool],
  )
  const gameStatus = game?.status ?? 'ended'
  const gameDeadlineMs = game?.deadlineMs ?? null

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current !== null) {
        window.clearTimeout(feedbackTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (gameStatus !== 'playing' || gameDeadlineMs === null) {
      return
    }

    const timerId = window.setInterval(() => {
      setGame((previous) => {
        if (!previous || previous.status !== 'playing' || previous.deadlineMs === null) {
          return previous
        }

        const remaining = Math.max(0, previous.deadlineMs - Date.now())
        if (remaining <= 0) {
          return {
            ...previous,
            status: 'ended',
            timeRemainingMs: 0,
            endReason: 'timeout',
          }
        }

        return {
          ...previous,
          timeRemainingMs: remaining,
        }
      })
    }, 150)

    return () => {
      window.clearInterval(timerId)
    }
  }, [gameStatus, gameDeadlineMs])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedGallerySkin(null)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const startGame = () => {
    setFeedback(null)
    setSetupError(null)
    setTypedGuess('')
    setShowOstArtwork(false)

    const selectedTarget = targetOptions.find((option) => option.value === config.target)
    if (selectedTarget?.disabled) {
      setSetupError('This mode is disabled until OST data is loaded.')
      return
    }

    try {
      setGame(buildInitialGame(config))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start this mode.'
      setSetupError(message)
    }
  }

  const startGameFromPreviousConfig = () => {
    if (!game) {
      return
    }
    setFeedback(null)
    setSetupError(null)
    setTypedGuess('')
    setConfig(game.config)
    setShowOstArtwork(false)

    const selectedTarget = targetOptions.find((option) => option.value === game.config.target)
    if (selectedTarget?.disabled) {
      setSetupError('This mode is disabled until OST data is loaded.')
      return
    }

    try {
      setGame(buildInitialGame(game.config))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start this mode.'
      setSetupError(message)
    }
  }

  const stopGame = () => {
    setGame((previous) => {
      if (!previous || previous.status !== 'playing') {
        return previous
      }

      return {
        ...previous,
        status: 'ended',
        endReason: 'manual',
      }
    })
  }

  const openGallery = () => {
    setViewMode('gallery')
    setGame(null)
    setFeedback(null)
    setSetupError(null)
    setTypedGuess('')
    setSelectedGallerySkin(null)
  }

  const openPlay = () => {
    setViewMode('play')
    setSetupError(null)
    setSelectedGallerySkin(null)
  }

  const submitAnswer = (rawGuess: string) => {
    if (!game || game.status !== 'playing' || feedback) {
      return
    }

    const trimmedGuess = rawGuess.trim()
    if (!trimmedGuess) {
      return
    }

    const isCorrect = isAnswerCorrect(trimmedGuess, game.question.acceptedAnswers)
    const scoreDelta = getScoreDelta(game.config.scoringStyle, isCorrect)
    const endOnWrong = shouldEndAfterAnswer(game.config.scoringStyle, isCorrect)

    setGame((previous) => {
      if (!previous || previous.status !== 'playing') {
        return previous
      }

      const correct = previous.correct + (isCorrect ? 1 : 0)
      const wrong = previous.wrong + (isCorrect ? 0 : 1)
      const streak = isCorrect ? previous.streak + 1 : 0
      const bestStreak = Math.max(previous.bestStreak, streak)

      if (endOnWrong) {
        return {
          ...previous,
          status: 'ended',
          score: previous.score + scoreDelta,
          correct,
          wrong,
          streak,
          bestStreak,
          endReason: 'wrong-answer',
        }
      }

      return {
        ...previous,
        score: previous.score + scoreDelta,
        correct,
        wrong,
        streak,
        bestStreak,
      }
    })

    setTypedGuess('')
    setFeedback(
      isCorrect
        ? 'Correct! +1 point.'
        : `Wrong. Correct answer: ${game.question.correctAnswer}`,
    )

    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current)
    }

    if (!endOnWrong) {
      feedbackTimeoutRef.current = window.setTimeout(() => {
        setGame((previous) => {
          if (!previous || previous.status !== 'playing') {
            return previous
          }

          const { queue, queueIndex, nextSkin } = nextSkinFromQueue(
            previous.queue,
            previous.queueIndex,
            previous.question.recordId,
          )

          return {
            ...previous,
            queue,
            queueIndex,
            question: createQuestion(nextSkin, previous.config, previous.queue),
          }
        })

        setShowOstArtwork(false)
        setFeedback(null)
      }, 850)
    }
  }

  const endReasonLabel =
    game?.endReason === 'timeout'
      ? 'Time expired.'
      : game?.endReason === 'wrong-answer'
        ? 'Run ended on your first wrong answer.'
        : game?.endReason === 'manual'
          ? 'Game ended by player.'
          : 'Session complete.'

  return (
    <div className="app-shell">
      <header className="masthead">
        <p className="eyebrow">V1.0</p>
        <h1>Honor of Kings Trivia</h1>
        <p className="lede">
          Guess heroes or skin names from the displayed art. Mix input mode,
          category mode, and scoring style for different challenge paths!
        </p>

        <div className="view-switch" role="tablist" aria-label="App sections">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'play'}
            className={
              viewMode === 'play' ? 'switch-button active' : 'switch-button'
            }
            onClick={openPlay}
          >
            Play Trivia
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'gallery'}
            className={
              viewMode === 'gallery' ? 'switch-button active' : 'switch-button'
            }
            onClick={openGallery}
          >
            Skin Gallery
          </button>
        </div>
      </header>

      {datasetIssues.length > 0 && (
        <aside className="dataset-warning" role="alert">
          Dataset checks found {datasetIssues.length} issue(s). Fix data before
          production launch.
        </aside>
      )}

      {viewMode === 'play' && !game && (
        <section className="panel">
          <h2>Game Setup</h2>

          <div className="setting-group">
            <h3>Question Target</h3>
            <div className="option-grid two-col">
              {targetOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled}
                  className={[
                    config.target === option.value ? 'option-card active' : 'option-card',
                    option.value === 'ost-title' ? 'option-card-ost' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() =>
                    setConfig((previous) => {
                      if (option.disabled) {
                        return previous
                      }

                      setSetupError(null)
                      return {
                        ...previous,
                        target: option.value,
                      }
                    })
                  }
                >
                  <span className="title">{option.label}</span>
                  <span className="description">{option.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="setting-group">
            <h3>Skin Dataset Source</h3>
            <div className="option-grid">
              {skinSourceOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    config.skinSource === option.value
                      ? 'option-card active'
                      : 'option-card'
                  }
                  onClick={() =>
                    setConfig((previous) => ({
                      ...previous,
                      skinSource: option.value,
                    }))
                  }
                >
                  <span className="title">{option.label}</span>
                  <span className="description">{option.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="setting-group">
            <h3>Answer Mode</h3>
            <div className="option-grid two-col">
              {answerModeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    config.answerMode === option.value
                      ? 'option-card active'
                      : 'option-card'
                  }
                  onClick={() =>
                    setConfig((previous) => ({
                      ...previous,
                      answerMode: option.value,
                    }))
                  }
                >
                  <span className="title">{option.label}</span>
                  <span className="description">{option.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="setting-group">
            <h3>Scoring Style</h3>
            <div className="option-grid">
              {scoringOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    config.scoringStyle === option.value
                      ? 'option-card active'
                      : 'option-card'
                  }
                  onClick={() =>
                    setConfig((previous) => ({
                      ...previous,
                      scoringStyle: option.value,
                    }))
                  }
                >
                  <span className="title">{option.label}</span>
                  <span className="description">{option.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="setup-footer">
            <p>
              Selected skin source: {getModeLabel(skinSourceOptions, config.skinSource)}
              {' '}({SKIN_SOURCE_META[config.skinSource].items} entries).
            </p>
            <p>
              OST dataset: {OST_DATASET_META.items} tracks from {OST_DATASET_META.source}.
            </p>
            <button className="primary-button" onClick={startGame}>
              Start Match
            </button>
          </div>

          {setupError && <p className="result-subtitle setup-error">{setupError}</p>}
        </section>
      )}

      {viewMode === 'play' && game?.status === 'playing' && (
        <section className="panel play-area">
          <div className="hud">
            <div className="chip">Score: {game.score}</div>
            <div className="chip">Correct: {game.correct}</div>
            <div className="chip">Wrong: {game.wrong}</div>
            <div className="chip">Streak: {game.streak}</div>
            {game.timeRemainingMs !== null && (
              <div className="chip timer-chip">
                Time: {formatTimeRemaining(game.timeRemainingMs)}
              </div>
            )}
          </div>

          <div className="mode-row">
            <span>{getModeLabel(targetOptions, game.config.target)}</span>
            {game.config.target !== 'ost-title' && (
              <span>{getModeLabel(skinSourceOptions, game.config.skinSource)}</span>
            )}
            <span>{getModeLabel(answerModeOptions, game.config.answerMode)}</span>
            <span>{getModeLabel(scoringOptions, game.config.scoringStyle)}</span>
          </div>

          <article className="question-card">
            {game.question.mediaType === 'image' && (
              <img
                src={game.question.imageUrl}
                alt={`Skin artwork prompt ${game.question.id}`}
              />
            )}

            {game.question.mediaType === 'audio' && (
              <div className="audio-stage">
                {game.question.audioUrl ? (
                  <iframe
                    src={game.question.audioUrl}
                    title={`OST player ${game.question.id}`}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                ) : (
                  <p className="result-subtitle">
                    Audio player URL missing for this track.
                  </p>
                )}

                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setShowOstArtwork((previous) => !previous)}
                >
                  {showOstArtwork ? 'Hide Track Artwork' : 'Show Track Artwork'}
                </button>

                {showOstArtwork && (
                  <img
                    src={game.question.imageUrl}
                    alt={`Track artwork prompt ${game.question.id}`}
                  />
                )}
              </div>
            )}

            <h2>{game.question.prompt}</h2>

            {game.config.answerMode === 'typed' && (
              <form
                className="typed-answer"
                onSubmit={(event) => {
                  event.preventDefault()
                  submitAnswer(typedGuess)
                }}
              >
                <input
                  value={typedGuess}
                  onChange={(event) => setTypedGuess(event.target.value)}
                  placeholder={
                    game.config.target === 'hero-name'
                      ? 'Type hero name'
                      : game.config.target === 'skin-name'
                        ? 'Type skin name'
                        : 'Type track title'
                  }
                  autoFocus
                />
                <button
                  className="primary-button"
                  disabled={!typedGuess.trim() || Boolean(feedback)}
                  type="submit"
                >
                  Submit
                </button>
              </form>
            )}

            {game.config.answerMode === 'multiple-choice' && (
              <div className="option-grid two-col">
                {game.question.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="option-card"
                    disabled={Boolean(feedback)}
                    onClick={() => submitAnswer(option)}
                  >
                    <span className="title">{option}</span>
                  </button>
                ))}
              </div>
            )}

            {feedback && <p className="feedback">{feedback}</p>}
          </article>

          <div className="play-actions">
            <button type="button" className="ghost-button" onClick={stopGame}>
              End Match
            </button>
          </div>
        </section>
      )}

      {viewMode === 'play' && game?.status === 'ended' && (
        <section className="panel">
          <h2>Results</h2>
          <p className="result-subtitle">{endReasonLabel}</p>

          <div className="results-grid">
            <div className="result-item">
              <span>Score</span>
              <strong>{game.score}</strong>
            </div>
            <div className="result-item">
              <span>Correct</span>
              <strong>{game.correct}</strong>
            </div>
            <div className="result-item">
              <span>Wrong</span>
              <strong>{game.wrong}</strong>
            </div>
            <div className="result-item">
              <span>Accuracy</span>
              <strong>{calculateAccuracy(game.correct, game.wrong)}%</strong>
            </div>
            <div className="result-item">
              <span>Best Streak</span>
              <strong>{game.bestStreak}</strong>
            </div>
          </div>

          <div className="results-actions">
            <button className="primary-button" onClick={startGameFromPreviousConfig}>
              Play Again
            </button>
            <button
              className="ghost-button"
              onClick={() => {
                setGame(null)
                setFeedback(null)
                setTypedGuess('')
              }}
            >
              Change Modes
            </button>
          </div>
        </section>
      )}

      {viewMode === 'gallery' && (
        <section className="panel gallery-panel">
          <div className="gallery-head">
            <h2>Skin Gallery</h2>
            <p className="result-subtitle">
              Browse skin artwork from the selected source.
            </p>
            <div className="chip">Items: {gallerySkins.length}</div>
          </div>

          <div className="option-grid">
            {skinSourceOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={
                  config.skinSource === option.value
                    ? 'option-card active'
                    : 'option-card'
                }
                onClick={() =>
                  setConfig((previous) => ({
                    ...previous,
                    skinSource: option.value,
                  }))
                }
              >
                <span className="title">{option.label}</span>
                <span className="description">
                  {option.description} ({SKIN_SOURCE_META[option.value].items} entries)
                </span>
              </button>
            ))}
          </div>

          <div className="gallery-grid">
            {gallerySkins.map((skin) => (
              <article key={skin.id} className="gallery-card">
                <button
                  type="button"
                  className="gallery-card-button"
                  onClick={() => setSelectedGallerySkin(skin)}
                >
                  <img
                    src={skin.imageUrl}
                    alt={`${skin.heroName} - ${skin.skinName}`}
                    loading="lazy"
                  />
                  <div className="gallery-meta">
                    <p className="gallery-skin">{skin.skinName}</p>
                    <p className="gallery-hero">{skin.heroName}</p>
                  </div>
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {selectedGallerySkin && (
        <div
          className="gallery-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Skin preview"
          onClick={() => setSelectedGallerySkin(null)}
        >
          <div
            className="gallery-lightbox-card"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="gallery-lightbox-close"
              onClick={() => setSelectedGallerySkin(null)}
            >
              Close
            </button>
            <img
              src={selectedGallerySkin.imageUrl}
              alt={`${selectedGallerySkin.heroName} - ${selectedGallerySkin.skinName}`}
            />
            <div className="gallery-lightbox-meta">
              <p>{selectedGallerySkin.skinName}</p>
              <p>{selectedGallerySkin.heroName}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
