import { useEffect, useId, useRef, useState } from 'react'

export interface OverflowMenuItem {
  id: string
  label: string
  danger?: boolean
  disabled?: boolean
  onSelect: () => void
}

interface OverflowMenuProps {
  label: string
  items: OverflowMenuItem[]
  disabled?: boolean
  align?: 'start' | 'end'
  /** Called when the menu opens (e.g. activate the related list row). */
  onOpen?: () => void
}

export function OverflowMenu({
  label,
  items,
  disabled = false,
  align = 'end',
  onOpen,
}: OverflowMenuProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOpen(false)
    }
    // Defer so the opening click does not immediately close the menu.
    const timer = window.setTimeout(() => {
      window.addEventListener('pointerdown', onPointerDown)
      window.addEventListener('keydown', onKey)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div
      className={align === 'start' ? 'overflow-menu align-start' : 'overflow-menu'}
      ref={rootRef}
    >
      <button
        type="button"
        className="overflow-menu-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((wasOpen) => {
            const next = !wasOpen
            if (next) onOpen?.()
            return next
          })
        }}
      >
        <span aria-hidden="true">•••</span>
      </button>
      {open ? (
        <ul id={menuId} className="overflow-menu-list" role="menu">
          {items.map((item) => (
            <li key={item.id} role="none">
              <button
                type="button"
                role="menuitem"
                className={item.danger ? 'overflow-menu-item is-danger' : 'overflow-menu-item'}
                disabled={item.disabled}
                onClick={(event) => {
                  event.stopPropagation()
                  setOpen(false)
                  item.onSelect()
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
