import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { net, protocol } from 'electron'
import { audioRootFor, parseLocalPlaybackUrl, resolveLocalAudioFile } from './audioFs'
import {
  coverRootFor,
  parseCoverDisplayUrl,
  resolveLocalCoverFile,
} from './coverFs'

export function registerDeskAudioProtocol(userData: string): void {
  const audioRoot = audioRootFor(userData)
  const coverRoot = coverRootFor(userData)
  protocol.handle('desk', (request) => {
    const audio = parseLocalPlaybackUrl(request.url)
    if (audio) {
      let filePath: string
      try {
        filePath = resolveLocalAudioFile(audioRoot, audio.entryId, audio.relativePath)
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
    }

    const cover = parseCoverDisplayUrl(request.url)
    if (cover) {
      let filePath: string
      try {
        filePath = resolveLocalCoverFile(coverRoot, cover.entryId, cover.relativePath)
      } catch {
        return new Response(null, { status: 404 })
      }
      if (!existsSync(filePath)) return new Response(null, { status: 404 })
      return net.fetch(pathToFileURL(filePath).href, {
        bypassCustomProtocolHandlers: true,
      })
    }

    return new Response(null, { status: 404 })
  })
}
