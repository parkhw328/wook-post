import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import {
  emptyWorkspace,
  historySchema,
  MAX_TRANSFER_BYTES,
  workspaceSchema,
  type AppState,
  type Backup,
  type HistoryEntry,
  type HistorySummary,
  type Workspace,
} from '../shared/contracts'

export class Store {
  private db: DatabaseSync

  constructor(path: string) {
    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
    const version = this.db.prepare('PRAGMA user_version').get() as { user_version: number }
    if (version.user_version > 1) {
      this.db.close()
      throw new Error('더 최신 Wook Post에서 만든 데이터입니다. 앱을 업데이트하세요.')
    }
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY, startedAt TEXT NOT NULL, name TEXT NOT NULL, method TEXT NOT NULL,
        url TEXT NOT NULL, status INTEGER, durationMs REAL NOT NULL, error TEXT, data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS history_date ON history(startedAt DESC, id DESC);
      PRAGMA user_version = 1;
    `)
  }

  getWorkspace(): Workspace {
    const row = this.db.prepare('SELECT data FROM workspace WHERE id = 1').get() as
      { data: string } | undefined
    return row ? workspaceSchema.parse(JSON.parse(row.data)) : emptyWorkspace()
  }

  saveWorkspace(input: Workspace) {
    const workspace = workspaceSchema.parse(input)
    const data = JSON.stringify(workspace)
    if (Buffer.byteLength(data) > 20 * 1024 * 1024)
      throw new Error('워크스페이스는 20 MiB까지 지원합니다.')
    this.db
      .prepare(
        'INSERT INTO workspace VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data',
      )
      .run(data)
  }

  addHistory(input: HistoryEntry) {
    const entry = historySchema.parse(input)
    this.db
      .prepare(`INSERT INTO history VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        entry.id,
        entry.startedAt,
        entry.request.name,
        entry.request.method,
        entry.request.url,
        entry.response.status,
        entry.response.durationMs,
        entry.response.error,
        JSON.stringify(entry),
      )
  }

  listHistory(offset = 0): HistorySummary[] {
    return this.db
      .prepare(
        `SELECT id, startedAt, name, method, url, status, durationMs, error
      FROM history ORDER BY startedAt DESC, id DESC LIMIT 100 OFFSET ?`,
      )
      .all(offset) as HistorySummary[]
  }

  getHistory(id: string): HistoryEntry | null {
    const row = this.db.prepare('SELECT data FROM history WHERE id = ?').get(id) as
      { data: string } | undefined
    return row ? historySchema.parse(JSON.parse(row.data)) : null
  }

  allHistory(): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    let size = 0
    for (const row of this.db
      .prepare('SELECT data FROM history ORDER BY startedAt DESC, id DESC')
      .iterate()) {
      const data = row.data as string
      size += Buffer.byteLength(data)
      if (size > MAX_TRANSFER_BYTES || entries.length >= 50_000)
        throw new Error(
          '백업 한도(100 MiB / 50,000건)를 초과했습니다. 개별 응답을 내보내세요. 기존 기록은 유지됩니다.',
        )
      entries.push(JSON.parse(data) as HistoryEntry)
    }
    return entries
  }

  state(): AppState {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM history').get() as { count: number }
    return { workspace: this.getWorkspace(), history: this.listHistory(), historyTotal: row.count }
  }

  clearHistory() {
    this.db.exec('DELETE FROM history')
  }

  importBackup(backup: Backup) {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const workspace = this.getWorkspace()
      const mapping = new Map<string, string>()
      if (backup.workspace) {
        for (const collection of backup.workspace.collections) {
          const id = randomUUID()
          mapping.set(collection.id, id)
          workspace.collections.push({ ...collection, id })
        }
        for (const request of backup.workspace.requests)
          workspace.requests.push({
            ...request,
            id: randomUUID(),
            collectionId: request.collectionId ? mapping.get(request.collectionId)! : null,
          })
        for (const environment of backup.workspace.environments) {
          const id = randomUUID()
          workspace.environments.push({ ...environment, id })
          if (
            !workspace.activeEnvironmentId &&
            environment.id === backup.workspace.activeEnvironmentId
          )
            workspace.activeEnvironmentId = id
        }
        this.saveWorkspace(workspace)
      }
      for (const entry of backup.history) {
        const existing = this.getHistory(entry.id)
        if (existing && JSON.stringify(existing) === JSON.stringify(entry)) continue
        this.addHistory(existing ? { ...entry, id: randomUUID() } : entry)
      }
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }

  close() {
    this.db.close()
  }
}
