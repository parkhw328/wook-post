import { randomUUID } from 'node:crypto'
import { readFile, stat, writeFile, rename, rm } from 'node:fs/promises'
import { z } from 'zod'
import {
  backupSchema,
  emptyWorkspace,
  MAX_TRANSFER_BYTES,
  METHODS,
  newPair,
  newRequest,
  type Backup,
  type RequestDraft,
  type Workspace,
} from '../shared/contracts'

const postmanPair = z.object({
  key: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  disabled: z.boolean().optional(),
})
const postmanAuth = z
  .object({
    type: z.string(),
    bearer: z.array(postmanPair).optional(),
    basic: z.array(postmanPair).optional(),
  })
  .nullable()
  .optional()
const postmanRequest = z.object({
  method: z.string(),
  url: z.union([
    z.string(),
    z.object({
      raw: z.string().optional(),
      protocol: z.string().optional(),
      port: z.string().optional(),
      host: z.union([z.string(), z.array(z.string())]).optional(),
      path: z.union([z.string(), z.array(z.string())]).optional(),
      query: z.array(postmanPair).optional(),
      variable: z.array(postmanPair).optional(),
    }),
  ]),
  header: z.union([z.array(postmanPair), z.string()]).optional(),
  body: z
    .object({
      mode: z.string().optional(),
      raw: z.string().optional(),
      urlencoded: z.array(postmanPair).optional(),
      options: z
        .object({ raw: z.object({ language: z.string().optional() }).optional() })
        .optional(),
    })
    .optional(),
  auth: postmanAuth,
})
type PostmanAuth = z.infer<typeof postmanAuth>
type PostmanItem = {
  name: string
  item?: PostmanItem[]
  request?: unknown
  auth?: PostmanAuth
  event?: unknown
  variable?: unknown
}
const postmanItem: z.ZodType<PostmanItem> = z.lazy(() =>
  z.object({
    name: z.string(),
    item: z.array(postmanItem).optional(),
    request: z.unknown().optional(),
    auth: postmanAuth,
    event: z.unknown().optional(),
    variable: z.unknown().optional(),
  }),
)
const postmanCollection = z.object({
  info: z.object({ name: z.string(), schema: z.string().regex(/\/collection\/v2\.[01]\.0\//) }),
  item: z.array(postmanItem),
  variable: z.array(postmanPair).optional(),
  auth: postmanAuth,
  event: z.unknown().optional(),
})

export function parseImport(
  text: string,
  appVersion: string,
): { backup: Backup; format: string; warnings: string[] } {
  if (Buffer.byteLength(text) > MAX_TRANSFER_BYTES)
    throw new Error('가져오기 파일은 100 MiB까지 지원합니다.')
  let data: unknown
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    throw new Error('올바른 JSON 파일이 아닙니다.')
  }
  if (typeof data === 'object' && data && 'format' in data && data.format === 'wook-post') {
    const result = backupSchema.safeParse(data)
    if (!result.success)
      throw new Error(
        'wPost 백업 형식 또는 버전이 올바르지 않습니다. 기존 데이터는 변경되지 않았습니다.',
      )
    for (const entry of result.data.history) {
      const bytes = Buffer.from(entry.response.bodyBase64, 'base64')
      if (
        bytes.toString('base64') !== entry.response.bodyBase64 ||
        bytes.length !== entry.response.sizeBytes
      )
        throw new Error('백업 응답 본문의 바이트 또는 크기가 일치하지 않습니다. 파일을 확인하세요.')
    }
    return { backup: result.data, format: 'wPost v1', warnings: [] }
  }
  const parsed = postmanCollection.safeParse(data)
  if (!parsed.success)
    throw new Error('wPost 백업 또는 Postman Collection v2.0 / v2.1 JSON 파일을 선택하세요.')
  const source = parsed.data
  const workspace = emptyWorkspace()
  const warnings = new Set<string>()
  const collectionId = randomUUID()
  workspace.collections.push({ id: collectionId, name: source.info.name })
  const pairs = (values: z.infer<typeof postmanPair>[] = []) =>
    values.map((item) => ({
      ...newPair(item.key, String(item.value ?? '')),
      enabled: !item.disabled,
    }))
  if (source.variable?.length) {
    const id = randomUUID()
    workspace.environments.push({ id, name: source.info.name, values: pairs(source.variable) })
    workspace.activeEnvironmentId = id
  }
  if (source.event) warnings.add('Pre-request / test 스크립트는 가져오거나 실행하지 않습니다.')
  function walk(items: PostmanItem[], prefix: string, inherited: PostmanAuth, depth = 0) {
    if (depth > 30) throw new Error('컬렉션 폴더 깊이는 30단계까지 지원합니다.')
    for (const item of items) {
      if (item.event) warnings.add('Pre-request / test 스크립트는 가져오거나 실행하지 않습니다.')
      if (item.variable)
        warnings.add('폴더별 변수는 지원하지 않습니다. 환경 변수에서 직접 설정하세요.')
      const auth = item.auth === undefined || item.auth === null ? inherited : item.auth
      if (item.item) {
        warnings.add('중첩 폴더는 요청 이름의 경로로 보존합니다.')
        walk(item.item, `${prefix}${item.name} / `, auth, depth + 1)
      }
      if (!item.request) continue
      const raw =
        typeof item.request === 'string' ? { method: 'GET', url: item.request } : item.request
      const request = postmanRequest.parse(raw)
      if (!METHODS.includes(request.method as RequestDraft['method']))
        throw new Error(`지원하지 않는 HTTP 메서드: ${request.method}`)
      if (request.body?.mode && !['raw', 'urlencoded'].includes(request.body.mode))
        throw new Error(
          `"${item.name}": ${request.body.mode} 본문은 아직 지원하지 않습니다. 가져오기를 취소했습니다.`,
        )
      const draft = newRequest()
      draft.name = `${prefix}${item.name}`
      draft.collectionId = collectionId
      draft.method = request.method as RequestDraft['method']
      const url = request.url
      if (typeof url === 'string') draft.url = url
      else {
        if (url.variable?.length)
          throw new Error(`"${item.name}": Postman 경로 변수는 URL에 직접 입력한 뒤 가져오세요.`)
        draft.url =
          url.raw ??
          `${url.protocol ?? 'https'}://${Array.isArray(url.host) ? url.host.join('.') : (url.host ?? '')}${url.port ? `:${url.port}` : ''}/${Array.isArray(url.path) ? url.path.join('/') : (url.path ?? '')}`
        if (url.query) {
          // Query is represented exactly once, including disabled entries and duplicate keys.
          draft.url = draft.url.split('?')[0].split('#')[0]
          draft.params = pairs(url.query)
        }
      }
      if (typeof request.header === 'string')
        throw new Error(`"${item.name}": 문자열 형식 헤더는 지원하지 않습니다.`)
      draft.headers = pairs(request.header)
      const actualAuth = request.auth ?? auth
      if (actualAuth?.type && !['noauth', 'bearer', 'basic'].includes(actualAuth.type))
        throw new Error(
          `"${item.name}": ${actualAuth.type} 인증은 아직 지원하지 않습니다. 가져오기를 취소했습니다.`,
        )
      if (actualAuth?.type === 'bearer') {
        draft.auth.type = 'bearer'
        draft.auth.token = String(
          actualAuth.bearer?.find((pair) => pair.key === 'token')?.value ?? '',
        )
      } else if (actualAuth?.type === 'basic') {
        draft.auth.type = 'basic'
        draft.auth.username = String(
          actualAuth.basic?.find((pair) => pair.key === 'username')?.value ?? '',
        )
        draft.auth.password = String(
          actualAuth.basic?.find((pair) => pair.key === 'password')?.value ?? '',
        )
      }
      if (request.body?.mode === 'raw') {
        draft.bodyMode = request.body.options?.raw?.language === 'json' ? 'json' : 'text'
        draft.body = request.body.raw ?? ''
      } else if (request.body?.mode === 'urlencoded') {
        draft.bodyMode = 'form'
        draft.form = pairs(request.body.urlencoded)
      }
      workspace.requests.push(draft)
    }
  }
  walk(source.item, '', source.auth)
  if (!workspace.requests.length) warnings.add('가져올 요청이 없는 컬렉션입니다.')
  const backup = backupSchema.parse({
    format: 'wook-post',
    schemaVersion: 1,
    appVersion,
    exportedAt: new Date().toISOString(),
    scope: 'workspace',
    workspace,
    history: [],
  })
  return { backup, format: 'Postman Collection', warnings: [...warnings] }
}

export function exportPostman(workspace: Workspace) {
  const convert = (draft: RequestDraft) => {
    const pairs = (values: typeof draft.params) =>
      values.map(({ key, value, enabled }) => ({ key, value, disabled: !enabled }))
    const hasParams = draft.params.length > 0
    let url: unknown = draft.url
    if (hasParams) {
      const withoutHash = draft.url.split('#')[0]
      const queryIndex = withoutHash.indexOf('?')
      const base = queryIndex < 0 ? withoutHash : withoutHash.slice(0, queryIndex)
      const query = queryIndex < 0 ? '' : withoutHash.slice(queryIndex + 1)
      const existing = [...new URLSearchParams(query)].map(([key, value]) => ({
        key,
        value,
        disabled: false,
      }))
      const all = [...existing, ...pairs(draft.params)]
      const search = new URLSearchParams(
        all.filter((pair) => !pair.disabled).map((pair) => [pair.key, pair.value]),
      ).toString()
      url = { raw: base + (search ? `?${search}` : ''), query: all }
    }
    return {
      name: draft.name,
      request: {
        method: draft.method,
        url,
        header: pairs(draft.headers),
        auth:
          draft.auth.type === 'none'
            ? { type: 'noauth' }
            : draft.auth.type === 'bearer'
              ? {
                  type: 'bearer',
                  bearer: [{ key: 'token', value: draft.auth.token, type: 'string' }],
                }
              : {
                  type: 'basic',
                  basic: [
                    { key: 'username', value: draft.auth.username, type: 'string' },
                    { key: 'password', value: draft.auth.password, type: 'string' },
                  ],
                },
        ...(draft.bodyMode === 'none'
          ? {}
          : {
              body:
                draft.bodyMode === 'form'
                  ? { mode: 'urlencoded', urlencoded: pairs(draft.form) }
                  : {
                      mode: 'raw',
                      raw: draft.body,
                      options: { raw: { language: draft.bodyMode === 'json' ? 'json' : 'text' } },
                    },
            }),
      },
    }
  }
  const environment = workspace.environments.find(
    (item) => item.id === workspace.activeEnvironmentId,
  )
  return {
    info: {
      name: 'wPost',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable:
      environment?.values
        .filter((item) => item.enabled)
        .map(({ key, value }) => ({ key, value })) ?? [],
    item: [
      ...workspace.collections.map((collection) => ({
        name: collection.name,
        item: workspace.requests
          .filter((request) => request.collectionId === collection.id)
          .map(convert),
      })),
      ...workspace.requests.filter((request) => !request.collectionId).map(convert),
    ],
  }
}

export async function readImport(path: string) {
  if ((await stat(path)).size > MAX_TRANSFER_BYTES)
    throw new Error('가져오기 파일은 100 MiB까지 지원합니다.')
  return readFile(path, 'utf8')
}

export async function atomicWrite(path: string, content: string | Buffer) {
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, content, { flag: 'wx', mode: 0o600 })
    await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true })
  }
}
