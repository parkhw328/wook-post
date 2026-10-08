import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { executeRequest, prepareRequest } from '../src/main/http'
import { MAX_BODY_BYTES, newPair, newRequest, type Environment } from '../src/shared/contracts'

let server: Server
let otherServer: Server
let baseUrl: string
let otherUrl: string
beforeAll(async () => {
  otherServer = createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(
      JSON.stringify({
        authorization: request.headers.authorization ?? null,
        cookie: request.headers.cookie ?? null,
      }),
    )
  })
  await new Promise<void>((resolve) => otherServer.listen(0, '127.0.0.1', resolve))
  otherUrl = `http://127.0.0.1:${(otherServer.address() as AddressInfo).port}`
  server = createServer(async (request, response) => {
    const url = new URL(request.url!, 'http://localhost')
    if (url.pathname === '/slow') {
      const timer = setTimeout(() => response.end('late'), 1000)
      response.on('close', () => clearTimeout(timer))
      return
    }
    if (url.pathname === '/large') {
      response.end(Buffer.alloc(MAX_BODY_BYTES + 100, 65))
      return
    }
    if (url.pathname === '/binary') {
      response.setHeader('Content-Type', 'application/octet-stream')
      response.end(Buffer.from([0, 255, 128, 13, 10]))
      return
    }
    if (url.pathname === '/redirect') {
      response.writeHead(302, { Location: otherUrl })
      response.end()
      return
    }
    if (url.pathname === '/error') {
      response.writeHead(404, { 'Content-Type': 'application/json' })
      response.end('{"error":"missing"}')
      return
    }
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(chunk as Buffer)
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': ['one=1; Path=/', 'two=2; Path=/'],
    })
    response.end(
      JSON.stringify({
        method: request.method,
        query: [...url.searchParams],
        headers: request.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }),
    )
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(async () => {
  await Promise.all(
    [server, otherServer].map(
      (instance) =>
        new Promise<void>((resolve) => {
          instance.closeAllConnections()
          instance.close(() => resolve())
        }),
    ),
  )
})

