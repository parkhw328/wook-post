import { describe, expect, it } from 'vitest'
import { deleteCollection, renameCollection } from '../src/shared/collections'
import { emptyWorkspace, newRequest, workspaceSchema } from '../src/shared/contracts'

function fixture() {
  const first = { id: crypto.randomUUID(), name: '첫 컬렉션' }
  const other = { id: crypto.randomUUID(), name: '다른 컬렉션' }
  return {
    ...emptyWorkspace(),
    collections: [first, other],
    requests: [
      { ...newRequest(), collectionId: first.id },
      { ...newRequest(), collectionId: other.id },
      newRequest(),
    ],
  }
}

describe('collection management', () => {
  it('renames without changing IDs, requests or the original workspace', () => {
    const original = fixture()
    const snapshot = structuredClone(original)
    const result = renameCollection(original, original.collections[0].id, '  새 이름  ')
    expect(result.collections[0]).toEqual({ ...original.collections[0], name: '새 이름' })
    expect(result.requests).toEqual(original.requests)
    expect(original).toEqual(snapshot)
    expect(workspaceSchema.safeParse(result).success).toBe(true)
  })
  it('keeps child requests unfiled by default and leaves other data intact', () => {
    const original = fixture()
    const snapshot = structuredClone(original)
    const result = deleteCollection(original, original.collections[0].id)
    expect(result.collections).toEqual([original.collections[1]])
    expect(result.requests).toEqual([
      { ...original.requests[0], collectionId: null },
      ...original.requests.slice(1),
    ])
    expect(original).toEqual(snapshot)
    expect(workspaceSchema.safeParse(result).success).toBe(true)
  })
  it('deletes only the selected collection and its requests when explicitly selected', () => {
    const original = fixture()
    const result = deleteCollection(original, original.collections[0].id, true)
    expect(result.collections).toEqual([original.collections[1]])
    expect(result.requests).toEqual(original.requests.slice(1))
    expect(result.environments).toEqual(original.environments)
    expect(workspaceSchema.safeParse(result).success).toBe(true)
  })
  it('rejects unknown collections and empty or oversized names', () => {
    const original = fixture()
    expect(() => renameCollection(original, crypto.randomUUID(), '이름')).toThrow()
    expect(() => renameCollection(original, original.collections[0].id, '  ')).toThrow()
    expect(() => renameCollection(original, original.collections[0].id, 'a'.repeat(201))).toThrow()
    expect(() => deleteCollection(original, crypto.randomUUID())).toThrow()
  })
})
