import type { StarRating } from '@shared/types'

interface StarRatingInputProps {
  value: StarRating
  onChange: (value: StarRating) => void
  disabled?: boolean
}

export function StarRatingInput({
  value,
  onChange,
  disabled = false,
}: StarRatingInputProps): JSX.Element {
  return (
    <div className="star-rating" role="group" aria-label="Sternebewertung">
      {([1, 2, 3, 4, 5] as const).map((star) => {
        const active = value >= star
        return (
          <button
            key={star}
            type="button"
            className={active ? 'star is-on' : 'star'}
            aria-label={`${star} Stern${star === 1 ? '' : 'e'}`}
            aria-pressed={value === star}
            disabled={disabled}
            onClick={() => onChange(value === star ? 0 : star)}
          >
            ★
          </button>
        )
      })}
    </div>
  )
}

export function StarRatingDisplay({ value }: { value: StarRating }): JSX.Element | null {
  if (value <= 0) return null
  return (
    <span className="star-display" title={`${value}/5`} aria-label={`${value} von 5 Sternen`}>
      {'★'.repeat(value)}
      <span className="star-display-empty">{'★'.repeat(5 - value)}</span>
    </span>
  )
}
