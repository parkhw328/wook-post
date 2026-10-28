import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { atomicWrite, exportPostman, parseImport } from '../src/main/transfers'
import { emptyWorkspace, newMultipartField, newPair, newRequest } from '../src/shared/contracts'
import { backupFor, historyEntry } from './fixtures'

const info = {
  name: '테스트 API',
  schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
}
describe('import and export', () => {
  it('round-trips multipart and binary paths through native and Postman backups', () => {
    const file = { path: 'C:\\한글 폴더\\photo.png', name: 'photo.png', size: 12 }
    const multipart = {
      ...newRequest(),
      method: 'POST' as const,
      url: 'https://example.test',
      bodyMode: 'multipart' as const,
      multipart: [
        { ...newMultipartField(), key: 'tag', value: '한글' },
        { ...newMultipartField(), key: 'tag', value: 'second', enabled: false },
        { ...newMultipartField('file'), key: 'files', files: [file, file] },
      ],
    }
    const binary = {
      ...newRequest(),
      url: 'https://example.test',
      method: 'PUT' as const,
      bodyMode: 'binary' as const,
      binaryFile: file,
    }
    const workspace = { ...emptyWorkspace(), requests: [multipart, binary] }
    const native = { ...backupFor(), scope: 'workspace', workspace }
    const parsed = parseImport(JSON.stringify(native), '1.1.0')
    expect(parsed.backup).toEqual(native)
    expect(parsed.warnings.join(' ')).toContain('경로')
    const postman = parseImport(JSON.stringify(exportPostman(workspace)), '1.1.0')
    const requests = postman.backup.workspace!.requests
    expect(requests[0].multipart.map(({ id: _id, ...field }) => field)).toEqual(
      multipart.multipart.map(({ id: _id, ...field }) => ({
        ...field,
        files: field.files.map((file) => ({ ...file, size: null })),
      })),
    )
    expect(requests[1].bodyMode).toBe('binary')
    expect(requests[1].binaryFile).toEqual({ ...file, size: null })
    expect(postman.warnings.join(' ')).toContain('경로')
  })
  it('imports Postman single-file paths, empty file selections and disabled bodies explicitly', () => {
    const data = {
      info,
      item: [
        {
          name: 'single',
          request: {
            method: 'POST',
            url: 'https://example.test',
            body: {
              mode: 'formdata',
              formdata: [
                { key: 'upload', type: 'file', src: 'relative.txt', disabled: true },
                { key: 'empty', type: 'file', src: null },
              ],
            },
          },
        },
        {
          name: 'empty binary',
          request: {
            method: 'PUT',
            url: 'https://example.test',
            body: { mode: 'file', file: { src: null } },
          },
        },
        {
          name: 'disabled',
          request: {
            method: 'GET',
            url: 'https://example.test',
            body: { mode: 'file', file: { src: 'test.bin' }, disabled: true },
          },
        },
      ],
    }
    const requests = parseImport(JSON.stringify(data), '1.1.0').backup.workspace!.requests
    expect(requests[0].multipart[0]).toMatchObject({
      enabled: false,
      files: [{ path: 'relative.txt', name: 'relative.txt', size: null }],
    })
    expect(requests[0].multipart[1].files).toEqual([])
    expect(requests[1]).toMatchObject({ bodyMode: 'binary', binaryFile: null })
    expect(requests[2].bodyMode).toBe('none')
  })
  it('loads pre-upload native backups without losing existing request data', () => {
    const { multipart: _multipart, binaryFile: _binaryFile, ...legacy } = newRequest()
    legacy.bodyMode = 'form'
    legacy.form = [newPair('old', '한글')]
    const entry = historyEntry()
    const native = {
      ...backupFor(),
      scope: 'workspace',
      workspace: { ...emptyWorkspace(), requests: [legacy] },
      history: [{ ...entry, request: legacy }],
    }
    const parsed = parseImport(JSON.stringify(native), '1.1.0')
    expect(parsed.backup.workspace!.requests[0]).toEqual({
      ...legacy,
      multipart: [],
      binaryFile: null,
    })
    expect(parsed.backup.history[0].request).toEqual({ ...legacy, multipart: [], binaryFile: null })
    expect(parsed.warnings).toEqual([])
  })
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
    for (const extra of [{ body: { mode: 'graphql' } }, { auth: { type: 'oauth2' } }]) {
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
