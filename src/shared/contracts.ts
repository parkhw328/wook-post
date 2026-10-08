import { z } from 'zod'
import { METHODS, MAX_BODY_BYTES } from './models'
export {
  METHODS,
  MAX_BODY_BYTES,
  MAX_TRANSFER_BYTES,
  newPair,
  newRequest,
  emptyWorkspace,
} from './models'

export const pairSchema = z.object({
  id: z.string().min(1).max(100),
  key: z.string().max(16_384),
  value: z.string().max(1_048_576),
  enabled: z.boolean(),
})
export type Pair = z.infer<typeof pairSchema>
export const authSchema = z.object({
  type: z.enum(['none', 'bearer', 'basic']),
  token: z.string().max(16_384),
  username: z.string().max(16_384),
  password: z.string().max(16_384),
})
export const requestSchema = z.object({
  id: z.string().uuid(),
  collectionId: z.string().uuid().nullable(),
  name: z.string().min(1).max(200),
  method: z.enum(METHODS),
  url: z.string().max(16_384),
  params: z.array(pairSchema).max(200),
  headers: z.array(pairSchema).max(200),
  bodyMode: z.enum(['none', 'json', 'text', 'form']),
  body: z.string().max(1_048_576),
  form: z.array(pairSchema).max(200),
  auth: authSchema,
  timeoutMs: z.number().int().min(100).max(120_000),
  followRedirects: z.boolean(),
})
export type RequestDraft = z.infer<typeof requestSchema>
export const collectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
})
export const environmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  values: z.array(pairSchema).max(200),
})
export type Environment = z.infer<typeof environmentSchema>
export const workspaceSchema = z
  .object({
    collections: z.array(collectionSchema).max(1_000),
    requests: z.array(requestSchema).max(10_000),
    environments: z.array(environmentSchema).max(100),
    activeEnvironmentId: z.string().uuid().nullable(),
  })
  .superRefine((workspace, ctx) => {
    for (const group of [workspace.collections, workspace.requests, workspace.environments]) {
      if (new Set(group.map((item) => item.id)).size !== group.length)
        ctx.addIssue({ code: 'custom', message: '중복된 ID가 있습니다.' })
    }
    const collectionIds = new Set(workspace.collections.map((item) => item.id))
    if (
      workspace.requests.some((item) => item.collectionId && !collectionIds.has(item.collectionId))
    )
      ctx.addIssue({ code: 'custom', message: '요청이 존재하지 않는 컬렉션을 참조합니다.' })
    if (
      workspace.activeEnvironmentId &&
      !workspace.environments.some((item) => item.id === workspace.activeEnvironmentId)
    )
      ctx.addIssue({ code: 'custom', message: '선택한 환경이 존재하지 않습니다.' })
  })
export type Workspace = z.infer<typeof workspaceSchema>
export const responseSchema = z.object({
  status: z.number().int().min(100).max(599).nullable(),
  statusText: z.string(),
  headers: z.array(z.object({ key: z.string(), value: z.string() })),
  bodyText: z.string().max(MAX_BODY_BYTES),
  bodyBase64: z.string().max(Math.ceil(MAX_BODY_BYTES / 3) * 4),
  encoding: z.enum(['text', 'base64']),
  sizeBytes: z.number().int().nonnegative().max(MAX_BODY_BYTES),
  durationMs: z.number().nonnegative(),
  finalUrl: z.string(),
  error: z.string().nullable(),
  truncated: z.boolean(),
})
export type ResponseResult = z.infer<typeof responseSchema>
export const historySchema = z.object({
  id: z.string().uuid(),
  startedAt: z.string().datetime(),
  request: requestSchema,
  response: responseSchema,
})
export type HistoryEntry = z.infer<typeof historySchema>
export type HistorySummary = {
  id: string
  startedAt: string
  name: string
  method: RequestDraft['method']
  url: string
  status: number | null
  durationMs: number
  error: string | null
}
export const backupSchema = z
  .object({
    format: z.literal('wook-post'),
    schemaVersion: z.literal(1),
    appVersion: z.string(),
    exportedAt: z.string().datetime(),
    scope: z.enum(['workspace', 'history', 'response']),
    workspace: workspaceSchema.optional(),
    history: z.array(historySchema).max(50_000),
  })
  .superRefine((data, ctx) => {
    if (data.scope === 'workspace' && !data.workspace)
      ctx.addIssue({ code: 'custom', message: '워크스페이스 데이터가 없습니다.' })
    if (data.scope !== 'workspace' && data.workspace)
      ctx.addIssue({ code: 'custom', message: '파일 종류와 데이터 범위가 일치하지 않습니다.' })
    if (data.scope === 'response' && data.history.length !== 1)
      ctx.addIssue({ code: 'custom', message: '응답 파일에는 결과 한 건이 필요합니다.' })
    if (new Set(data.history.map((item) => item.id)).size !== data.history.length)
      ctx.addIssue({ code: 'custom', message: '중복된 히스토리 ID가 있습니다.' })
  })
export type Backup = z.infer<typeof backupSchema>
export type ImportPreview = {
  token: string
  fileName: string
  format: string
  requests: number
  history: number
  environments: number
  warnings: string[]
}
export type AppState = { workspace: Workspace; history: HistorySummary[]; historyTotal: number }
export type ExportOptions = {
  scope: 'workspace' | 'history' | 'response' | 'body' | 'postman'
  historyId?: string
}
export type DesktopApi = {
  load: () => Promise<AppState>
  saveWorkspace: (workspace: Workspace) => Promise<AppState>
  send: (request: RequestDraft, operationId: string) => Promise<HistoryEntry>
  cancel: (operationId: string) => Promise<void>
  getHistory: (id: string) => Promise<HistoryEntry | null>
  copyResponse: (id: string) => Promise<void>
  listHistory: (offset: number) => Promise<HistorySummary[]>
  clearHistory: () => Promise<AppState>
  previewImport: () => Promise<ImportPreview | null>
  applyImport: (token: string) => Promise<AppState>
  exportData: (options: ExportOptions) => Promise<string | null>
  info: () => Promise<{ version: string; dataPath: string }>
}
