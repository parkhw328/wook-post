import type { Pair, RequestDraft, Workspace } from './contracts'

export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const
export const MAX_BODY_BYTES = 5 * 1024 * 1024
export const MAX_TRANSFER_BYTES = 100 * 1024 * 1024

export function newPair(key = '', value = ''): Pair {
  return { id: crypto.randomUUID(), key, value, enabled: true }
}

export function newRequest(): RequestDraft {
  return {
    id: crypto.randomUUID(),
    collectionId: null,
    name: '새 요청',
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    bodyMode: 'none',
    body: '',
    form: [],
    auth: { type: 'none', token: '', username: '', password: '' },
    timeoutMs: 30_000,
    followRedirects: true,
  }
}

export function emptyWorkspace(): Workspace {
  return { collections: [], requests: [], environments: [], activeEnvironmentId: null }
}
