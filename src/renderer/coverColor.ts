/** RGB 0–255 */
export interface Rgb {
  r: number
  g: number
  b: number
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === 0) return 0
  return (max - min) / max
}

function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/** Boost chroma slightly so the window glow reads clearly. */
export function enrichAmbienceColor(rgb: Rgb): Rgb {
  const avg = (rgb.r + rgb.g + rgb.b) / 3
  const boost = 1.35
  return {
    r: clampByte(avg + (rgb.r - avg) * boost),
    g: clampByte(avg + (rgb.g - avg) * boost),
    b: clampByte(avg + (rgb.b - avg) * boost),
  }
}

/**
 * Pick a vivid-ish dominant color from RGBA pixel data.
 * Skips near-black, near-white, and very gray pixels.
 */
export function pickDominantRgb(data: Uint8ClampedArray, step = 24): Rgb | null {
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>()

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] ?? 0
    if (a < 200) continue
    const r = data[i] ?? 0
    const g = data[i + 1] ?? 0
    const b = data[i + 2] ?? 0
    const lum = luminance(r, g, b)
    if (lum < 0.12 || lum > 0.9) continue
    if (saturation(r, g, b) < 0.08) continue

    const key = `${Math.floor(r / step)}:${Math.floor(g / step)}:${Math.floor(b / step)}`
    const current = buckets.get(key)
    if (current) {
      current.count += 1
      current.r += r
      current.g += g
      current.b += b
    } else {
      buckets.set(key, { count: 1, r, g, b })
    }
  }

  let best: { count: number; r: number; g: number; b: number } | null = null
  for (const bucket of buckets.values()) {
    if (!best || bucket.count > best.count) best = bucket
  }
  if (!best) return null

  return enrichAmbienceColor({
    r: best.r / best.count,
    g: best.g / best.count,
    b: best.b / best.count,
  })
}

export function rgbToAmbience(rgb: Rgb, alpha = 0.4): string {
  return `rgba(${clampByte(rgb.r)}, ${clampByte(rgb.g)}, ${clampByte(rgb.b)}, ${alpha})`
}

export async function extractCoverAmbience(url: string): Promise<string | null> {
  const image = await loadImage(url)
  const size = 48
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(image, 0, 0, size, size)
  let pixels: ImageData
  try {
    pixels = ctx.getImageData(0, 0, size, size)
  } catch {
    return null
  }
  const rgb = pickDominantRgb(pixels.data)
  return rgb ? rgbToAmbience(rgb) : null
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Cover image failed to load'))
    image.src = url
  })
}
