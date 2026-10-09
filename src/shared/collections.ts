import { collectionSchema, type Workspace } from './contracts'

export function renameCollection(workspace: Workspace, id: string, name: string): Workspace {
  const updated = collectionSchema.parse({ id, name: name.trim() })
  if (!workspace.collections.some((collection) => collection.id === id))
    throw new Error('컬렉션을 찾을 수 없습니다.')
  return {
    ...workspace,
    collections: workspace.collections.map((collection) =>
      collection.id === id ? updated : collection,
    ),
  }
}

export function deleteCollection(
  workspace: Workspace,
  id: string,
  deleteRequests = false,
): Workspace {
  if (!workspace.collections.some((collection) => collection.id === id))
    throw new Error('컬렉션을 찾을 수 없습니다.')
  return {
    ...workspace,
    collections: workspace.collections.filter((collection) => collection.id !== id),
    requests: deleteRequests
      ? workspace.requests.filter((request) => request.collectionId !== id)
      : workspace.requests.map((request) =>
          request.collectionId === id ? { ...request, collectionId: null } : request,
        ),
  }
}
