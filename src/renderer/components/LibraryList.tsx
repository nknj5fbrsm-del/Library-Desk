import {
  formatCopyBoth,
  formatCopyGeneralAll,
  formatCopyLyrics,
  formatCopyPromptBody,
  formatCopyStyle,
  formatCopySystemRole,
  formatCopyUsageGuide,
} from '@shared/copyFormat'
import { kindLabel } from '@shared/entryKind'
import { groupEntriesForDisplay } from '@shared/versionGroups'
import type { Entry } from '@shared/types'
import { CoverThumb } from '@renderer/components/CoverThumb'
import { OverflowMenu, type OverflowMenuItem } from '@renderer/components/OverflowMenu'
import { StarRatingDisplay } from '@renderer/components/StarRating'

interface LibraryListProps {
  entries: Entry[]
  selectedId: string | null
  loading: boolean
  error: string | null
  filtered: boolean
  busy?: boolean
  selecting?: boolean
  selectedGroupIds?: ReadonlySet<string>
  onSelect: (id: string) => void
  onToggleGroup?: (groupId: string) => void
  onDelete: (entry: Entry) => void
  onDuplicate: (id: string) => void
  onExportEntry: (id: string) => void
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

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

function menuItemsFor(
  entry: Entry,
  busy: boolean,
  handlers: {
    onDuplicate: (id: string) => void
    onExportEntry: (id: string) => void
    onDelete: (entry: Entry) => void
  },
): OverflowMenuItem[] {
  const copyItems: OverflowMenuItem[] =
    entry.kind === 'general'
      ? [
          {
            id: 'copy-prompt',
            label: 'Prompt kopieren',
            disabled: busy,
            onSelect: () => void copyText(formatCopyPromptBody(entry.promptBody)),
          },
          {
            id: 'copy-role',
            label: 'Rolle kopieren',
            disabled: busy,
            onSelect: () => void copyText(formatCopySystemRole(entry.systemRole)),
          },
          {
            id: 'copy-usage',
            label: 'Anwendung kopieren',
            disabled: busy,
            onSelect: () => void copyText(formatCopyUsageGuide(entry.usageGuide)),
          },
          {
            id: 'copy-all',
            label: 'Alles kopieren',
            disabled: busy,
            onSelect: () =>
              void copyText(
                formatCopyGeneralAll(entry.systemRole, entry.usageGuide, entry.promptBody),
              ),
          },
        ]
      : [
          {
            id: 'copy-style',
            label: 'Style kopieren',
            disabled: busy,
            onSelect: () => void copyText(formatCopyStyle(entry.stylePrompt)),
          },
          {
            id: 'copy-lyrics',
            label: 'Lyrics kopieren',
            disabled: busy,
            onSelect: () => void copyText(formatCopyLyrics(entry.lyrics)),
          },
          {
            id: 'copy-both',
            label: 'Beides kopieren',
            disabled: busy,
            onSelect: () => void copyText(formatCopyBoth(entry.stylePrompt, entry.lyrics)),
          },
        ]

  return [
    {
      id: 'duplicate',
      label: 'Duplizieren',
      disabled: busy,
      onSelect: () => handlers.onDuplicate(entry.id),
    },
    {
      id: 'export',
      label: 'Export',
      disabled: busy,
      onSelect: () => handlers.onExportEntry(entry.id),
    },
    {
      id: 'delete',
      label: 'Löschen',
      danger: true,
      disabled: busy,
      onSelect: () => handlers.onDelete(entry),
    },
    ...copyItems,
  ]
}

export function LibraryList({
  entries,
  selectedId,
  loading,
  error,
  filtered,
  busy = false,
  selecting = false,
  selectedGroupIds,
  onSelect,
  onToggleGroup,
  onDelete,
  onDuplicate,
  onExportEntry,
}: LibraryListProps): JSX.Element {
  const groups = groupEntriesForDisplay(entries)

  return (
    <nav className={selecting ? 'library is-selecting' : 'library'} aria-label="Bibliothek">
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
            const rating = Math.max(...group.versions.map((entry) => entry.rating)) as Entry['rating']
            const hasAudio = group.versions.some((entry) => entry.audio !== null)
            const kind = group.representative.kind
            const actionTarget =
              group.versions.find((entry) => entry.id === selectedId) ?? group.representative
            const checked = selectedGroupIds?.has(group.key) ?? false
            return (
              <li key={group.key} className={active ? 'group is-active' : 'group'}>
                <div className="group-row">
                  {selecting ? (
                    <label className="group-select">
                      <input
                        type="checkbox"
                        checked={checked}
                        aria-label={`„${group.representative.title}“ auswählen`}
                        onChange={() => onToggleGroup?.(group.key)}
                      />
                    </label>
                  ) : null}
                  <button
                    type="button"
                    className="group-main"
                    aria-current={active && !showChips ? 'true' : undefined}
                    onClick={() => {
                      if (selecting) {
                        onToggleGroup?.(group.key)
                        return
                      }
                      onSelect(group.representative.id)
                    }}
                  >
                    {kind === 'suno' ? <CoverThumb entry={group.representative} /> : null}
                    <span
                      className={
                        kind === 'general' ? 'kind-mark is-general' : 'kind-mark is-suno'
                      }
                      title={kindLabel(kind)}
                    >
                      {kind === 'general' ? 'Allg.' : 'Suno'}
                    </span>
                    <span className="group-title">{group.representative.title}</span>
                    <StarRatingDisplay value={rating} />
                    {hasAudio ? (
                      <span className="audio-mark" title="Audio">
                        <AudioIcon />
                        <span className="sr-only">Audio</span>
                      </span>
                    ) : null}
                  </button>
                  {!selecting ? (
                    <OverflowMenu
                      label={`Aktionen für „${actionTarget.title}“`}
                      disabled={busy}
                      onOpen={() => onSelect(actionTarget.id)}
                      items={menuItemsFor(actionTarget, busy, {
                        onDuplicate,
                        onExportEntry,
                        onDelete,
                      })}
                    />
                  ) : null}
                </div>
                {showChips ? (
                  <div className="chips" role="group" aria-label={`Versionen von ${group.representative.title}`}>
                    {group.versions.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className={entry.id === selectedId ? 'chip is-active' : 'chip'}
                        aria-pressed={entry.id === selectedId}
                        disabled={selecting}
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
