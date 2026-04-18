import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  shouldEndAfterAnswer,
  shuffle,
  validateOstDataset,
  validateSkinDataset,
} from './game/engine'
import {
  detectSharedVisitCategory,
  fetchMetricsSummary,
  formatCompactCount,
  trackMetricEvent,
} from './metrics'
import type {
  AnswerMode,
  GameConfig,
  GuessTarget,
  OstRecord,
  Question,
  ScoringStyle,
  SkinDataSource,
  SkinRecord,
  TriviaRecord,
} from './types'

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement,
        config: {
          height: string
          width: string
          videoId: string
          playerVars?: Record<string, number>
          events?: {
            onReady?: (event: { target: YtPlayer }) => void
            onStateChange?: (event: { data: number }) => void
            onError?: (event: { data: number }) => void
          }
        },
      ) => YtPlayer
      PlayerState: {
        ENDED: number
        PLAYING: number
        PAUSED: number
      }
    }
    onYouTubeIframeAPIReady?: () => void
    __ytIframeApiPromise?: Promise<void>
  }
}

type YtPlayer = {
  destroy: () => void
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  getCurrentTime: () => number
  getDuration: () => number
}

function parseYouTubeVideoId(input: string | null): string {
  if (!input) {
    return ''
  }

  try {
    const parsed = new URL(input)

    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.replace('/', '')
    }

    if (parsed.searchParams.get('v')) {
      return String(parsed.searchParams.get('v'))
    }

    const embedMatch = parsed.pathname.match(/\/embed\/([^/?]+)/i)
    if (embedMatch?.[1]) {
      return embedMatch[1]
    }
  } catch {
    return ''
  }

  return ''
}

function formatAudioTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds || 0))
  const minutes = Math.floor(safe / 60)
  const remainder = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function ensureYouTubeIframeApi(): Promise<void> {
  if (window.YT?.Player) {
    return Promise.resolve()
  }

  if (window.__ytIframeApiPromise) {
    return window.__ytIframeApiPromise
  }

  window.__ytIframeApiPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('youtube-iframe-api') as HTMLScriptElement | null
    if (!existing) {
      const script = document.createElement('script')
      script.id = 'youtube-iframe-api'
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.onerror = () => reject(new Error('Failed to load YouTube Iframe API.'))
      document.head.appendChild(script)
    }

    window.onYouTubeIframeAPIReady = () => resolve()
  })

  return window.__ytIframeApiPromise
}

type EndReason = 'timeout' | 'wrong-answer' | 'manual' | 'completed-dataset' | null

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

type ViewMode = 'play' | 'gallery' | 'ost-hall'
const WAVE_BARS = 40
const APP_VERSION_LABEL = 'V1.3.1'
const IMAGE_PRELOAD_HOSTS = [
  'https://world.honorofkings.com',
  'https://game.gtimg.cn',
  'https://game-1255653016.file.myqcloud.com',
]
const OST_TRACK_SUFFIX = /\s*\|\s*Honor of Kings Original Game Soundtrack\s*$/i
const preloadedImageUrls = new Set<string>()

type SharedChallenge = {
  config: GameConfig
  score: number
  correct: number
  wrong: number
  bestStreak: number
}

type WaveProfile = {
  bpm: number
  phase: number
  accents: number[]
}

