import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { atomicWrite, exportPostman, parseImport } from '../src/main/transfers'
import { emptyWorkspace, newPair, newRequest } from '../src/shared/contracts'
import { backupFor, historyEntry } from './fixtures'

const info = {
  name: '테스트 API',
  schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
}
describe('import and export', () => {
  it('round-trips native requests, headers, timings and response bytes exactly', () => {
    const backup = backupFor([historyEntry()])
    const parsed = parseImport('\uFEFF' + JSON.stringify(backup), '0.1.0-alpha.1')
    expect(parsed.backup).toEqual(backup)
  })
  it('rejects malformed and future-version files before import', () => {
    expect(() => parseImport('{bad', '0.1.0')).toThrow('JSON')
    expect(() =>
      parseImport(JSON.stringify({ ...backupFor(), schemaVersion: 99 }), '0.1.0'),
    ).toThrow('버전')
    expect(() =>
      parseImport(JSON.stringify({ ...backupFor(), scope: 'workspace' }), '0.1.0'),
    ).toThrow()
    expect(() =>
      parseImport(JSON.stringify({ ...backupFor(), scope: 'response' }), '0.1.0'),
    ).toThrow()
    expect(() => parseImport(JSON.stringify({ unrelated: true }), '0.1.0')).toThrow('Postman')
  })
  it('rejects corrupted binary payloads and inconsistent response sizes', () => {
    for (const patch of [{ bodyBase64: '**broken**' }, { sizeBytes: 12 }]) {
      const entry = historyEntry()
      Object.assign(entry.response, patch)
      expect(() => parseImport(JSON.stringify(backupFor([entry])), '0.1.0')).toThrow(
        '바이트 또는 크기',
      )
    }
  })
  it('converts folders, inherited auth, variables and disabled query fields without duplicating URL queries', () => {
    const data = {
      info,
      variable: [{ key: 'baseUrl', value: 'https://example.test' }],
      auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}' }] },
      event: [{ listen: 'test' }],
      item: [
        {
          name: 'Users',
          item: [
            {
              name: 'List',
              request: {
                method: 'GET',
                url: {
                  raw: '{{baseUrl}}/users?a=1',
                  query: [
                    { key: 'a', value: '1' },
                    { key: 'a', value: '2' },
                    { key: 'secret', value: 'off', disabled: true },
                  ],
                },
              },
            },
          ],
        },
      ],
    }
    const parsed = parseImport(JSON.stringify(data), '0.1.0')
    const request = parsed.backup.workspace!.requests[0]
    expect(request.name).toBe('Users / List')
    expect(request.url).toBe('{{baseUrl}}/users')
    expect(request.params.map((pair) => [pair.key, pair.value, pair.enabled])).toEqual([
      ['a', '1', true],
      ['a', '2', true],
      ['secret', 'off', false],
    ])
    expect(request.auth).toMatchObject({ type: 'bearer', token: '{{token}}' })
    expect(parsed.backup.workspace!.environments[0].values[0].key).toBe('baseUrl')
    expect(parsed.warnings.some((warning) => warning.includes('스크립트'))).toBe(true)
  })
  it('rejects unsupported auth or bodies instead of silently changing request semantics', () => {
    for (const extra of [{ body: { mode: 'formdata' } }, { auth: { type: 'oauth2' } }]) {
      expect(() =>
        parseImport(
          JSON.stringify({
            info,
            item: [
              {
                name: 'unsupported',
                request: { method: 'POST', url: 'https://example.test', ...extra },
              },
            ],
          }),
          '0.1.0',
        ),
      ).toThrow('지원하지 않습니다')
    }
  })
  it('preserves structured URL ports and rejects unhandled Postman path variables', () => {
    const collection = {
      info,
      item: [
        {
          name: 'Local',
          request: {
            method: 'GET',
            url: { protocol: 'http', host: ['127', '0', '0', '1'], port: '4545', path: ['echo'] },
          },
        },
      ],
    }
    expect(parseImport(JSON.stringify(collection), '0.1.0').backup.workspace!.requests[0].url).toBe(
      'http://127.0.0.1:4545/echo',
    )
    const invalid = {
      info,
      item: [
        {
          name: 'Local',
          request: {
            method: 'GET',
            url: { raw: 'http://localhost/:id', variable: [{ key: 'id', value: '123' }] },
          },
        },
      ],
    }
    expect(() => parseImport(JSON.stringify(invalid), '0.1.0')).toThrow('경로 변수')
  })
  it('round-trips supported Postman request data including duplicate keys and form fields', () => {
    const workspace = emptyWorkspace()
    workspace.requests.push({
      ...newRequest(),
      name: 'Form',
      method: 'POST',
      url: 'https://example.test?a=1',
      params: [newPair('a', '2')],
      bodyMode: 'form',
      form: [newPair('field', 'a & b')],
      headers: [newPair('X-Test', 'ok')],
    })
    const imported = parseImport(JSON.stringify(exportPostman(workspace)), '0.1.0').backup
      .workspace!.requests[0]
    expect(imported.params.map((item) => [item.key, item.value])).toEqual([
      ['a', '1'],
      ['a', '2'],
    ])
    expect(imported.form[0]).toMatchObject({ key: 'field', value: 'a & b' })
    expect(imported.headers[0]).toMatchObject({ key: 'X-Test', value: 'ok' })
  })
  it('atomically replaces an existing export and preserves arbitrary bytes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'wook-export-'))
    try {
      const path = join(directory, 'response.bin')
      await atomicWrite(path, 'old')
      const bytes = Buffer.from([0, 255, 128, 12, 13])
      await atomicWrite(path, bytes)
      expect(await readFile(path)).toEqual(bytes)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
