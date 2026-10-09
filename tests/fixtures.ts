import { newRequest, type Backup, type HistoryEntry } from '../src/shared/contracts'

export function historyEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    request: { ...newRequest(), name: '테스트 요청', url: 'https://example.test/echo' },
    response: {
      status: 200,
      statusText: 'OK',
      headers: [{ key: 'content-type', value: 'application/json' }],
      bodyText: '{"ok":true}',
      bodyBase64: Buffer.from('{"ok":true}').toString('base64'),
      encoding: 'text',
      sizeBytes: 11,
      durationMs: 12.5,
      finalUrl: 'https://example.test/echo',
      error: null,
      truncated: false,
    },
    ...overrides,
  }
}

export function backupFor(history: HistoryEntry[] = []): Backup {
  return {
    format: 'wook-post',
    schemaVersion: 1,
    appVersion: '0.1.0-alpha.1',
    exportedAt: new Date().toISOString(),
    scope: 'history',
    history,
  }
}
