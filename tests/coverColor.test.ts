import { describe, expect, it } from 'vitest'
import { pickDominantRgb, rgbToAmbience } from '../src/renderer/coverColor'

function rgbaBuffer(pixels: Array<[number, number, number, number?]>): Uint8ClampedArray {
  const data = new Uint8ClampedArray(pixels.length * 4)
  pixels.forEach(([r, g, b, a = 255], index) => {
    const offset = index * 4
    data[offset] = r
    data[offset + 1] = g
    data[offset + 2] = b
    data[offset + 3] = a
  })
  return data
}

describe('coverColor', () => {
  it('picks the most common vivid color and ignores near-white', () => {
    const pixels: Array<[number, number, number, number?]> = []
    for (let i = 0; i < 40; i += 1) pixels.push([220, 40, 80])
    for (let i = 0; i < 10; i += 1) pixels.push([250, 250, 250])
    for (let i = 0; i < 8; i += 1) pixels.push([30, 140, 200])

    const rgb = pickDominantRgb(rgbaBuffer(pixels), 24)
    expect(rgb).not.toBeNull()
    expect(rgb!.r).toBeGreaterThan(rgb!.g)
    expect(rgb!.r).toBeGreaterThan(rgb!.b)
  })

  it('returns null when only gray/black/white pixels exist', () => {
    const rgb = pickDominantRgb(
      rgbaBuffer([
        [0, 0, 0],
        [255, 255, 255],
        [120, 120, 120],
      ]),
    )
    expect(rgb).toBeNull()
  })

  it('formats ambience rgba', () => {
    expect(rgbToAmbience({ r: 10.2, g: 20.8, b: 30 }, 0.35)).toBe('rgba(10, 21, 30, 0.35)')
    expect(rgbToAmbience({ r: 10, g: 20, b: 30 })).toBe('rgba(10, 20, 30, 0.55)')
  })
})
