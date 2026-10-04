import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { net, protocol } from 'electron'
import { audioRootFor, parseLocalPlaybackUrl, resolveLocalAudioFile } from './audioFs'

export function registerDeskAudioProtocol(userData: string): void {
  const audioRoot = audioRootFor(userData)
  protocol.handle('desk', (request) => {
    const parsed = parseLocalPlaybackUrl(request.url)
    if (!parsed) return new Response(null, { status: 404 })
    let filePath: string
    try {
      filePath = resolveLocalAudioFile(audioRoot, parsed.entryId, parsed.relativePath)
    } catch {
      return new Response(null, { status: 404 })
    }
    if (!existsSync(filePath)) return new Response(null, { status: 404 })
    const headers = new Headers()
    const range = request.headers.get('range')
    if (range) headers.set('range', range)
    return net.fetch(pathToFileURL(filePath).href, {
      headers,
      bypassCustomProtocolHandlers: true,
    })
  })
}
