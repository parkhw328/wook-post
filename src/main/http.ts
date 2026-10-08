import { randomUUID } from 'node:crypto'
import {
  MAX_BODY_BYTES,
  requestSchema,
  type Environment,
  type HistoryEntry,
  type Pair,
  type RequestDraft,
  type ResponseResult,
} from '../shared/contracts'

export function prepareRequest(input: RequestDraft, environment?: Environment) {
  const draft = requestSchema.parse(input)
  const variables = new Map(
    environment?.values
      .filter((item) => item.enabled && item.key)
      .map((item) => [item.key, item.value]),
  )
  const resolve = (text: string) =>
    text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, key: string) => {
      if (!variables.has(key)) throw new Error(`환경 변수 "${key}"에 값이 없습니다.`)
      return variables.get(key)!
    })
  const resolvePairs = (pairs: Pair[]) =>
    pairs
      .filter((item) => item.enabled && item.key)
      .map((item) => ({ ...item, key: resolve(item.key), value: resolve(item.value) }))
  const url = new URL(resolve(draft.url))
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('http:// 또는 https:// 주소만 지원합니다.')
  if (url.username || url.password) throw new Error('URL의 계정 정보 대신 인증 탭을 사용하세요.')
  const params = resolvePairs(draft.params)
  for (const pair of params) url.searchParams.append(pair.key, pair.value)
  const headerPairs = resolvePairs(draft.headers)
  const headers = new Headers()
  for (const pair of headerPairs) headers.append(pair.key, pair.value)
  const auth = { ...draft.auth }
  if (auth.type === 'bearer') {
    auth.token = resolve(auth.token)
    headers.set('Authorization', `Bearer ${auth.token}`)
  } else if (auth.type === 'basic') {
    auth.username = resolve(auth.username)
    auth.password = resolve(auth.password)
    headers.set(
      'Authorization',
      `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}`,
    )
  }
  let body: string | undefined
  const form = draft.bodyMode === 'form' ? resolvePairs(draft.form) : []
  if (draft.bodyMode !== 'none' && ['GET', 'HEAD'].includes(draft.method))
    throw new Error('GET / HEAD 요청에는 본문을 사용할 수 없습니다. 본문 유형을 없음으로 바꾸세요.')
  if (draft.bodyMode === 'json') {
    body = resolve(draft.body)
    try {
      JSON.parse(body)
    } catch {
      throw new Error('요청 본문이 올바른 JSON이 아닙니다.')
    }
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  } else if (draft.bodyMode === 'text') {
    body = resolve(draft.body)
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'text/plain; charset=utf-8')
  } else if (draft.bodyMode === 'form') {
    body = new URLSearchParams(form.map((item) => [item.key, item.value])).toString()
    if (!headers.has('Content-Type'))
      headers.set('Content-Type', 'application/x-www-form-urlencoded')
  }
  if (body && Buffer.byteLength(body) > 1_048_576)
    throw new Error('요청 본문은 1 MiB까지 지원합니다.')
  // Freeze the values actually sent so history replay does not depend on a changed environment.
  const snapshot: RequestDraft = {
    ...draft,
    url: url.toString(),
    params: [],
    headers: headerPairs,
    auth,
    body: body ?? '',
    form,
  }
  return { url: url.toString(), headers, body, snapshot: requestSchema.parse(snapshot) }
}

export async function executeRequest(
  draft: RequestDraft,
  environment?: Environment,
  signal?: AbortSignal,
): Promise<HistoryEntry> {
  const prepared = prepareRequest(draft, environment)
  const startedAt = new Date().toISOString()
  const started = performance.now()
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), draft.timeoutMs)
  const combined = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal
  const response: ResponseResult = {
    status: null,
    statusText: '',
    headers: [],
    bodyText: '',
    bodyBase64: '',
    encoding: 'text',
    sizeBytes: 0,
    durationMs: 0,
    finalUrl: prepared.url,
    error: null,
    truncated: false,
  }
  try {
    const result = await fetch(prepared.url, {
      method: draft.method,
      headers: prepared.headers,
      body: prepared.body,
      redirect: draft.followRedirects ? 'follow' : 'manual',
      signal: combined,
    })
    response.status = result.status
    response.statusText = result.statusText
    response.finalUrl = result.url
    result.headers.forEach((value, key) => {
      if (key !== 'set-cookie') response.headers.push({ key, value })
    })
    for (const value of result.headers.getSetCookie())
      response.headers.push({ key: 'set-cookie', value })
    const chunks: Buffer[] = []
    const reader = result.body?.getReader()
    try {
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          const remaining = MAX_BODY_BYTES - response.sizeBytes
          chunks.push(Buffer.from(value.subarray(0, remaining)))
          response.sizeBytes += Math.min(value.byteLength, remaining)
          if (value.byteLength > remaining) {
            response.truncated = true
            await reader.cancel()
            break
          }
        }
      }
    } catch (error) {
      response.truncated = true
      throw error
    } finally {
      reader?.releaseLock()
      const bytes = Buffer.concat(chunks)
      response.bodyBase64 = bytes.toString('base64')
      const contentType = result.headers.get('content-type') ?? ''
      const textual = /text\/|json|xml|javascript|x-www-form-urlencoded/i.test(contentType)
      if (textual || !contentType) {
        try {
          const charset = /charset\s*=\s*["']?([^;\s"']+)/i.exec(contentType)?.[1] ?? 'utf-8'
          response.bodyText = new TextDecoder(charset, { fatal: true }).decode(bytes)
        } catch {
          response.encoding = 'base64'
        }
      } else response.encoding = 'base64'
    }
  } catch (error) {
    response.error = signal?.aborted
      ? '요청을 취소했습니다.'
      : timeout.signal.aborted
        ? `${draft.timeoutMs / 1000}초 제한 시간을 초과했습니다.`
        : error instanceof Error
          ? error.message + (error.cause instanceof Error ? `: ${error.cause.message}` : '')
          : '요청에 실패했습니다.'
  } finally {
    clearTimeout(timer)
    response.durationMs = Math.round((performance.now() - started) * 100) / 100
  }
  return { id: randomUUID(), startedAt, request: prepared.snapshot, response }
}
