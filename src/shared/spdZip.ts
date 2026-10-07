import JSZip from 'jszip'

export interface SpdZipMediaFile {
  /** Path inside zip, e.g. media/<entryId>/song.m4a */
  path: string
  data: Uint8Array
}

export function mediaZipPath(entryId: string, filename: string): string {
  const safe = filename.replace(/[\\/]+/g, '_').replace(/^\.+/, '').trim() || 'file'
  return `media/${entryId}/${safe}`
}

export async function packSpdZip(
  libraryJson: string,
  files: SpdZipMediaFile[],
): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file('library.json', libraryJson)
  for (const file of files) {
    zip.file(file.path, file.data)
  }
  const packed = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  return packed
}

export async function unpackSpdZip(data: Uint8Array): Promise<{
  libraryJson: string
  files: Map<string, Uint8Array>
}> {
  const zip = await JSZip.loadAsync(data)
  const libraryFile = zip.file('library.json')
  if (!libraryFile) throw new Error('Ungültiges SPD-Zip: library.json fehlt')
  const libraryJson = await libraryFile.async('string')
  const files = new Map<string, Uint8Array>()
  const tasks: Promise<void>[] = []
  zip.forEach((relativePath, file) => {
    if (file.dir || relativePath === 'library.json') return
    tasks.push(
      file.async('uint8array').then((bytes) => {
        files.set(relativePath.replace(/^\/+/, ''), bytes)
      }),
    )
  })
  await Promise.all(tasks)
  return { libraryJson, files }
}

export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
}
