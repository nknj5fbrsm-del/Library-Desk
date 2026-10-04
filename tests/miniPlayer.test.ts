import { afterEach, describe, expect, it, vi } from 'vitest'

class FakeAudio extends EventTarget {
  static constructed = 0
  paused = true
  currentTime = 0
  duration = 4
  volume = 1
  error: { code: number } | null = null
  private url = ''

  constructor() {
    super()
    FakeAudio.constructed += 1
  }

  get src(): string {
    return this.url
  }

  set src(value: string) {
    this.url = value
  }

  play(): Promise<void> {
    this.paused = false
    this.dispatchEvent(new Event('play'))
    return Promise.resolve()
  }

  pause(): void {
    this.paused = true
    this.dispatchEvent(new Event('pause'))
  }
}

async function loadPlayer() {
  vi.resetModules()
  FakeAudio.constructed = 0
  vi.stubGlobal('Audio', FakeAudio)
  return import('../src/renderer/hooks/useMiniPlayer')
}

describe('useMiniPlayer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('keeps one audio element and a new play replaces the previous source', async () => {
    const player = await loadPlayer()
    await player.play('https://example.test/a.mp3')
    await player.play('https://example.test/b.mp3')

    expect(FakeAudio.constructed).toBe(1)
    const snapshot = player.getMiniPlayerSnapshot()
    expect(snapshot.src).toBe('https://example.test/b.mp3')
    expect(snapshot.playing).toBe(true)
    expect(snapshot.error).toBeNull()
  })

  it('reports a German error when a url cannot play', async () => {
    class FailingAudio extends FakeAudio {
      override play(): Promise<void> {
        this.error = { code: 4 }
        this.dispatchEvent(new Event('error'))
        return Promise.reject(new DOMException('nope', 'NotSupportedError'))
      }
    }
    vi.resetModules()
    FakeAudio.constructed = 0
    vi.stubGlobal('Audio', FailingAudio)
    const player = await import('../src/renderer/hooks/useMiniPlayer')
    await player.play('https://example.test/page')
    expect(player.getMiniPlayerSnapshot().error).toBe('Diese URL lässt sich nicht abspielen.')
    expect(player.getMiniPlayerSnapshot().playing).toBe(false)
  })

  it('seeks and changes volume on the shared element', async () => {
    const player = await loadPlayer()
    await player.play('desk://audio/entry-1/tone.wav')
    player.seek(1.5)
    player.setVolume(0.4)
    const snapshot = player.getMiniPlayerSnapshot()
    expect(snapshot.currentTime).toBe(1.5)
    expect(snapshot.volume).toBe(0.4)
    player.pause()
    expect(player.getMiniPlayerSnapshot().playing).toBe(false)
  })
})
