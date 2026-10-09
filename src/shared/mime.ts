/** Best-effort MIME from filename; used after zip import when Blob.type is empty. */
export function mimeFromFilename(name: string): string {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : ''
  switch (ext) {
    case 'pdf':
      return 'application/pdf'
    case 'txt':
    case 'text':
      return 'text/plain'
    case 'md':
    case 'markdown':
      return 'text/markdown'
    case 'html':
    case 'htm':
      return 'text/html'
    case 'csv':
      return 'text/csv'
    case 'json':
      return 'application/json'
    case 'rtf':
      return 'application/rtf'
    case 'doc':
      return 'application/msword'
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case 'odt':
      return 'application/vnd.oasis.opendocument.text'
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    default:
      return 'application/octet-stream'
  }
}

/** Types the browser can usually show in a tab instead of downloading. */
export function canOpenInBrowser(mime: string): boolean {
  return (
    mime === 'application/pdf' ||
    mime === 'application/json' ||
    mime.startsWith('text/') ||
    mime.startsWith('image/')
  )
}