function hashString(input: string): number {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

function createWaveProfile(videoId: string): WaveProfile {
  const hash = hashString(videoId || 'default-track')
  const bpm = 96 + (hash % 52)
  const phase = ((hash % 1000) / 1000) * Math.PI * 2
  const accents = Array.from({ length: 8 }, (_, index) =>
    0.82 + (((hash >> (index + 1)) & 7) / 7) * 0.38,
  )

  return {
    bpm,
    phase,
    accents,
  }
}

function createInitialWaveHeights() {
  return Array.from({ length: WAVE_BARS }, () => 0.18 + Math.random() * 0.46)
}

function primeImage(url: string) {
  if (!url || preloadedImageUrls.has(url) || typeof window === 'undefined') {
    return
  }

  preloadedImageUrls.add(url)
  const image = new Image()
  image.decoding = 'async'
  image.src = url
}

function formatOptionLabel(option: string, target: GuessTarget): string {
  if (target !== 'ost-title') {
    return option
  }

  const trimmed = formatTrackTitle(option)
  return trimmed || option
}

function formatTrackTitle(title: string): string {
  return title.replace(OST_TRACK_SUFFIX, '').trim()
}

function getValidOstTrackId(trackId: string | null): string {
  if (!trackId) {
    return OST_TRACKS[0]?.id ?? ''
  }

  const exists = OST_TRACKS.some((track) => track.id === trackId)
  return exists ? trackId : OST_TRACKS[0]?.id ?? ''
}

function isGuessTarget(value: string | null): value is GuessTarget {
  return value === 'hero-name' || value === 'skin-name' || value === 'ost-title'
}

function isSkinDataSource(value: string | null): value is SkinDataSource {
  return value === 'official' || value === 'qing-en' || value === 'hybrid'
}

function isAnswerMode(value: string | null): value is AnswerMode {
  return value === 'typed' || value === 'multiple-choice'
}

function isScoringStyle(value: string | null): value is ScoringStyle {
  return (
    value === 'five-minute-easy' ||
    value === 'five-minute-hard' ||
    value === 'sudden-death'
  )
}

function parseNonNegativeInt(value: string | null): number {
  if (!value) {
    return 0
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }

  return parsed
}

function buildAbsoluteUrl(pathname: string, params: URLSearchParams): string {
  const query = params.toString()
  const nextPath = query ? `${pathname}?${query}` : pathname
  return `${window.location.origin}${nextPath}`
}

function findSkinById(
  skinId: string,
): { skin: SkinRecord; source: SkinDataSource } | null {
  const official = SKINS_OFFICIAL.find((skin) => skin.id === skinId)
  if (official) {
    return { skin: official, source: 'official' }
  }

  const qing = SKINS_QING.find((skin) => skin.id === skinId)
  if (qing) {
    return { skin: qing, source: 'qing-en' }
  }

  const hybrid = SKINS_HYBRID.find((skin) => skin.id === skinId)
  if (hybrid) {
    return { skin: hybrid, source: 'hybrid' }
  }

  return null
}

function gaussianPulse(position: number, center: number, width: number): number {
  const delta = position - center
  return Math.exp(-(delta * delta) / (2 * width * width))
}

function waveZoneClass(index: number): 'wave-bar bass' | 'wave-bar mid' | 'wave-bar treble' {
  const normalized = index / (WAVE_BARS - 1)
  const centerDistance = Math.abs(normalized * 2 - 1)

  if (centerDistance < 0.28) {
    return 'wave-bar bass'
  }

  if (centerDistance < 0.62) {
    return 'wave-bar mid'
  }

  return 'wave-bar treble'
}

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
    value: 'multiple-choice',
    label: 'Multiple Choice',
    description: 'Pick one option from four possible answers.',
  },
  {
    value: 'typed',
    label: 'Typed Entry',
    description: 'Type your guess and submit. Answers are case-insensitive.',
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

type InitialRouteState = {
  viewMode: ViewMode
  config: GameConfig
  incomingChallenge: SharedChallenge | null
  selectedGallerySkin: SkinRecord | null
  hallTrackId: string
}

function resolveInitialRouteState(): InitialRouteState {
  const params = new URLSearchParams(window.location.search)
  const requestedView = params.get('view')

  if (requestedView === 'gallery') {
    const linkedSkinId = params.get('skin')
    const linkedSource = params.get('source')

    if (linkedSkinId) {
      const resolved = findSkinById(linkedSkinId)
      if (resolved) {
        return {
          viewMode: 'gallery',
          config: {
            ...defaultConfig,
            skinSource: resolved.source,
          },
          incomingChallenge: null,
          selectedGallerySkin: resolved.skin,
          hallTrackId: OST_TRACKS[0]?.id ?? '',
        }
      }
    }

    return {
      viewMode: 'gallery',
      config: {
        ...defaultConfig,
        skinSource: isSkinDataSource(linkedSource)
          ? linkedSource
          : defaultConfig.skinSource,
      },
      incomingChallenge: null,
      selectedGallerySkin: null,
      hallTrackId: OST_TRACKS[0]?.id ?? '',
    }
  }

  if (requestedView === 'ost-hall') {
    return {
      viewMode: 'ost-hall',
      config: defaultConfig,
      incomingChallenge: null,
      selectedGallerySkin: null,
      hallTrackId: getValidOstTrackId(params.get('track')),
    }
  }

  if (params.get('challenge') === '1') {
    const targetParam = params.get('target')
    const sourceParam = params.get('source')
    const answerParam = params.get('answer')
    const scoringParam = params.get('scoring')

    const challengeConfig: GameConfig = {
      target: isGuessTarget(targetParam) ? targetParam : defaultConfig.target,
      skinSource: isSkinDataSource(sourceParam)
        ? sourceParam
        : defaultConfig.skinSource,
      answerMode: isAnswerMode(answerParam) ? answerParam : defaultConfig.answerMode,
      scoringStyle: isScoringStyle(scoringParam)
        ? scoringParam
        : defaultConfig.scoringStyle,
    }

    return {
      viewMode: 'play',
      config: challengeConfig,
      incomingChallenge: {
        config: challengeConfig,
        score: parseNonNegativeInt(params.get('score')),
        correct: parseNonNegativeInt(params.get('correct')),
        wrong: parseNonNegativeInt(params.get('wrong')),
        bestStreak: parseNonNegativeInt(params.get('best')),
      },
      selectedGallerySkin: null,
      hallTrackId: OST_TRACKS[0]?.id ?? '',
    }
  }

  return {
    viewMode: 'play',
    config: defaultConfig,
    incomingChallenge: null,
    selectedGallerySkin: null,
    hallTrackId: OST_TRACKS[0]?.id ?? '',
  }
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
  const initialRouteState = useMemo(() => resolveInitialRouteState(), [])
  const [viewMode, setViewMode] = useState<ViewMode>(initialRouteState.viewMode)
  const [config, setConfig] = useState<GameConfig>(initialRouteState.config)
  const [game, setGame] = useState<ActiveGame | null>(null)
  const [typedGuess, setTypedGuess] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [showOstArtwork, setShowOstArtwork] = useState(false)
  const [selectedGallerySkin, setSelectedGallerySkin] = useState<SkinRecord | null>(
    initialRouteState.selectedGallerySkin,
  )
  const [waveHeights, setWaveHeights] = useState<number[]>(() =>
    createInitialWaveHeights(),
  )
  const feedbackTimeoutRef = useRef<number | null>(null)
  const ytPlayerHostRef = useRef<HTMLDivElement | null>(null)
  const ytPlayerRef = useRef<YtPlayer | null>(null)
  const ytTickerRef = useRef<number | null>(null)
  const hallPlayerCardRef = useRef<HTMLElement | null>(null)
  const hallPlayerHostRef = useRef<HTMLDivElement | null>(null)
  const hallPlayerRef = useRef<YtPlayer | null>(null)
  const hallTickerRef = useRef<number | null>(null)
  const waveTickerRef = useRef<number | null>(null)
  const waveProfileRef = useRef<WaveProfile>(createWaveProfile('default-track'))
  const [ostPlayerReady, setOstPlayerReady] = useState(false)
  const [ostPlaying, setOstPlaying] = useState(false)
  const [ostCurrentTime, setOstCurrentTime] = useState(0)
  const [ostDuration, setOstDuration] = useState(0)
  const [ostPlayerError, setOstPlayerError] = useState<string | null>(null)
  const [selectedHallTrackId, setSelectedHallTrackId] = useState<string>(
    initialRouteState.hallTrackId,
  )
  const [hallPlayerReady, setHallPlayerReady] = useState(false)
  const [hallPlaying, setHallPlaying] = useState(false)
  const [hallCurrentTime, setHallCurrentTime] = useState(0)
  const [hallDuration, setHallDuration] = useState(0)
  const [hallPlayerError, setHallPlayerError] = useState<string | null>(null)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  const [metricsSnapshot, setMetricsSnapshot] = useState<
    Awaited<ReturnType<typeof fetchMetricsSummary>>
  >(null)
  const [showLiveStats, setShowLiveStats] = useState(() => {
    if (typeof window === 'undefined') {
      return true
    }

    return window.localStorage.getItem('hok-live-stats-hidden') !== '1'
  })
  const [incomingChallenge] = useState<SharedChallenge | null>(
    initialRouteState.incomingChallenge,
  )

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
  const selectedHallTrack = useMemo(
    () => OST_TRACKS.find((track) => track.id === selectedHallTrackId) ?? OST_TRACKS[0] ?? null,
    [selectedHallTrackId],
  )
  const activeOstVideoId =
    game?.status === 'playing' && game.question.mediaType === 'audio'
      ? parseYouTubeVideoId(game.question.audioUrl)
      : ''
  const activeHallVideoId = selectedHallTrack
    ? parseYouTubeVideoId(selectedHallTrack.audioUrl)
    : ''

  const replaceUrlParams = (updater: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(window.location.search)
    updater(params)
    const query = params.toString()
    const nextPath = query ? `${window.location.pathname}?${query}` : window.location.pathname
    window.history.replaceState(null, '', nextPath)
  }

  const clearShareFeedbackSoon = () => {
    window.setTimeout(() => {
      setShareFeedback((previous) => {
        if (!previous) {
          return previous
        }
        return null
      })
    }, 2800)
  }

  const refreshMetricsSnapshot = useCallback(() => {
    void fetchMetricsSummary().then((snapshot) => {
      if (!snapshot) {
        return
      }
      setMetricsSnapshot(snapshot)
    })
  }, [])

  useEffect(() => {
    refreshMetricsSnapshot()

    const timerId = window.setInterval(() => {
      refreshMetricsSnapshot()
    }, 60000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [refreshMetricsSnapshot])

  useEffect(() => {
    trackMetricEvent('site_view')

    const shareCategory = detectSharedVisitCategory(new URLSearchParams(window.location.search))
    if (shareCategory) {
      trackMetricEvent('share_visited', shareCategory)
    }

    // Pull a fresh snapshot shortly after initial events are sent.
    window.setTimeout(() => {
      refreshMetricsSnapshot()
    }, 450)
  }, [refreshMetricsSnapshot])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (showLiveStats) {
      window.localStorage.removeItem('hok-live-stats-hidden')
      return
    }

    window.localStorage.setItem('hok-live-stats-hidden', '1')
  }, [showLiveStats])

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current !== null) {
        window.clearTimeout(feedbackTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    for (const host of IMAGE_PRELOAD_HOSTS) {
      const selector = `link[data-preconnect-host="${host}"]`
      if (document.head.querySelector(selector)) {
        continue
      }

      const preconnect = document.createElement('link')
      preconnect.rel = 'preconnect'
      preconnect.href = host
      preconnect.crossOrigin = 'anonymous'
      preconnect.setAttribute('data-preconnect-host', host)
      document.head.appendChild(preconnect)
    }
  }, [])

  useEffect(() => {
    if (!game || game.status !== 'playing' || game.question.mediaType !== 'image') {
      return
    }

    primeImage(game.question.imageUrl)

    const lookahead = 3
    for (
      let cursor = game.queueIndex + 1;
      cursor < game.queue.length && cursor <= game.queueIndex + lookahead;
      cursor += 1
    ) {
      const nextRecord = game.queue[cursor]
      if (nextRecord.imageUrl) {
        primeImage(nextRecord.imageUrl)
      }
    }
  }, [game])

  useEffect(() => {
    if (viewMode !== 'gallery') {
      return
    }

    const preloadCount = config.skinSource === 'official' ? 8 : 16
    for (const skin of gallerySkins.slice(0, preloadCount)) {
      primeImage(skin.imageUrl)
    }
  }, [viewMode, config.skinSource, gallerySkins])

  useEffect(() => {
    if (!selectedGallerySkin) {
      return
    }

    primeImage(selectedGallerySkin.imageUrl)
  }, [selectedGallerySkin])

  useEffect(() => {
    if (viewMode !== 'ost-hall') {
      return
    }

    for (const track of OST_TRACKS.slice(0, 12)) {
      primeImage(track.imageUrl)
    }
  }, [viewMode])

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
        const params = new URLSearchParams(window.location.search)
        params.delete('skin')
        const query = params.toString()
        const nextPath = query ? `${window.location.pathname}?${query}` : window.location.pathname
        window.history.replaceState(null, '', nextPath)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    const shouldCleanup = !activeOstVideoId || gameStatus !== 'playing'
    if (shouldCleanup) {
      if (ytTickerRef.current !== null) {
        window.clearInterval(ytTickerRef.current)
        ytTickerRef.current = null
      }

      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy()
        ytPlayerRef.current = null
      }

      if (waveTickerRef.current !== null) {
        window.clearInterval(waveTickerRef.current)
        waveTickerRef.current = null
      }
      return
    }

    let cancelled = false

    const setup = async () => {
      try {
        await ensureYouTubeIframeApi()

        if (cancelled || !ytPlayerHostRef.current || !window.YT?.Player) {
          return
        }

        if (ytPlayerRef.current) {
          ytPlayerRef.current.destroy()
          ytPlayerRef.current = null
        }

        setOstPlayerReady(false)
        setOstPlaying(false)
        setOstCurrentTime(0)
        setOstDuration(0)
        setOstPlayerError(null)
        waveProfileRef.current = createWaveProfile(activeOstVideoId)
        setWaveHeights(createInitialWaveHeights())

        const player = new window.YT.Player(ytPlayerHostRef.current, {
          height: '0',
          width: '0',
          videoId: activeOstVideoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: (event) => {
              if (cancelled) {
                return
              }
              setOstPlayerReady(true)
              const duration = Number(event.target.getDuration?.() || 0)
              setOstDuration(duration)
            },
            onStateChange: (event) => {
              if (cancelled || !window.YT?.PlayerState) {
                return
              }

              const isPlaying = event.data === window.YT.PlayerState.PLAYING
              setOstPlaying(isPlaying)

              if (event.data === window.YT.PlayerState.ENDED) {
                setOstPlaying(false)
              }
            },
            onError: () => {
              if (cancelled) {
                return
              }
              setOstPlayerError('Audio could not be loaded for this track.')
            },
          },
        })

        ytPlayerRef.current = player
      } catch {
        if (!cancelled) {
          setOstPlayerError('Audio engine failed to initialize.')
        }
      }
    }

    setup()

    return () => {
      cancelled = true
      if (ytTickerRef.current !== null) {
        window.clearInterval(ytTickerRef.current)
        ytTickerRef.current = null
      }
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy()
        ytPlayerRef.current = null
      }

      if (waveTickerRef.current !== null) {
        window.clearInterval(waveTickerRef.current)
        waveTickerRef.current = null
      }
    }
  }, [activeOstVideoId, gameStatus])

  useEffect(() => {
    if (!ostPlayerReady || !ytPlayerRef.current) {
      return
    }

    ytTickerRef.current = window.setInterval(() => {
      const player = ytPlayerRef.current
      if (!player) {
        return
      }

      const current = Number(player.getCurrentTime?.() || 0)
      const duration = Number(player.getDuration?.() || 0)
      setOstCurrentTime(current)

      if (duration > 0) {
        setOstDuration(duration)
      }
    }, 220)

    return () => {
      if (ytTickerRef.current !== null) {
        window.clearInterval(ytTickerRef.current)
        ytTickerRef.current = null
      }
    }
  }, [ostPlayerReady, activeOstVideoId])

  useEffect(() => {
    if (!ostPlaying || !ytPlayerRef.current) {
      return
    }

    waveTickerRef.current = window.setInterval(() => {
      const anchor = Number(ytPlayerRef.current?.getCurrentTime?.() || 0)
      const profile = waveProfileRef.current

      const beatPosition = ((anchor * profile.bpm) / 60 + profile.phase / (Math.PI * 2)) % 1
      const kick = gaussianPulse(beatPosition, 0.08, 0.08)
      const offKick = gaussianPulse(beatPosition, 0.58, 0.11)
      const beatEnergy = Math.min(1.2, kick + offKick * 0.75)

      setWaveHeights((previous) =>
        previous.map((current, index) => {
          const normalized = index / (WAVE_BARS - 1)
          const centerDistance = Math.abs(normalized * 2 - 1)

          const bassWeight = Math.max(0, 1 - centerDistance * 1.65)
          const midWeight = Math.max(0, 1 - Math.abs(centerDistance - 0.45) * 2.25)
          const trebleWeight = Math.max(0, centerDistance * 1.2 - 0.15)

          const harmonic =
            0.5 +
            0.5 *
              Math.sin(
                anchor * (1.4 + trebleWeight * 2.2 + (index % 4) * 0.09) +
                  index * 0.45 +
                  profile.phase,
              )

          const shimmer =
            0.5 +
            0.5 * Math.sin(anchor * 6.5 + index * 1.17 + profile.phase * 0.6)

          const accent = profile.accents[index % profile.accents.length]

          const target =
            0.1 +
            bassWeight * (0.22 + beatEnergy * 0.62) +
            midWeight * (0.14 + harmonic * 0.34) +
            trebleWeight * (0.08 + shimmer * 0.28)

          const next = current * 0.46 + target * accent * 0.54
          return Math.max(0.08, Math.min(0.98, next))
        }),
      )
    }, 140)

    return () => {
      if (waveTickerRef.current !== null) {
        window.clearInterval(waveTickerRef.current)
        waveTickerRef.current = null
      }
    }
  }, [ostPlaying, activeOstVideoId])

  useEffect(() => {
    const shouldCleanup = viewMode !== 'ost-hall' || !activeHallVideoId
    if (shouldCleanup) {
      if (hallTickerRef.current !== null) {
        window.clearInterval(hallTickerRef.current)
        hallTickerRef.current = null
      }

      if (hallPlayerRef.current) {
        hallPlayerRef.current.destroy()
        hallPlayerRef.current = null
      }
      return
    }

    let cancelled = false

    const setup = async () => {
      try {
        await ensureYouTubeIframeApi()

        if (cancelled || !hallPlayerHostRef.current || !window.YT?.Player) {
          return
        }

        if (hallPlayerRef.current) {
          hallPlayerRef.current.destroy()
          hallPlayerRef.current = null
        }

        setHallPlayerReady(false)
        setHallPlaying(false)
        setHallCurrentTime(0)
        setHallDuration(0)
        setHallPlayerError(null)

        const player = new window.YT.Player(hallPlayerHostRef.current, {
          height: '0',
          width: '0',
          videoId: activeHallVideoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
          },
          events: {
            onReady: (event) => {
              if (cancelled) {
                return
              }
              setHallPlayerReady(true)
              const duration = Number(event.target.getDuration?.() || 0)
              setHallDuration(duration)
            },
            onStateChange: (event) => {
              if (cancelled || !window.YT?.PlayerState) {
                return
              }

              const isPlaying = event.data === window.YT.PlayerState.PLAYING
              setHallPlaying(isPlaying)

              if (event.data === window.YT.PlayerState.ENDED) {
                setHallPlaying(false)
              }
            },
            onError: () => {
              if (cancelled) {
                return
              }
              setHallPlayerError('Audio could not be loaded for this track.')
            },
          },
        })

        hallPlayerRef.current = player
      } catch {
        if (!cancelled) {
          setHallPlayerError('Audio engine failed to initialize.')
        }
      }
    }

    setup()

    return () => {
      cancelled = true
      if (hallTickerRef.current !== null) {
        window.clearInterval(hallTickerRef.current)
        hallTickerRef.current = null
      }
      if (hallPlayerRef.current) {
        hallPlayerRef.current.destroy()
        hallPlayerRef.current = null
      }
    }
  }, [viewMode, activeHallVideoId])

  useEffect(() => {
    if (!hallPlayerReady || !hallPlayerRef.current || viewMode !== 'ost-hall') {
      return
    }

    hallTickerRef.current = window.setInterval(() => {
      const player = hallPlayerRef.current
      if (!player) {
        return
      }

      const current = Number(player.getCurrentTime?.() || 0)
      const duration = Number(player.getDuration?.() || 0)
      setHallCurrentTime(current)

      if (duration > 0) {
        setHallDuration(duration)
      }
    }, 220)

    return () => {
      if (hallTickerRef.current !== null) {
        window.clearInterval(hallTickerRef.current)
        hallTickerRef.current = null
      }
    }
  }, [hallPlayerReady, viewMode, activeHallVideoId])

  const copyTextToClipboard = async (text: string): Promise<boolean> => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }

    const fallbackInput = document.createElement('textarea')
    fallbackInput.value = text
    fallbackInput.setAttribute('readonly', 'true')
    fallbackInput.style.position = 'fixed'
    fallbackInput.style.opacity = '0'
    document.body.appendChild(fallbackInput)
    fallbackInput.focus()
    fallbackInput.select()

    try {
      const success = document.execCommand('copy')
      document.body.removeChild(fallbackInput)
      return success
    } catch {
      document.body.removeChild(fallbackInput)
      return false
    }
  }

  const buildChallengeShareUrl = (endedGame: ActiveGame): string => {
    const params = new URLSearchParams()
    params.set('view', 'play')
    params.set('challenge', '1')
    params.set('target', endedGame.config.target)
    params.set('source', endedGame.config.skinSource)
    params.set('answer', endedGame.config.answerMode)
    params.set('scoring', endedGame.config.scoringStyle)
    params.set('score', String(endedGame.score))
    params.set('correct', String(endedGame.correct))
    params.set('wrong', String(endedGame.wrong))
    params.set('best', String(endedGame.bestStreak))
    return buildAbsoluteUrl('/share', params)
  }

  const buildGalleryShareUrl = (skin: SkinRecord): string => {
    const params = new URLSearchParams()
    params.set('view', 'gallery')
    params.set('source', config.skinSource)
    params.set('skin', skin.id)
    params.set('skinName', skin.skinName)
    params.set('heroName', skin.heroName)
    params.set('image', skin.imageUrl)
    return buildAbsoluteUrl('/share', params)
  }

  const buildOstShareUrl = (track: OstRecord): string => {
    const params = new URLSearchParams()
    params.set('view', 'ost-hall')
    params.set('track', track.id)
    params.set('trackTitle', formatTrackTitle(track.trackTitle))
    params.set('artistName', track.artistName)
    params.set('image', track.imageUrl)
    return buildAbsoluteUrl('/share', params)
  }

  const shareResults = async () => {
    if (!game || game.status !== 'ended') {
      return
    }

    const shareUrl = buildChallengeShareUrl(game)
    const modeSummary = [
      getModeLabel(targetOptions, game.config.target),
      game.config.target === 'ost-title'
        ? null
        : getModeLabel(skinSourceOptions, game.config.skinSource),
      getModeLabel(answerModeOptions, game.config.answerMode),
      getModeLabel(scoringOptions, game.config.scoringStyle),
    ]
      .filter(Boolean)
      .join(' | ')

    const shareText =
        game.endReason === 'completed-dataset'
          ? game.wrong === 0
            ? `I completed the full Honor of Kings Trivia dataset with a perfect clear (${game.correct} correct, 0 wrong, score ${game.score}). Mode: ${modeSummary}. Can you beat this run?`
            : `I completed the full Honor of Kings Trivia dataset (${game.correct} correct, ${game.wrong} wrong, score ${game.score}). Mode: ${modeSummary}. Can you beat this run?`
          : `I scored ${game.score} in Honor of Kings Trivia ` +
            `(${game.correct} correct, ${game.wrong} wrong, best streak ${game.bestStreak}). ` +
            `Mode: ${modeSummary}. Can you beat this challenge?`

    trackMetricEvent('share_generated', 'challenge')

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Honor of Kings Trivia Challenge',
          text: shareText,
          url: shareUrl,
        })
        setShareFeedback('Challenge share opened.')
      } else {
        const copied = await copyTextToClipboard(`${shareText} ${shareUrl}`)
        setShareFeedback(copied ? 'Challenge link copied.' : 'Could not copy challenge link.')
      }
    } catch {
      const copied = await copyTextToClipboard(`${shareText} ${shareUrl}`)
      setShareFeedback(copied ? 'Challenge link copied.' : 'Could not share this challenge.')
    }

    clearShareFeedbackSoon()
    refreshMetricsSnapshot()
  }

  const shareGalleryCard = async (skin: SkinRecord) => {
    const shareUrl = buildGalleryShareUrl(skin)
    const shareText =
      `${skin.skinName} (${skin.heroName}) in Honor of Kings Trivia gallery. ` +
      'Open this link to jump directly to the card.'

    trackMetricEvent('share_generated', 'gallery')

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${skin.skinName} • Honor of Kings Trivia`,
          text: shareText,
          url: shareUrl,
        })
        setShareFeedback('Gallery share opened.')
      } else {
        const copied = await copyTextToClipboard(`${shareText} ${shareUrl}`)
        setShareFeedback(copied ? 'Gallery link copied.' : 'Could not copy gallery link.')
      }
    } catch {
      const copied = await copyTextToClipboard(`${shareText} ${shareUrl}`)
      setShareFeedback(copied ? 'Gallery link copied.' : 'Could not share gallery card.')
    }

    clearShareFeedbackSoon()
    refreshMetricsSnapshot()
  }

  const shareOstTrack = async () => {
    if (!selectedHallTrack) {
      return
    }

    const shareUrl = buildOstShareUrl(selectedHallTrack)

    const shareText =
      `Check out ${formatTrackTitle(selectedHallTrack.trackTitle)} by ` +
      `${selectedHallTrack.artistName} in the Honor of Kings OST Hall.`

    trackMetricEvent('share_generated', 'ost')

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${formatTrackTitle(selectedHallTrack.trackTitle)} • Honor of Kings OST Hall`,
          text: shareText,
          url: shareUrl,
        })
        setShareFeedback('OST track share opened.')
      } else {
        const copied = await copyTextToClipboard(`${shareText} ${shareUrl}`)
        setShareFeedback(copied ? 'OST track link copied.' : 'Could not copy OST track link.')
      }
    } catch {
      const copied = await copyTextToClipboard(`${shareText} ${shareUrl}`)
      setShareFeedback(copied ? 'OST track link copied.' : 'Could not share OST track.')
    }

    clearShareFeedbackSoon()
    refreshMetricsSnapshot()
  }

  const selectHallTrack = (trackId: string, scrollToPlayer: boolean) => {
    setSelectedHallTrackId(trackId)

    replaceUrlParams((params) => {
      params.set('view', 'ost-hall')
      params.set('track', trackId)
      params.delete('source')
      params.delete('skin')
      params.delete('challenge')
      params.delete('target')
      params.delete('answer')
      params.delete('scoring')
      params.delete('score')
      params.delete('correct')
      params.delete('wrong')
      params.delete('best')
    })

    if (scrollToPlayer) {
      window.requestAnimationFrame(() => {
        hallPlayerCardRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      })
    }
  }

  const startGame = () => {
    setFeedback(null)
    setSetupError(null)
    setShareFeedback(null)
    setTypedGuess('')
    setShowOstArtwork(false)

    const selectedTarget = targetOptions.find((option) => option.value === config.target)
    if (selectedTarget?.disabled) {
      setSetupError('This mode is disabled until OST data is loaded.')
      return
    }

    try {
      const initialGame = buildInitialGame(config)
      setGame(initialGame)
      trackMetricEvent('game_started', config.target === 'ost-title' ? 'ost' : 'standard')
      refreshMetricsSnapshot()
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
    setShareFeedback(null)
    setTypedGuess('')
    setConfig(game.config)
    setShowOstArtwork(false)

    const selectedTarget = targetOptions.find((option) => option.value === game.config.target)
    if (selectedTarget?.disabled) {
      setSetupError('This mode is disabled until OST data is loaded.')
      return
    }

    try {
      const nextGame = buildInitialGame(game.config)
      setGame(nextGame)
      trackMetricEvent('game_started', game.config.target === 'ost-title' ? 'ost' : 'standard')
      refreshMetricsSnapshot()
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
    setShareFeedback(null)
    setTypedGuess('')
    setSelectedGallerySkin(null)

    replaceUrlParams((params) => {
      params.set('view', 'gallery')
      params.set('source', config.skinSource)
      params.delete('skin')
      params.delete('track')
      params.delete('challenge')
      params.delete('target')
      params.delete('answer')
      params.delete('scoring')
      params.delete('score')
      params.delete('correct')
      params.delete('wrong')
      params.delete('best')
    })
  }

  const openOstHall = () => {
    setViewMode('ost-hall')
    setGame(null)
    setFeedback(null)
    setSetupError(null)
    setShareFeedback(null)
    setTypedGuess('')
    setSelectedGallerySkin(null)

    const hallTrackId = getValidOstTrackId(selectedHallTrackId)
    if (hallTrackId && hallTrackId !== selectedHallTrackId) {
      setSelectedHallTrackId(hallTrackId)
    }

    replaceUrlParams((params) => {
      params.set('view', 'ost-hall')
      if (hallTrackId) {
        params.set('track', hallTrackId)
      } else {
        params.delete('track')
      }
      params.delete('source')
      params.delete('skin')
      params.delete('challenge')
      params.delete('target')
      params.delete('answer')
      params.delete('scoring')
      params.delete('score')
      params.delete('correct')
      params.delete('wrong')
      params.delete('best')
    })
  }

  const openPlay = () => {
    setViewMode('play')
    setSetupError(null)
    setShareFeedback(null)
    setSelectedGallerySkin(null)

    replaceUrlParams((params) => {
      params.set('view', 'play')
      params.delete('source')
      params.delete('skin')
      params.delete('track')
    })
  }

  const closeGalleryLightbox = () => {
    setSelectedGallerySkin(null)
    replaceUrlParams((params) => {
      params.delete('skin')
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

          const reachedPoolEnd = previous.queueIndex >= previous.queue.length - 1
          if (reachedPoolEnd) {
            return {
              ...previous,
              status: 'ended',
              endReason: 'completed-dataset',
            }
          }

          const queueIndex = previous.queueIndex + 1
          const nextSkin = previous.queue[queueIndex]

          return {
            ...previous,
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
          : game?.endReason === 'completed-dataset'
            ? game?.wrong === 0
              ? 'Legendary clear: you completed the full dataset with a perfect run.'
              : 'Dataset completed: you reached the end of the full question pool.'
          : 'Session complete.'

  const toggleOstPlayback = () => {
    if (!ytPlayerRef.current || !ostPlayerReady) {
      return
    }

    if (ostPlaying) {
      ytPlayerRef.current.pauseVideo()
      setOstPlaying(false)
      return
    }

    ytPlayerRef.current.playVideo()
    setOstPlaying(true)
  }

  const toggleHallPlayback = () => {
    if (!hallPlayerRef.current || !hallPlayerReady) {
      return
    }

    if (hallPlaying) {
      hallPlayerRef.current.pauseVideo()
      setHallPlaying(false)
      return
    }

    hallPlayerRef.current.playVideo()
    setHallPlaying(true)
  }

  const seekOstBy = (deltaSeconds: number) => {
    if (!ytPlayerRef.current || !ostPlayerReady) {
      return
    }

    const current = Number(ytPlayerRef.current.getCurrentTime?.() || 0)
    const duration = Number(ytPlayerRef.current.getDuration?.() || 0)
    const next = Math.max(0, Math.min(duration || current + deltaSeconds, current + deltaSeconds))

    ytPlayerRef.current.seekTo(next, true)
    setOstCurrentTime(next)
  }

  const seekOstTo = (seconds: number) => {
    if (!ytPlayerRef.current || !ostPlayerReady) {
      return
    }

    const duration = Number(ytPlayerRef.current.getDuration?.() || 0)
    const next = Math.max(0, Math.min(duration || seconds, seconds))
    ytPlayerRef.current.seekTo(next, true)
    setOstCurrentTime(next)
  }

  const seekHallBy = (deltaSeconds: number) => {
    if (!hallPlayerRef.current || !hallPlayerReady) {
      return
    }

    const current = Number(hallPlayerRef.current.getCurrentTime?.() || 0)
    const duration = Number(hallPlayerRef.current.getDuration?.() || 0)
    const next = Math.max(0, Math.min(duration || current + deltaSeconds, current + deltaSeconds))

    hallPlayerRef.current.seekTo(next, true)
    setHallCurrentTime(next)
  }

  const seekHallTo = (seconds: number) => {
    if (!hallPlayerRef.current || !hallPlayerReady) {
      return
    }

    const duration = Number(hallPlayerRef.current.getDuration?.() || 0)
    const next = Math.max(0, Math.min(duration || seconds, seconds))
    hallPlayerRef.current.seekTo(next, true)
    setHallCurrentTime(next)
  }

  return (
    <div className="app-shell">
      <header className="masthead">
        <p className="eyebrow">{APP_VERSION_LABEL}</p>
        <h1>Honor of Kings Trivia</h1>
        <p className="lede">
          Master hero, skin, and soundtrack trivia across multiple modes, then share your
          best runs, favorite gallery cards, and top OST tracks with friends and the community!
        </p>

        {metricsSnapshot && (
          <>
            <div className="live-stats-toggle-row">
              <p className="live-stats-toggle-note">Live Community Metrics</p>
              <button
                type="button"
                className="live-stats-toggle-button"
                onClick={() => setShowLiveStats((previous) => !previous)}
                aria-expanded={showLiveStats}
              >
                {showLiveStats ? 'Hide Stats' : 'Show Stats'}
              </button>
            </div>

            {showLiveStats && (
              <section className="live-stats-strip" aria-label="Community metrics">
                <article className="live-stat-tile">
                  <p className="live-stat-label">Site Views</p>
                  <p className="live-stat-value">{formatCompactCount(metricsSnapshot.site_views)}</p>
                </article>
                <article className="live-stat-tile">
                  <p className="live-stat-label">Unique Visitors</p>
                  <p className="live-stat-value">
                    {formatCompactCount(metricsSnapshot.unique_site_visitors)}
                  </p>
                </article>
                <article className="live-stat-tile">
                  <p className="live-stat-label">Share Links Generated</p>
                  <p className="live-stat-value">
                    {formatCompactCount(metricsSnapshot.share_links_generated)}
                  </p>
                </article>
                <article className="live-stat-tile">
                  <p className="live-stat-label">Share Links Visited</p>
                  <p className="live-stat-value">
                    {formatCompactCount(metricsSnapshot.share_links_visited)}
                  </p>
                </article>
                <article className="live-stat-tile">
                  <p className="live-stat-label">Normal Games Played</p>
                  <p className="live-stat-value">
                    {formatCompactCount(metricsSnapshot.games_played_standard)}
                  </p>
                </article>
                <article className="live-stat-tile">
                  <p className="live-stat-label">OST Games Played</p>
                  <p className="live-stat-value">
                    {formatCompactCount(metricsSnapshot.games_played_ost)}
                  </p>
                </article>
              </section>
            )}
          </>
        )}

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
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'ost-hall'}
            className={
              viewMode === 'ost-hall' ? 'switch-button active' : 'switch-button'
            }
            onClick={openOstHall}
          >
            OST Hall
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

          {incomingChallenge && (
            <div className="share-highlight" role="status">
              <p className="share-highlight-kicker">Shared Challenge</p>
              <p className="share-highlight-title">Can you beat this run?</p>
              <p className="share-highlight-meta">
                Score {incomingChallenge.score}, {incomingChallenge.correct} correct,{' '}
                {incomingChallenge.wrong} wrong, best streak {incomingChallenge.bestStreak}
              </p>
            </div>
          )}

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
                  {option.value === 'ost-title' && (
                    <span className="ost-chip">Audio Challenge</span>
                  )}
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
          {shareFeedback && <p className="result-subtitle">{shareFeedback}</p>}
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
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
            )}

            {game.question.mediaType === 'audio' && (
              <div className="audio-stage">
                <div className="yt-audio-host" ref={ytPlayerHostRef} aria-hidden="true" />

                {!showOstArtwork ? (
                  <div className={ostPlaying ? 'wave-stage playing' : 'wave-stage'}>
                    <div className="wave-grid">
                      {Array.from({ length: WAVE_BARS }, (_, index) => {
                        const height =
                          waveHeights[index] ?? 0.18 + ((index % 7) / 7) * 0.58

                        return (
                            <span
                              key={`wave-${index}`}
                              className={waveZoneClass(index)}
                              style={{ height: `${Math.round(height * 100)}%` }}
                            />
                        )
                      })}
                    </div>
                    <p className="wave-title">Audio Visualizer</p>
                  </div>
                ) : (
                  <img
                    src={game.question.imageUrl}
                    alt={`Track artwork prompt ${game.question.id}`}
                    className="track-artwork"
                  />
                )}

                <div className="audio-controls">
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={!ostPlayerReady}
                    onClick={() => seekOstBy(-5)}
                  >
                    -5s
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!ostPlayerReady}
                    onClick={toggleOstPlayback}
                  >
                    {ostPlaying ? 'Pause' : 'Play'}
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={!ostPlayerReady}
                    onClick={() => seekOstBy(5)}
                  >
                    +5s
                  </button>
                </div>

                <input
                  type="range"
                  className="audio-scrubber"
                  min={0}
                  max={Math.max(1, Math.floor(ostDuration || 0))}
                  step={1}
                  value={Math.min(ostCurrentTime, Math.max(1, Math.floor(ostDuration || 0)))}
                  disabled={!ostPlayerReady}
                  onChange={(event) => seekOstTo(Number(event.target.value))}
                  aria-label="Seek track position"
                />

                <p className="audio-time">
                  {formatAudioTime(ostCurrentTime)} / {formatAudioTime(ostDuration)}
                </p>

                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setShowOstArtwork((previous) => !previous)}
                >
                  {showOstArtwork ? 'Show Sound Waves' : 'Show Track Artwork'}
                </button>

                {ostPlayerError && (
                  <p className="result-subtitle setup-error">{ostPlayerError}</p>
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
                    <span className="title">
                      {formatOptionLabel(option, game.config.target)}
                    </span>
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
            <button className="share-button" onClick={shareResults}>
              Share Challenge
            </button>
            <button
              className="ghost-button"
              onClick={() => {
                setGame(null)
                setFeedback(null)
                setTypedGuess('')
                setShareFeedback(null)
                replaceUrlParams((params) => {
                  params.set('view', 'play')
                  params.delete('source')
                  params.delete('skin')
                })
              }}
            >
              Change Modes
            </button>
          </div>
          {shareFeedback && <p className="result-subtitle">{shareFeedback}</p>}
        </section>
      )}

      {viewMode === 'ost-hall' && (
        <section className="panel ost-hall-panel">
          <div className="gallery-head">
            <h2>OST Hall</h2>
            <p className="result-subtitle">
              Browse soundtrack artwork and preview tracks with quick controls.
            </p>
            <div className="chip">Tracks: {OST_TRACKS.length}</div>
          </div>

          {OST_TRACKS.length === 0 && (
            <p className="result-subtitle setup-error">
              No OST tracks loaded yet. Run ingest:ost:all to populate OST Hall.
            </p>
          )}

          {selectedHallTrack && OST_TRACKS.length > 0 && (
            <article className="question-card ost-hall-player" ref={hallPlayerCardRef}>
              <div className="yt-audio-host" ref={hallPlayerHostRef} aria-hidden="true" />
              <img
                src={selectedHallTrack.imageUrl}
                alt={`Track artwork ${selectedHallTrack.trackTitle}`}
                className="track-artwork"
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
              <h3>{formatTrackTitle(selectedHallTrack.trackTitle)}</h3>
              <p className="result-subtitle">Artist: {selectedHallTrack.artistName}</p>

              <div className="audio-controls">
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!hallPlayerReady}
                  onClick={() => seekHallBy(-5)}
                >
                  -5s
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={!hallPlayerReady}
                  onClick={toggleHallPlayback}
                >
                  {hallPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!hallPlayerReady}
                  onClick={() => seekHallBy(5)}
                >
                  +5s
                </button>
                <button
                  type="button"
                  className="share-button"
                  onClick={shareOstTrack}
                >
                  Share Track
                </button>
              </div>

              <input
                type="range"
                className="audio-scrubber"
                min={0}
                max={Math.max(1, Math.floor(hallDuration || 0))}
                step={1}
                value={Math.min(hallCurrentTime, Math.max(1, Math.floor(hallDuration || 0)))}
                disabled={!hallPlayerReady}
                onChange={(event) => seekHallTo(Number(event.target.value))}
                aria-label="Seek OST hall track position"
              />

              <p className="audio-time">
                {formatAudioTime(hallCurrentTime)} / {formatAudioTime(hallDuration)}
              </p>

              {hallPlayerError && (
                <p className="result-subtitle setup-error">{hallPlayerError}</p>
              )}
            </article>
          )}

          {OST_TRACKS.length > 0 && (
            <div className="ost-track-grid">
              {OST_TRACKS.map((track, index) => (
                <article
                  key={track.id}
                  className={
                    selectedHallTrack?.id === track.id
                      ? 'ost-track-card active'
                      : 'ost-track-card'
                  }
                >
                  <button
                    type="button"
                    className="ost-track-button"
                    onClick={() => selectHallTrack(track.id, true)}
                  >
                    <img
                      src={track.imageUrl}
                      alt={`Artwork ${track.trackTitle}`}
                      loading={index < 8 ? 'eager' : 'lazy'}
                      decoding="async"
                      fetchPriority={index < 8 ? 'high' : 'auto'}
                    />
                    <div className="gallery-meta">
                      {selectedHallTrack?.id === track.id && (
                        <span className="ost-track-badge">Now Playing</span>
                      )}
                      <p className="gallery-skin">{formatTrackTitle(track.trackTitle)}</p>
                      <p className="gallery-hero">{track.artistName}</p>
                    </div>
                  </button>
                </article>
              ))}
            </div>
          )}
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
          {shareFeedback && <p className="result-subtitle">{shareFeedback}</p>}

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
                onClick={() => {
                  setConfig((previous) => ({
                    ...previous,
                    skinSource: option.value,
                  }))
                  setSelectedGallerySkin(null)
                  replaceUrlParams((params) => {
                    params.set('view', 'gallery')
                    params.set('source', option.value)
                    params.delete('skin')
                  })
                }}
              >
                <span className="title">{option.label}</span>
                <span className="description">
                  {option.description} ({SKIN_SOURCE_META[option.value].items} entries)
                </span>
              </button>
            ))}
          </div>

          <div className="gallery-grid">
            {gallerySkins.map((skin, index) => (
              <article key={skin.id} className="gallery-card">
                <button
                  type="button"
                  className="gallery-card-button"
                  onClick={() => {
                    setSelectedGallerySkin(skin)
                    replaceUrlParams((params) => {
                      params.set('view', 'gallery')
                      params.set('source', config.skinSource)
                      params.set('skin', skin.id)
                    })
                  }}
                >
                  <img
                    src={skin.imageUrl}
                    alt={`${skin.heroName} - ${skin.skinName}`}
                    loading={index < 8 ? 'eager' : 'lazy'}
                    decoding="async"
                    fetchPriority={index < 8 ? 'high' : 'auto'}
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
          onClick={closeGalleryLightbox}
        >
          <div
            className="gallery-lightbox-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="gallery-lightbox-actions">
              <button
                type="button"
                className="share-button"
                onClick={() => shareGalleryCard(selectedGallerySkin)}
              >
                Share Card
              </button>
              <button
                type="button"
                className="gallery-lightbox-close"
                onClick={closeGalleryLightbox}
              >
                Close
              </button>
            </div>
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
