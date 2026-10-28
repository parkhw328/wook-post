import { openAsBlob } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename, extname, isAbsolute } from 'node:path'
import {
  attachmentSchema,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  type Attachment,
  type RequestDraft,
} from '../shared/contracts'

const mediaTypes: Record<string, string> = {
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.html': 'text/html',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
}

export async function inspectAttachment(path: string): Promise<Attachment> {
  if (!isAbsolute(path)) throw new Error(`파일을 다시 선택하세요. 절대 경로가 필요합니다: ${path}`)
  let info
  try {
    info = await stat(path)
  } catch {
    throw new Error(`첨부 파일을 찾거나 읽을 수 없습니다. 파일을 다시 선택하세요: ${path}`)
  }
  if (!info.isFile()) throw new Error(`일반 파일만 첨부할 수 있습니다: ${path}`)
  if (info.size > MAX_UPLOAD_BYTES) throw new Error('첨부 파일은 합계 100 MiB까지 지원합니다.')
  return attachmentSchema.parse({ path, name: basename(path), size: info.size })
}

export async function prepareUpload(
  snapshot: RequestDraft,
  headers: Headers,
  signal: AbortSignal,
): Promise<FormData | Blob> {
  // File-backed blobs keep uploads out of IPC, SQLite and the renderer's memory.
  let total = 0
  let count = 0
  const open = async (file: Attachment) => {
    signal.throwIfAborted()
    if (++count > MAX_UPLOAD_FILES) throw new Error('첨부 파일은 요청당 100개까지 지원합니다.')
    const current = await inspectAttachment(file.path)
    const blob = await openAsBlob(current.path, {
      type: mediaTypes[extname(current.name).toLowerCase()] ?? 'application/octet-stream',
    })
    total += blob.size
    if (total > MAX_UPLOAD_BYTES)
      throw new Error('첨부 파일과 폼 값은 합계 100 MiB까지 지원합니다.')
    signal.throwIfAborted()
    return { file: { ...current, size: blob.size }, blob }
  }
  // Let fetch calculate framing from the actual bytes, including multipart boundaries.
  headers.delete('Content-Length')
  headers.delete('Transfer-Encoding')
  if (snapshot.bodyMode === 'binary') {
    if (!snapshot.binaryFile) throw new Error('바이너리 본문으로 보낼 파일을 선택하세요.')
    const { file, blob } = await open(snapshot.binaryFile)
    snapshot.binaryFile = file
    if (!headers.has('Content-Type')) headers.set('Content-Type', blob.type)
    return blob
  }
  const body = new FormData()
  total = snapshot.multipart.reduce(
    (size, field) => size + (field.type === 'text' ? Buffer.byteLength(field.value) : 0),
    0,
  )
  if (total > 1_048_576) throw new Error('폼의 텍스트 값은 합계 1 MiB까지 지원합니다.')
  for (const field of snapshot.multipart) {
    signal.throwIfAborted()
    if (field.type === 'text') body.append(field.key, field.value)
    else {
      if (!field.files.length) throw new Error(`"${field.key}" 필드에 첨부할 파일을 선택하세요.`)
      const files: Attachment[] = []
      for (const selected of field.files) {
        const { file, blob } = await open(selected)
        files.push(file)
        body.append(field.key, blob, file.name)
      }
      field.files = files
    }
  }
  // A manually supplied boundary cannot describe FormData's generated body.
  headers.delete('Content-Type')
  return body
}
