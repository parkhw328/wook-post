import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Store } from '../src/main/store'
import { backupSchema, emptyWorkspace, newPair, newRequest } from '../src/shared/contracts'
import { backupFor, historyEntry } from './fixtures'

let directory: string
let store: Store
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'wook-post-store-'))
  store = new Store(join(directory, 'test.sqlite'))
})
afterEach(() => {
  store.close()
  rmSync(directory, { recursive: true, force: true })
})

describe('local persistence', () => {
  it('retains collections, environments and response bytes across restarts', () => {
    const workspace = emptyWorkspace()
    const id = crypto.randomUUID()
    workspace.collections.push({ id, name: '내 API' })
    workspace.requests.push({ ...newRequest(), collectionId: id, url: 'https://example.test' })
    const envId = crypto.randomUUID()
    workspace.environments.push({
      id: envId,
      name: 'local',
      values: [newPair('baseUrl', 'http://localhost')],
    })
    workspace.activeEnvironmentId = envId
    const entry = historyEntry()
    store.saveWorkspace(workspace)
    store.addHistory(entry)
    store.close()
    store = new Store(join(directory, 'test.sqlite'))
    expect(store.getWorkspace()).toEqual(workspace)
    expect(store.getHistory(entry.id)).toEqual(entry)
  })
  it('paginates history summaries without loading response bodies', () => {
    for (let index = 0; index < 105; index++)
      store.addHistory(historyEntry({ startedAt: new Date(1000 * index).toISOString() }))
    const state = store.state()
    expect(state.historyTotal).toBe(105)
    expect(state.history).toHaveLength(100)
    expect(state.history[0]).not.toHaveProperty('response')
    expect(state.history[0].startedAt).toBe(new Date(104_000).toISOString())
    const next = store.listHistory(100)
    expect(next).toHaveLength(5)
    expect(new Set([...state.history, ...next].map((item) => item.id)).size).toBe(105)
  })
  it('merges imports without overwriting existing requests and deduplicates identical history', () => {
    const workspace = emptyWorkspace()
    const collectionId = crypto.randomUUID()
    workspace.collections.push({ id: collectionId, name: '원본' })
    workspace.requests.push({ ...newRequest(), collectionId })
    store.saveWorkspace(workspace)
    const entry = historyEntry()
    store.addHistory(entry)
    store.importBackup(backupSchema.parse({ ...backupFor([entry]), scope: 'workspace', workspace }))
    const result = store.state()
    expect(result.workspace.requests).toHaveLength(2)
    expect(result.workspace.requests[0]).toEqual(workspace.requests[0])
    expect(result.workspace.requests[1].collectionId).toBe(result.workspace.collections[1].id)
    expect(result.workspace.requests[1].id).not.toBe(workspace.requests[0].id)
    expect(result.historyTotal).toBe(1)
  })
  it('preserves conflicting history by assigning a fresh ID', () => {
    const entry = historyEntry()
    store.addHistory(entry)
    store.importBackup(backupFor([{ ...entry, request: { ...entry.request, name: 'different' } }]))
    expect(store.state().historyTotal).toBe(2)
    expect(store.getHistory(entry.id)).toEqual(entry)
  })
  it('restores the selected environment when importing into a workspace with no active environment', () => {
    const id = crypto.randomUUID()
    const workspace = {
      ...emptyWorkspace(),
      environments: [{ id, name: 'local', values: [newPair('baseUrl', 'http://localhost')] }],
      activeEnvironmentId: id,
    }
    store.importBackup({ ...backupFor(), scope: 'workspace', workspace })
    const imported = store.getWorkspace()
    expect(imported.activeEnvironmentId).toBe(imported.environments[0].id)
    expect(imported.activeEnvironmentId).not.toBe(id)
  })
  it('rolls back all changes if any imported history fails validation', () => {
    const workspace = emptyWorkspace()
    workspace.requests.push(newRequest())
    const invalid = historyEntry()
    invalid.request.url = 'x'.repeat(16_385)
    expect(() =>
      store.importBackup({
        ...backupFor([historyEntry(), invalid]),
        scope: 'workspace',
        workspace,
      }),
    ).toThrow()
    expect(store.state()).toEqual({ workspace: emptyWorkspace(), history: [], historyTotal: 0 })
  })
  it('clears history without deleting saved requests', () => {
    const workspace = { ...emptyWorkspace(), requests: [newRequest()] }
    store.saveWorkspace(workspace)
    store.addHistory(historyEntry())
    store.clearHistory()
    expect(store.state().historyTotal).toBe(0)
    expect(store.getWorkspace()).toEqual(workspace)
  })
})
