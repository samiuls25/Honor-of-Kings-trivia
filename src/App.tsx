import { useEffect, useMemo, useRef, useState } from 'react'
import { DATASET_META, SKINS } from './data/skins'
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
  validateSkinDataset,
} from './game/engine'
import type {
  AnswerMode,
  GameConfig,
  GuessTarget,
  Question,
  ScoringStyle,
  SkinRecord,
} from './types'

type EndReason = 'timeout' | 'wrong-answer' | 'manual' | null

interface ActiveGame {
  status: 'playing' | 'ended'
  config: GameConfig
  queue: SkinRecord[]
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
}

const targetOptions: Option<GuessTarget>[] = [
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
  answerMode: 'typed',
  scoringStyle: 'five-minute-easy',
}

function getModeLabel<TValue extends string>(
  options: Option<TValue>[],
  value: TValue,
): string {
  return options.find((option) => option.value === value)?.label ?? value
}

function buildInitialGame(config: GameConfig): ActiveGame {
  const queue = shuffle([...SKINS])
  const firstSkin = queue[0]
  const firstQuestion = createQuestion(firstSkin, config, SKINS)
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
  const [config, setConfig] = useState<GameConfig>(defaultConfig)
  const [game, setGame] = useState<ActiveGame | null>(null)
  const [typedGuess, setTypedGuess] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const feedbackTimeoutRef = useRef<number | null>(null)

  const datasetIssues = useMemo(() => validateSkinDataset(SKINS), [])
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

  const startGame = () => {
    setFeedback(null)
    setTypedGuess('')
    setGame(buildInitialGame(config))
  }

  const startGameFromPreviousConfig = () => {
    if (!game) {
      return
    }
    setFeedback(null)
    setTypedGuess('')
    setConfig(game.config)
    setGame(buildInitialGame(game.config))
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
            previous.question.skinId,
          )

          return {
            ...previous,
            queue,
            queueIndex,
            question: createQuestion(nextSkin, previous.config, SKINS),
          }
        })

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
      </header>

      {datasetIssues.length > 0 && (
        <aside className="dataset-warning" role="alert">
          Dataset checks found {datasetIssues.length} issue(s). Fix data before
          production launch.
        </aside>
      )}

      {!game && (
        <section className="panel">
          <h2>Game Setup</h2>

          <div className="setting-group">
            <h3>Question Target</h3>
            <div className="option-grid two-col">
              {targetOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    config.target === option.value
                      ? 'option-card active'
                      : 'option-card'
                  }
                  onClick={() =>
                    setConfig((previous) => ({
                      ...previous,
                      target: option.value,
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
              Seed dataset: {DATASET_META.items} skins from {DATASET_META.source}.
            </p>
            <button className="primary-button" onClick={startGame}>
              Start Match
            </button>
          </div>
        </section>
      )}

      {game?.status === 'playing' && (
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
            <span>{getModeLabel(answerModeOptions, game.config.answerMode)}</span>
            <span>{getModeLabel(scoringOptions, game.config.scoringStyle)}</span>
          </div>

          <article className="question-card">
            <img
              src={game.question.imageUrl}
              alt={`Skin artwork prompt ${game.question.id}`}
            />
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
                      : 'Type skin name'
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

      {game?.status === 'ended' && (
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
    </div>
  )
}

export default App
