import { useSyncExternalStore } from 'react'

export interface MiniPlayerState {
  src: string | null
  playing: boolean
  currentTime: number
  duration: number
  volume: number
  error: string | null
}

const initialState = (): MiniPlayerState => ({
  src: null,
  playing: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  error: null,
})

let state: MiniPlayerState = initialState()
let singleton: HTMLAudioElement | null = null
const listeners = new Set<() => void>()

function finiteSeconds(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  return value
}

function playbackError(src: string): string {
  if (src.startsWith('desk:') || src.startsWith('file:')) {
    return 'Audiodatei konnte nicht abgespielt werden.'
  }
  return 'Diese URL lässt sich nicht abspielen.'
}

function emit(): void {
  listeners.forEach((listener) => listener())
}

function setState(patch: Partial<MiniPlayerState>): void {
  const next: MiniPlayerState = { ...state, ...patch }
  if (
    next.src === state.src &&
    next.playing === state.playing &&
    next.currentTime === state.currentTime &&
    next.duration === state.duration &&
    next.volume === state.volume &&
    next.error === state.error
  ) {
    return
  }
  state = next
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function wire(element: HTMLAudioElement): void {
  element.preload = 'metadata'
  element.addEventListener('play', () => setState({ playing: true }))
  element.addEventListener('pause', () => setState({ playing: false }))
  element.addEventListener('ended', () => {
    setState({ playing: false, currentTime: finiteSeconds(element.currentTime) })
  })
  element.addEventListener('timeupdate', () => {
    setState({
      currentTime: finiteSeconds(element.currentTime),
      duration: finiteSeconds(element.duration),
    })
  })
  element.addEventListener('durationchange', () => {
    setState({ duration: finiteSeconds(element.duration) })
  })
  element.addEventListener('loadedmetadata', () => {
    setState({
      duration: finiteSeconds(element.duration),
      currentTime: finiteSeconds(element.currentTime),
    })
  })
  element.addEventListener('volumechange', () => setState({ volume: element.volume }))
  element.addEventListener('error', () => {
    if (element.error?.code === 1) return
    setState({ playing: false, error: playbackError(state.src ?? '') })
  })
}

function audio(): HTMLAudioElement {
  if (!singleton) {
    singleton = new Audio()
    singleton.volume = state.volume
    wire(singleton)
  }
  return singleton
}

export function getMiniPlayerSnapshot(): MiniPlayerState {
  return state
}

export function loadIfIdle(src: string): void {
  const element = audio()
  if (state.src === src) return
  if (state.playing && state.src) return
  element.pause()
  setState({ src, playing: false, currentTime: 0, duration: 0, error: null })
  element.src = src
}

export function play(src: string): Promise<void> {
  const element = audio()
  if (state.src !== src) {
    element.pause()
    setState({ src, playing: false, currentTime: 0, duration: 0, error: null })
    element.src = src
  } else {
    setState({ error: null })
  }
  return element.play().then(
    () => {
      if (state.src !== src) return
      setState({ playing: true, error: null })
    },
    (cause: unknown) => {
      if (state.src !== src) return
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setState({ playing: false, error: playbackError(src) })
    },
  )
}

export function pause(): void {
  audio().pause()
  setState({ playing: false })
}

export function pauseIfSrc(src: string): void {
  if (state.src !== src) return
  pause()
}

export function seek(seconds: number): void {
  const element = audio()
  const duration = finiteSeconds(element.duration)
  if (!duration) return
  const next = Math.min(Math.max(seconds, 0), duration)
  element.currentTime = next
  setState({ currentTime: next })
}

export function setVolume(volume: number): void {
  const next = Math.min(1, Math.max(0, volume))
  audio().volume = next
  setState({ volume: next })
}

export function useMiniPlayer(): MiniPlayerState & {
  play: typeof play
  pause: typeof pause
  seek: typeof seek
  setVolume: typeof setVolume
} {
  const snapshot = useSyncExternalStore(subscribe, getMiniPlayerSnapshot, getMiniPlayerSnapshot)
  return { ...snapshot, play, pause, seek, setVolume }
}
