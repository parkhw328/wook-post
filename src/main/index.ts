import { app, BrowserWindow, clipboard, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { mkdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  backupSchema,
  MAX_TRANSFER_BYTES,
  requestSchema,
  workspaceSchema,
  type Backup,
  type ExportOptions,
} from '../shared/contracts'
import { Store } from './store'
import { executeRequest } from './http'
import { atomicWrite, exportPostman, parseImport, readImport } from './transfers'

let window: BrowserWindow | null = null
let store: Store
let pendingImport: { token: string; backup: Backup } | null = null
const operations = new Map<string, AbortController>()
const rendererFile = join(__dirname, '../renderer/index.html')
const devUrl = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined

function trusted(event: IpcMainInvokeEvent) {
  if (
    !window ||
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame
  )
    throw new Error('허용되지 않은 요청입니다.')
  const url = event.senderFrame?.url
  if (
    devUrl
      ? new URL(url!).origin !== new URL(devUrl).origin
      : url !== pathToFileURL(rendererFile).href
  )
    throw new Error('허용되지 않은 화면입니다.')
}

function handle(channel: string, action: (...args: any[]) => unknown) {
  ipcMain.handle(channel, async (event, ...args: unknown[]) => {
    trusted(event)
    try {
      return await action(...args)
    } catch (error) {
      if (error instanceof z.ZodError)
        throw new Error('입력 데이터 형식이 올바르지 않습니다. 값과 파일 형식을 확인하세요.')
      throw error
    }
  })
}

function registerHandlers() {
  handle('workspace:load', () => store.state())
  handle('appearance:load', () => store.getAppearance())
  handle('appearance:save', (input: unknown) => store.saveAppearance(input))
  handle('workspace:save', (input: unknown) => {
    store.saveWorkspace(workspaceSchema.parse(input))
    return store.state()
  })
  handle('request:send', async (input: unknown, operation: unknown) => {
    const request = requestSchema.parse(input)
    const id = z.string().uuid().parse(operation)
    if (operations.size) throw new Error('진행 중인 요청을 완료하거나 취소하세요.')
    const controller = new AbortController()
    operations.set(id, controller)
    try {
      const workspace = store.getWorkspace()
      const environment = workspace.environments.find(
        (item) => item.id === workspace.activeEnvironmentId,
      )
      const entry = await executeRequest(request, environment, controller.signal)
      store.addHistory(entry)
      return entry
    } finally {
      operations.delete(id)
    }
  })
  handle('request:cancel', (id: unknown) => {
    operations.get(z.string().uuid().parse(id))?.abort()
  })
  handle('history:get', (id: unknown) => store.getHistory(z.string().uuid().parse(id)))
  handle('response:copy', (id: unknown) => {
    const entry = store.getHistory(z.string().uuid().parse(id))
    if (!entry || entry.response.encoding !== 'text')
      throw new Error('복사할 텍스트 응답을 선택하세요.')
    clipboard.writeText(entry.response.bodyText)
  })
  handle('history:list', (offset: unknown) =>
    store.listHistory(z.number().int().min(0).max(1_000_000).parse(offset)),
  )
  handle('history:clear', async () => {
    const answer = await dialog.showMessageBox(window!, {
      type: 'question',
      buttons: ['취소', '전체 삭제'],
      defaultId: 0,
      cancelId: 0,
      title: '히스토리 삭제',
      message: '저장된 요청·응답 기록을 모두 삭제할까요?',
      detail: '먼저 히스토리를 내보내면 다시 가져올 수 있습니다. 컬렉션의 요청은 유지됩니다.',
    })
    if (answer.response === 1) store.clearHistory()
    return store.state()
  })
  handle('file:preview-import', async () => {
    pendingImport = null
    const result = await dialog.showOpenDialog(window!, {
      title: 'wPost 백업 / Postman 컬렉션 가져오기',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePaths[0]) return null
    const path = result.filePaths[0]
    const parsed = parseImport(await readImport(path), app.getVersion())
    pendingImport = { token: randomUUID(), backup: parsed.backup }
    return {
      token: pendingImport.token,
      fileName: basename(path),
      format: parsed.format,
      requests: parsed.backup.workspace?.requests.length ?? 0,
      history: parsed.backup.history.length,
      environments: parsed.backup.workspace?.environments.length ?? 0,
      warnings: parsed.warnings,
    }
  })
  handle('file:apply-import', (input: unknown) => {
    const token = z.string().uuid().parse(input)
    if (pendingImport?.token !== token) throw new Error('가져오기 파일을 다시 선택하세요.')
    store.importBackup(pendingImport.backup)
    pendingImport = null
    return store.state()
  })
  handle('file:export', async (input: unknown) => {
    const options: ExportOptions = z
      .object({
        scope: z.enum(['workspace', 'history', 'response', 'body', 'postman']),
        historyId: z.string().uuid().optional(),
      })
      .parse(input)
    let content: string | Buffer
    if (options.scope === 'body' || options.scope === 'response') {
      const entry = options.historyId ? store.getHistory(options.historyId) : null
      if (!entry) throw new Error('내보낼 응답을 선택하세요.')
      content =
        options.scope === 'body'
          ? Buffer.from(entry.response.bodyBase64, 'base64')
          : JSON.stringify(
              backupSchema.parse({
                format: 'wook-post',
                schemaVersion: 1,
                appVersion: app.getVersion(),
                exportedAt: new Date().toISOString(),
                scope: 'response',
                history: [entry],
              }),
            )
    } else if (options.scope === 'postman') {
      content = JSON.stringify(exportPostman(store.getWorkspace()), null, 2)
    } else {
      content = JSON.stringify(
        backupSchema.parse({
          format: 'wook-post',
          schemaVersion: 1,
          appVersion: app.getVersion(),
          exportedAt: new Date().toISOString(),
          scope: options.scope,
          ...(options.scope === 'workspace' ? { workspace: store.getWorkspace() } : {}),
          history: store.allHistory(),
        }),
      )
    }
    if (Buffer.byteLength(content) > MAX_TRANSFER_BYTES)
      throw new Error('내보내기 파일 한도(100 MiB)를 초과했습니다. 기존 데이터는 유지됩니다.')
    const raw = options.scope === 'body'
    const result = await dialog.showSaveDialog(window!, {
      title: raw ? '응답 본문 저장' : '데이터 내보내기',
      defaultPath: `wPost-${options.scope}-${new Date().toISOString().slice(0, 10)}.${raw ? 'bin' : 'json'}`,
      filters: raw
        ? [{ name: '모든 파일', extensions: ['*'] }]
        : [{ name: 'JSON', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return null
    await atomicWrite(result.filePath, content)
    return result.filePath
  })
  handle('app:info', () => ({ version: app.getVersion(), dataPath: app.getPath('userData') }))
}

function createWindow() {
  window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1000,
    minHeight: 700,
    title: 'wPost',
    icon: app.isPackaged
      ? join(process.resourcesPath, 'icon.png')
      : join(app.getAppPath(), 'build/icon.png'),
    backgroundColor: '#100f0f',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  window.setMenuBarVisibility(false)
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(window!, {
      type: 'question',
      buttons: ['계속 작업', '종료'],
      defaultId: 0,
      cancelId: 0,
      title: '작업 중인 요청',
      message: '저장하지 않은 변경 또는 진행 중인 요청이 있습니다.',
      detail: '종료하면 저장하지 않은 편집 내용은 사라집니다.',
    })
    if (choice === 1) event.preventDefault()
  })
  window.webContents.on('will-attach-webview', (event) => event.preventDefault())
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false),
  )
  window.webContents.session.setPermissionCheckHandler(() => false)
  window.once('ready-to-show', () => window?.show())
  window.on('closed', () => {
    window = null
  })
  if (devUrl) void window.loadURL(devUrl)
  else void window.loadFile(rendererFile)
}

app.setName('wPost')
// Keep the pre-branding location so an upgrade opens the existing database.
app.setPath('userData', join(app.getPath('appData'), 'Wook Post'))
app.setAppUserModelId('com.parkhw328.wookpost')
if (!app.isPackaged && process.env.WOOK_POST_TEST_DATA_DIR)
  app.setPath('userData', process.env.WOOK_POST_TEST_DATA_DIR)
const locked = app.requestSingleInstanceLock()
if (!locked) app.quit()
else {
  app.on('second-instance', () => {
    if (window?.isMinimized()) window.restore()
    window?.focus()
  })
  app
    .whenReady()
    .then(() => {
      mkdirSync(app.getPath('userData'), { recursive: true })
      store = new Store(join(app.getPath('userData'), 'wook-post.sqlite'))
      registerHandlers()
      createWindow()
      app.on('activate', () => {
        if (!window) createWindow()
      })
    })
    .catch((error: unknown) => {
      dialog.showErrorBox('wPost 시작 실패', error instanceof Error ? error.message : String(error))
      app.quit()
    })
}
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('before-quit', () => {
  for (const controller of operations.values()) controller.abort()
})
app.on('will-quit', () => store?.close())
