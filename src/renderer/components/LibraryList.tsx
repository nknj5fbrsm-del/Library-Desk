import { groupEntriesForDisplay } from '@shared/versionGroups'
import type { Entry } from '@shared/types'
import { CoverThumb } from '@renderer/components/CoverThumb'

interface LibraryListProps {
  entries: Entry[]
  selectedId: string | null
  loading: boolean
  error: string | null
  filtered: boolean
  onSelect: (id: string) => void
}

function AudioIcon(): JSX.Element {
  return (
    <svg className="audio-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M2.5 6.25h2.1L8 3.5v9L4.6 9.75H2.5v-3.5zm6.15-.85a3.4 3.4 0 0 1 0 5.2l-.75-.72a2.35 2.35 0 0 0 0-3.76l.75-.72z"
      />
    </svg>
  )
}

export function LibraryList({
  entries,
  selectedId,
  loading,
  error,
  filtered,
  onSelect,
}: LibraryListProps): JSX.Element {
  const groups = groupEntriesForDisplay(entries)

  return (
    <nav className="library" aria-label="Bibliothek">
      {error ? (
        <p className="list-message" role="alert">
          {error}
        </p>
      ) : null}
      {!error && loading && entries.length === 0 ? (
        <p className="list-message">Lädt…</p>
      ) : null}
      {!error && !loading && groups.length === 0 ? (
        <p className="list-message">{filtered ? 'Keine Treffer.' : 'Noch keine Einträge.'}</p>
      ) : null}
      {groups.length > 0 ? (
        <ul className="library-list">
          {groups.map((group) => {
            const showChips = group.versions.length >= 2
            const active = group.versions.some((entry) => entry.id === selectedId)
            const isPower = group.versions.some((entry) => entry.isPower)
            const hasAudio = group.versions.some((entry) => entry.audio !== null)
            return (
              <li key={group.key} className={active ? 'group is-active' : 'group'}>
                <button
                  type="button"
                  className="group-main"
                  aria-current={active && !showChips ? 'true' : undefined}
                  onClick={() => onSelect(group.representative.id)}
                >
                  <CoverThumb entry={group.representative} size="list" />
                  <span className="group-title">{group.representative.title}</span>
                  {isPower ? <span className="power-mark">Power</span> : null}
                  {hasAudio ? (
                    <span className="audio-mark" title="Audio">
                      <AudioIcon />
                      <span className="sr-only">Audio</span>
                    </span>
                  ) : null}
                </button>
                {showChips ? (
                  <div className="chips" role="group" aria-label={`Versionen von ${group.representative.title}`}>
                    {group.versions.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className={entry.id === selectedId ? 'chip is-active' : 'chip'}
                        aria-pressed={entry.id === selectedId}
                        onClick={() => onSelect(entry.id)}
                      >
                        V{entry.version}
                      </button>
                    ))}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </nav>
  )
}