describe('HTTP transport', () => {
  it('sends JSON, duplicated query keys, headers and environment authentication; freezes replay values', async () => {
    const environment: Environment = {
      id: crypto.randomUUID(),
      name: 'local',
      values: [
        newPair('baseUrl', baseUrl),
        newPair('token', 'test-token'),
        newPair('name', '한글'),
      ],
    }
    const draft = {
      ...newRequest(),
      method: 'POST' as const,
      url: '{{baseUrl}}/echo?a=1',
      params: [
        newPair('a', '2'),
        newPair('name', '{{name}}'),
        { ...newPair('disabled', 'ignore'), enabled: false },
      ],
      headers: [newPair('X-Test', '{{name}}')],
      bodyMode: 'json' as const,
      body: '{"name":"{{name}}"}',
      auth: { type: 'bearer' as const, token: '{{token}}', username: '', password: '' },
    }
    // HTTP field values are byte strings. Use an ASCII value for the custom header.
    draft.headers[0].value = 'fixture'
    const entry = await executeRequest(draft, environment)
    const result = JSON.parse(entry.response.bodyText)
    expect(entry.response.status).toBe(200)
    expect(result.query).toEqual([
      ['a', '1'],
      ['a', '2'],
      ['name', '한글'],
    ])
    expect(result.headers.authorization).toBe('Bearer test-token')
    expect(result.headers['x-test']).toBe('fixture')
    expect(JSON.parse(result.body)).toEqual({ name: '한글' })
    expect(entry.request.url).not.toContain('{{')
    expect(entry.request.params).toEqual([])
    expect(entry.request.auth.token).toBe('test-token')
    expect(entry.response.headers.filter((item) => item.key === 'set-cookie')).toHaveLength(2)
    expect(entry.response.sizeBytes).toBe(Buffer.byteLength(entry.response.bodyText))
    expect(entry.response.durationMs).toBeGreaterThan(0)
    const replay = await executeRequest(entry.request)
    expect(JSON.parse(replay.response.bodyText).query).toEqual(result.query)
  })
  it('encodes form fields and basic auth', async () => {
    const draft = {
      ...newRequest(),
      url: baseUrl,
      method: 'POST' as const,
      bodyMode: 'form' as const,
      form: [newPair('x', 'a & b'), newPair('x', '한글')],
      auth: { type: 'basic' as const, token: '', username: 'name', password: 'pass:word' },
    }
    const result = JSON.parse((await executeRequest(draft)).response.bodyText)
    expect(result.body).toBe('x=a+%26+b&x=%ED%95%9C%EA%B8%80')
    expect(result.headers.authorization).toBe(
      `Basic ${Buffer.from('name:pass:word').toString('base64')}`,
    )
  })
  it('preserves error status bodies as completed HTTP responses', async () => {
    const entry = await executeRequest({ ...newRequest(), url: baseUrl + '/error' })
    expect(entry.response.status).toBe(404)
    expect(entry.response.error).toBeNull()
    expect(entry.response.bodyText).toContain('missing')
  })
  it('stores binary response bytes losslessly', async () => {
    const entry = await executeRequest({ ...newRequest(), url: baseUrl + '/binary' })
    expect(entry.response.encoding).toBe('base64')
    expect(Buffer.from(entry.response.bodyBase64, 'base64')).toEqual(
      Buffer.from([0, 255, 128, 13, 10]),
    )
  })
  it('caps streamed bodies and explicitly marks partial responses', async () => {
    const entry = await executeRequest({ ...newRequest(), url: baseUrl + '/large' })
    expect(entry.response.truncated).toBe(true)
    expect(entry.response.sizeBytes).toBe(MAX_BODY_BYTES)
    expect(Buffer.from(entry.response.bodyBase64, 'base64')).toHaveLength(MAX_BODY_BYTES)
  })
  it('times out and supports user cancellation', async () => {
    const entry = await executeRequest({ ...newRequest(), url: baseUrl + '/slow', timeoutMs: 100 })
    expect(entry.response.error).toContain('제한 시간')
    const controller = new AbortController()
    const promise = executeRequest(
      { ...newRequest(), url: baseUrl + '/slow' },
      undefined,
      controller.signal,
    )
    controller.abort()
    expect((await promise).response.error).toBe('요청을 취소했습니다.')
  })
  it('strips credentials on cross-origin redirects and supports disabling redirects', async () => {
    const draft = {
      ...newRequest(),
      url: baseUrl + '/redirect',
      headers: [newPair('Authorization', 'secret'), newPair('Cookie', 'session=secret')],
    }
    const result = JSON.parse((await executeRequest(draft)).response.bodyText)
    expect(result).toEqual({ authorization: null, cookie: null })
    expect((await executeRequest({ ...draft, followRedirects: false })).response.status).toBe(302)
  })
  it('supports HEAD with an empty body', async () => {
    const entry = await executeRequest({ ...newRequest(), url: baseUrl, method: 'HEAD' })
    expect(entry.response.status).toBe(200)
    expect(entry.response.sizeBytes).toBe(0)
  })
  it('rejects invalid protocols, credentials, unresolved variables, invalid JSON and GET bodies', () => {
    for (const url of [
      'file:///etc/passwd',
      'https://user:pass@example.test',
      '{{missing}}/echo',
    ]) {
      expect(() => prepareRequest({ ...newRequest(), url })).toThrow()
    }
    expect(() =>
      prepareRequest({ ...newRequest(), url: baseUrl, bodyMode: 'json', body: '{}' }),
    ).toThrow('GET / HEAD')
    expect(() =>
      prepareRequest({
        ...newRequest(),
        method: 'POST',
        url: baseUrl,
        bodyMode: 'json',
        body: '{broken}',
      }),
    ).toThrow('JSON')
  })
})
