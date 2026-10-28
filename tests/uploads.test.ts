import { createServer, type Server } from 'node:http'
import { mkdtemp, rm, truncate, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { executeRequest, prepareRequest } from '../src/main/http'
import { inspectAttachment } from '../src/main/uploads'
import {
  MAX_UPLOAD_BYTES,
  newMultipartField,
  newPair,
  newRequest,
  type Attachment,
  type RequestDraft,
} from '../src/shared/contracts'

let directory: string
let server: Server
let baseUrl: string
let file: Attachment
let received = 0
const bytes = Buffer.from([0, 255, 128, 13, 10, 34, 65])
const request = (patch: Partial<RequestDraft> = {}): RequestDraft => ({
  ...newRequest(),
  method: 'POST',
  url: baseUrl,
  ...patch,
})
const fileField = () => ({ ...newMultipartField('file'), key: 'upload', files: [file] })

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'wpost-uploads-'))
  const path = join(directory, '한글 공백.bin')
  await writeFile(path, bytes)
  file = await inspectAttachment(path)
  server = createServer(async (incoming, outgoing) => {
    received++
    if (incoming.url === '/redirect' || incoming.url === '/redirect308') {
      outgoing.writeHead(incoming.url === '/redirect308' ? 308 : 307, { Location: '/' })
      outgoing.end()
      return
    }
    if (incoming.url === '/slow') {
      incoming.resume()
      const timer = setTimeout(() => outgoing.end('late'), 1000)
      outgoing.on('close', () => clearTimeout(timer))
      return
    }
    const chunks: Buffer[] = []
    for await (const chunk of incoming) chunks.push(chunk as Buffer)
    const body = Buffer.concat(chunks)
    const contentType = incoming.headers['content-type'] ?? ''
    const fields: unknown[] = []
    if (contentType.startsWith('multipart/')) {
      const form = await new Response(body, { headers: { 'Content-Type': contentType } }).formData()
      for (const [key, value] of form)
        fields.push(
          typeof value === 'string'
            ? { key, value }
            : {
                key,
                name: value.name,
                type: value.type,
                bytes: Buffer.from(await value.arrayBuffer()).toString('base64'),
              },
        )
    }
    outgoing.writeHead(200, { 'Content-Type': 'application/json' })
    outgoing.end(
      JSON.stringify({
        fields,
        contentType,
        bytes: body.toString('base64'),
        query: incoming.url,
        contentLength: incoming.headers['content-length'],
        length: body.length,
      }),
    )
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => {
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await rm(directory, { recursive: true, force: true })
})

describe('file request bodies', () => {
  it('sends multipart text, duplicate fields and multiple binary files with valid automatic framing', async () => {
    const draft = request({
      bodyMode: 'multipart',
      params: [newPair('q', '한글')],
      headers: [
        newPair('Content-Type', 'application/json'),
        newPair('Content-Length', '1'),
        newPair('Transfer-Encoding', 'chunked'),
      ],
      multipart: [
        { ...newMultipartField(), key: '{{field}}', value: '{{value}}' },
        { ...newMultipartField(), key: 'tag', value: 'second' },
        { ...fileField(), files: [file, file] },
        { ...fileField(), enabled: false, files: [{ ...file, path: '/missing' }] },
        { ...fileField(), key: '', files: [] },
      ],
    })
    const entry = await executeRequest(draft, {
      id: crypto.randomUUID(),
      name: 'local',
      values: [newPair('field', 'tag'), newPair('value', '한글 & 값')],
    })
    expect(entry.response.error).toBeNull()
    expect(entry.response.status).toBe(200)
    const result = JSON.parse(entry.response.bodyText)
    expect(result.fields).toEqual([
      { key: 'tag', value: '한글 & 값' },
      { key: 'tag', value: 'second' },
      ...[1, 2].map(() => ({
        key: 'upload',
        name: file.name,
        type: 'application/octet-stream',
        bytes: bytes.toString('base64'),
      })),
    ])
    expect(result.contentType).toMatch(/^multipart\/form-data; boundary=/)
    expect(Number(result.contentLength)).toBe(result.length)
    expect(result.query).toContain('q=%ED%95%9C%EA%B8%80')
    expect(entry.request.multipart).toHaveLength(3)
    expect(entry.request.multipart[0].value).toBe('한글 & 값')
    expect(entry.request.body).toBe('')
    expect(draft.multipart[0].value).toBe('{{value}}')
    const replay = await executeRequest(entry.request)
    expect(JSON.parse(replay.response.bodyText).fields).toEqual(result.fields)
  })

  it('sends raw binary bytes and replays file-backed bodies through 307 and 308 redirects', async () => {
    for (const mode of ['binary', 'multipart'] as const) {
      const entry = await executeRequest(
        request({
          url: baseUrl + (mode === 'binary' ? '/redirect' : '/redirect308'),
          bodyMode: mode,
          binaryFile: file,
          multipart: [fileField()],
        }),
      )
      expect(entry.response.error).toBeNull()
      expect(entry.response.finalUrl).toBe(baseUrl + '/')
      const result = JSON.parse(entry.response.bodyText)
      if (mode === 'binary') {
        expect(result.contentType).toBe('application/octet-stream')
        expect(result.bytes).toBe(bytes.toString('base64'))
        expect(Number(result.contentLength)).toBe(bytes.length)
      } else expect(result.fields[0].bytes).toBe(bytes.toString('base64'))
    }
    const entry = await executeRequest(
      request({
        bodyMode: 'binary',
        binaryFile: file,
        headers: [newPair('Content-Type', 'application/custom')],
      }),
    )
    expect(JSON.parse(entry.response.bodyText).contentType).toBe('application/custom')
  })

  it('uploads empty files and derives MIME types from file names', async () => {
    const path = join(directory, 'empty.JSON')
    await writeFile(path, '')
    const empty = await inspectAttachment(path)
    for (const mode of ['binary', 'multipart'] as const) {
      const entry = await executeRequest(
        request({
          bodyMode: mode,
          binaryFile: empty,
          multipart: [{ ...fileField(), files: [empty] }],
        }),
      )
      const result = JSON.parse(entry.response.bodyText)
      expect(entry.response.error).toBeNull()
      if (mode === 'binary') {
        expect(result.contentType).toBe('application/json')
        expect(result.bytes).toBe('')
      } else expect(result.fields[0]).toMatchObject({ type: 'application/json', bytes: '' })
    }
  })

  it('uploads files larger than the text body limit without truncating bytes', async () => {
    const path = join(directory, 'larger-than-text.bin')
    const content = Buffer.alloc(1_048_577, 0x9f)
    await writeFile(path, content)
    const attachment = await inspectAttachment(path)
    for (const mode of ['binary', 'multipart'] as const) {
      const entry = await executeRequest(
        request({
          bodyMode: mode,
          binaryFile: attachment,
          multipart: [{ ...fileField(), files: [attachment] }],
        }),
      )
      expect(entry.response.error).toBeNull()
      expect(entry.response.truncated).toBe(false)
      const result = JSON.parse(entry.response.bodyText)
      expect(
        Buffer.from(mode === 'binary' ? result.bytes : result.fields[0].bytes, 'base64'),
      ).toEqual(content)
    }
  })

  it('reports missing selections, missing files, directories and relative paths without sending', async () => {
    const before = received
    const patches: Partial<RequestDraft>[] = [
      { bodyMode: 'binary' },
      { bodyMode: 'multipart', multipart: [{ ...fileField(), files: [] }] },
      ...[join(directory, 'missing'), directory, 'relative.bin'].map((path) => ({
        bodyMode: 'binary' as const,
        binaryFile: { ...file, path },
      })),
    ]
    for (const patch of patches) {
      const entry = await executeRequest(request(patch))
      expect(entry.response.status).toBeNull()
      expect(entry.response.error).toMatch(/파일|경로/)
    }
    expect(received).toBe(before)
    for (const bodyMode of ['binary', 'multipart'] as const)
      for (const method of ['GET', 'HEAD'] as const)
        expect(() => prepareRequest(request({ method, bodyMode }))).toThrow('GET / HEAD')
  })

  it('enforces byte, text and file-count limits before any network request', async () => {
    const path = join(directory, 'sparse.bin')
    await writeFile(path, '')
    await truncate(path, MAX_UPLOAD_BYTES + 1)
    const before = received
    expect(
      (
        await executeRequest(
          request({ bodyMode: 'binary', binaryFile: { ...file, path, size: 1 } }),
        )
      ).response.error,
    ).toContain('100 MiB')
    await truncate(path, 60 * 1024 * 1024)
    const large = await inspectAttachment(path)
    expect(
      (
        await executeRequest(
          request({
            bodyMode: 'multipart',
            multipart: [{ ...fileField(), files: [large, large] }],
          }),
        )
      ).response.error,
    ).toContain('100 MiB')
    expect(
      (
        await executeRequest(
          request({ bodyMode: 'multipart', multipart: Array.from({ length: 101 }, fileField) }),
        )
      ).response.error,
    ).toContain('100개')
    expect(
      (
        await executeRequest(
          request({
            bodyMode: 'multipart',
            multipart: [1, 2].map(() => ({
              ...newMultipartField(),
              key: 'text',
              value: 'x'.repeat(524_289),
            })),
          }),
        )
      ).response.error,
    ).toContain('1 MiB')
    expect(received).toBe(before)
  })

  it('supports cancellation and timeouts for uploads', async () => {
    const controller = new AbortController()
    controller.abort()
    const draft = request({ url: baseUrl + '/slow', bodyMode: 'binary', binaryFile: file })
    expect((await executeRequest(draft, undefined, controller.signal)).response.error).toBe(
      '요청을 취소했습니다.',
    )
    expect((await executeRequest({ ...draft, timeoutMs: 100 })).response.error).toContain(
      '제한 시간',
    )
    const running = new AbortController()
    const result = executeRequest(draft, undefined, running.signal)
    const timer = setTimeout(() => running.abort(), 30)
    try {
      expect((await result).response.error).toBe('요청을 취소했습니다.')
    } finally {
      clearTimeout(timer)
    }
  })

  it('reads the current file on replay and reports a removed source file', async () => {
    const path = join(directory, 'changing.txt')
    await writeFile(path, 'before')
    const attachment = await inspectAttachment(path)
    const entry = await executeRequest(
      request({ bodyMode: 'binary', binaryFile: { ...attachment, path: '{{path}}' } }),
      { id: crypto.randomUUID(), name: 'local', values: [newPair('path', path)] },
    )
    expect(entry.request.binaryFile?.path).toBe(path)
    await writeFile(path, 'after update')
    const replay = await executeRequest(entry.request)
    expect(JSON.parse(replay.response.bodyText).bytes).toBe(
      Buffer.from('after update').toString('base64'),
    )
    expect(replay.request.binaryFile?.size).toBe(12)
    await rm(path)
    expect((await executeRequest(replay.request)).response.error).toContain('다시 선택')
  })
})
