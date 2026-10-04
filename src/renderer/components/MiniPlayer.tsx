import { useEffect, useState } from 'react'
import { getDesk } from '@renderer/api'
import { loadIfIdle, pauseIfSrc, useMiniPlayer } from '@renderer/hooks/useMiniPlayer'

interface MiniPlayerProps {
  src: string
  openExternalHref?: string | null
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  const remain = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`
}

export function MiniPlayer({ src, openExternalHref = null }: MiniPlayerProps): JSX.Element {
  const player = useMiniPlayer()
  const [openError, setOpenError] = useState<string | null>(null)
  const active = player.src === src
  const playing = active && player.playing
  const currentTime = active ? player.currentTime : 0
  const duration = active ? player.duration : 0
  const error = active ? player.error : null

  useEffect(() => {
    loadIfIdle(src)
    return () => pauseIfSrc(src)
  }, [src])

  async function openExternal(): Promise<void> {
    if (!openExternalHref) return
    setOpenError(null)
    try {
      await getDesk().shell.openExternal(openExternalHref)
    } catch {
      setOpenError('Diese URL lässt sich nicht öffnen.')
    }
  }

  return (
    <div className="mini-player">
      <button
        type="button"
        className="btn"
        aria-label={playing ? 'Pause' : 'Wiedergeben'}
        onClick={() => {
          if (playing) player.pause()
          else void player.play(src)
        }}
      >
        {playing ? 'Pause' : 'Play'}
      </button>
      <span className="mini-time">{formatClock(currentTime)}</span>
      <input
        className="mini-progress"
        type="range"
        aria-label="Position"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(currentTime, duration || 0)}
        disabled={!duration}
        onChange={(event) => {
          if (player.src !== src) return
          player.seek(Number(event.target.value))
        }}
      />
      <span className="mini-time">{formatClock(duration)}</span>
      <input
        className="mini-volume"
        type="range"
        aria-label="Lautstärke"
        min={0}
        max={1}
        step={0.05}
        value={player.volume}
        onChange={(event) => player.setVolume(Number(event.target.value))}
      />
      {error ? (
        <p className="mini-error" role="alert">
          <span>{error}</span>
          {openExternalHref ? (
            <button type="button" className="btn" onClick={() => void openExternal()}>
              Im Browser öffnen
            </button>
          ) : null}
        </p>
      ) : null}
      {openError ? (
        <p className="mini-error" role="alert">
          {openError}
        </p>
      ) : null}
    </div>
  )
}
