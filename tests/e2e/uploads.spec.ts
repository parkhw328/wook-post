import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'

let application: ElectronApplication
let directory: string
let dataDirectory: string
let server: Server
let baseUrl: string
let paths: string[]
const bytes = Buffer.from([0, 255, 128, 10, 13, 65])
const errors: string[] = []
async function launch() {
  application = await electron.launch({
    args: [
      ...(process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : []),
      process.cwd(),
    ],
    env: { ...process.env, WOOK_POST_TEST_DATA_DIR: dataDirectory },
  })
  const page = await application.firstWindow()
  page.on('pageerror', (error) => errors.push(error.message))
  await expect(page.getByRole('button', { name: /^요청 저장/ })).toBeEnabled()
  return page
}
async function close() {
  await application
    .evaluate(({ dialog }) => {
      dialog.showMessageBoxSync = () => 1
    })
    .catch(() => {})
  await application.close()
}
async function selectFiles(files: string[], multiple: boolean) {
  await application.evaluate(
    ({ dialog }, { files, multiple }) => {
      dialog.showOpenDialog = async (_window: unknown, options?: { properties?: string[] }) => {
        if (options?.properties?.includes('multiSelections') !== multiple)
          throw new Error('Incorrect file selection mode')
        return { canceled: false, filePaths: files }
      }
    },
    { files, multiple },
  )
}
async function latestResult(page: Page) {
  return page.evaluate(async () => {
    const state = await window.wook.load()
    const entry = await window.wook.getHistory(state.history[0].id)
    return JSON.parse(entry!.response.bodyText)
  })
}

test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'wpost-upload-e2e-'))
  paths = [join(directory, '첨부 파일.bin'), join(directory, '두 번째.txt')]
  await writeFile(paths[0], bytes)
  await writeFile(paths[1], '한글 텍스트')
  server = createServer(async (request, response) => {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(chunk as Buffer)
    const body = Buffer.concat(chunks)
    const contentType = request.headers['content-type'] ?? ''
    const fields: unknown[] = []
    if (contentType.startsWith('multipart/')) {
      const form = await new Response(body, { headers: { 'Content-Type': contentType } }).formData()
      for (const [key, value] of form)
        fields.push(
          typeof value === 'string'
            ? { key, value }
            : {
                key,
                name: value.name,
                bytes: Buffer.from(await value.arrayBuffer()).toString('base64'),
              },
        )
    }
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(
      JSON.stringify({ fields, bytes: body.toString('base64'), contentType, query: request.url }),
    )
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
test.beforeEach(async () => {
  errors.length = 0
  dataDirectory = join(directory, crypto.randomUUID())
  await launch()
})
test.afterEach(async () => {
  await close()
  expect(errors).toEqual([])
})
test.afterAll(async () => {
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await rm(directory, { recursive: true, force: true })
})

test('header suggestions support filtering, keyboard, mouse, escape and custom values', async () => {
  const page = await application.firstWindow()
  await page.getByRole('tab', { name: '헤더', exact: true }).click()
  await page.getByRole('button', { name: '헤더 추가' }).click()
  const key = page.getByRole('combobox', { name: '헤더 1 키' })
  await key.fill('coNTent-t')
  await expect(page.getByRole('option', { name: 'Content-Type', exact: true })).toBeVisible()
  await key.press('Enter')
  await expect(key).toHaveValue('Content-Type')
  const value = page.getByRole('combobox', { name: '헤더 1 값' })
  await value.fill('JSON')
  await value.press('Tab')
  await expect(value).toHaveValue('application/json')
  await page.getByRole('button', { name: '헤더 추가' }).click()
  const second = page.getByRole('combobox', { name: '헤더 2 키' })
  await second.fill('content')
  await expect(page.getByRole('option', { name: 'Content-Type', exact: true })).toHaveCount(0)
  await second.fill('auth')
  await page.getByRole('option', { name: 'Authorization', exact: true }).click()
  const auth = page.getByRole('combobox', { name: '헤더 2 값' })
  await auth.focus()
  await auth.press('ArrowDown')
  await auth.press('Enter')
  await expect(auth).toHaveValue('Basic ')
  await auth.fill('Bearer local-token')
  await auth.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(auth).toHaveValue('Bearer local-token')
  await second.fill('X-My-Custom-Header')
  await second.press('Tab')
  await expect(second).toHaveValue('X-My-Custom-Header')
  await second.fill('acc')
  await auth.fill('application/json')
  await second.focus()
  await page.screenshot({ path: 'test-results/header-autocomplete.png' })
  await second.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(second).toHaveValue('acc')
})

test('header values expose the full list and can be browsed again after choosing a value', async () => {
  const page = await application.firstWindow()
  await page.getByRole('tab', { name: '헤더', exact: true }).click()
  await page.getByRole('button', { name: '헤더 추가' }).click()
  const key = page.getByRole('combobox', { name: '헤더 1 키' })
  await key.fill('content-type')
  await key.press('Tab')
  const value = page.getByRole('combobox', { name: '헤더 1 값' })
  await expect(value).toBeFocused()
  await expect(page.getByRole('option', { name: 'application/json', exact: true })).toBeVisible()
  // The former eight-item cap hid this existing MIME type from the initial list.
  await expect(page.getByRole('option', { name: 'image/jpeg', exact: true })).toHaveCount(1)
  await page.getByRole('option', { name: 'application/json', exact: true }).click()
  await expect(value).toHaveValue('application/json')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await value.click()
  await expect(page.getByRole('option', { name: 'application/xml', exact: true })).toBeVisible()
  await page.getByRole('option', { name: 'application/xml', exact: true }).click()
  await expect(value).toHaveValue('application/xml')
  await value.press('Escape')
  await page.getByRole('button', { name: '헤더 1 값 추천 목록' }).click()
  await page.getByRole('option', { name: 'image/jpeg', exact: true }).click()
  await expect(value).toHaveValue('image/jpeg')
  await value.fill('PROBLEM')
  await expect(
    page.getByRole('option', { name: 'application/problem+json', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('option', { name: 'image/jpeg', exact: true })).toHaveCount(0)
  await value.press('Enter')
  await expect(value).toHaveValue('application/problem+json')
  // Looking at other candidates and tabbing away must preserve the existing value.
  await value.click()
  await value.press('Tab')
  await expect(value).toHaveValue('application/problem+json')
  await value.fill('{{contentType}}')
  await value.press('Tab')
  await expect(value).toHaveValue('{{contentType}}')
  await value.fill('application/vnd.example.custom+json')
  await value.press('Escape')
  await page.getByRole('button', { name: '헤더 1 값 추천 목록' }).click()
  await page.getByRole('option', { name: 'text/plain; charset=utf-8', exact: true }).click()
  await expect(value).toHaveValue('text/plain; charset=utf-8')
  await key.fill('Accept')
  await key.press('Tab')
  await page.getByRole('option', { name: '*/*', exact: true }).click()
  await expect(value).toHaveValue('*/*')
  await key.fill('Cache-Control')
  await key.press('Tab')
  await page.getByRole('option', { name: 'no-store', exact: true }).click()
  await expect(value).toHaveValue('no-store')
  await key.fill('X-Custom-Header')
  await key.press('Tab')
  await expect(page.getByRole('button', { name: '헤더 1 값 추천 목록' })).toHaveCount(0)
  await expect(value).toHaveValue('no-store')
  await key.fill('constructor')
  await key.press('Tab')
  await expect(page.getByRole('button', { name: '헤더 1 값 추천 목록' })).toHaveCount(0)
  await expect(value).toHaveValue('no-store')
  await key.fill('Content-Type')
  await key.press('Tab')
  await page.getByRole('option', { name: 'application/json', exact: true }).click()
  await value.click()
  await page.screenshot({ path: 'test-results/header-value-autocomplete.png' })
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].setSize(1000, 700)
  })
  await value.press('End')
  await page.getByRole('option', { name: 'image/jpeg', exact: true }).click()
  await expect(value).toHaveValue('image/jpeg')
  expect(
    await page
      .locator('.editor-content')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true)
})

test('multipart files and query parameters survive save, backup, import, restart and history replay', async () => {
  let page = await application.firstWindow()
  await page.getByRole('textbox', { name: '요청 URL' }).fill(baseUrl)
  await page.getByRole('combobox', { name: 'HTTP 메서드' }).selectOption('POST')
  await page.getByRole('button', { name: '파라미터 추가' }).click()
  await page.getByRole('textbox', { name: '파라미터 1 키' }).fill('tag')
  await page.getByRole('textbox', { name: '파라미터 1 값' }).fill('query')
  await page.getByRole('button', { name: '파일 첨부 설정' }).click()
  await expect(page.getByRole('radio', { name: 'Form Data', exact: true })).toBeChecked()
  await page.getByRole('textbox', { name: '폼 데이터 1 키' }).fill('upload')
  await selectFiles(paths, true)
  await page.getByRole('button', { name: '폼 데이터 1 파일 선택' }).click()
  await expect(page.locator('.attachment-name').filter({ hasText: '첨부 파일.bin' })).toBeVisible()
  await page.getByRole('button', { name: '텍스트 필드 추가' }).click()
  await page.getByRole('textbox', { name: '폼 데이터 2 키' }).fill('title')
  await page.getByRole('textbox', { name: '폼 데이터 2 값' }).fill('한글 폼 값')
  await page.getByRole('button', { name: '파일 필드 추가' }).click()
  await page.getByRole('textbox', { name: '폼 데이터 3 키' }).fill('disabled')
  await page.getByRole('checkbox', { name: '폼 데이터 3 활성화' }).uncheck()
  await page.getByRole('button', { name: /^전송/ }).click()
  await expect(page.getByText('200 OK', { exact: true })).toBeVisible()
  const result = await latestResult(page)
  expect(result.query).toBe('/?tag=query')
  expect(result.fields).toEqual([
    { key: 'upload', name: '첨부 파일.bin', bytes: bytes.toString('base64') },
    { key: 'upload', name: '두 번째.txt', bytes: Buffer.from('한글 텍스트').toString('base64') },
    { key: 'title', value: '한글 폼 값' },
  ])
  await page.locator('.editor-content').evaluate((element) => {
    element.scrollTop = 0
  })
  await page.screenshot({ path: 'test-results/multipart-upload.png' })
  await page.getByRole('button', { name: /^요청 저장/ }).click()
  await page.getByRole('textbox', { name: '저장 이름' }).fill('파일 업로드')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const backupPath = join(directory, 'upload-backup.json')
  await application.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path })
  }, backupPath)
  await page.evaluate(() => window.wook.exportData({ scope: 'workspace' }))
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  expect(
    backup.workspace.requests[0].multipart[0].files.map((file: { path: string }) => file.path),
  ).toEqual(paths)
  await application.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] })
  }, backupPath)
  await page.getByRole('button', { name: '가져오기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '가져오기 미리보기' })).toContainText(
    '파일 내용은 백업에 포함되지 않습니다',
  )
  await page.getByRole('button', { name: '가져오기 적용' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await close()
  page = await launch()
  await page
    .locator('.request-row')
    .filter({ hasText: '파일 업로드' })
    .first()
    .locator('button')
    .first()
    .click()
  await page.getByRole('tab', { name: /^본문/ }).click()
  await expect(page.locator('.attachment-name').filter({ hasText: '첨부 파일.bin' })).toBeVisible()
  await page.getByRole('button', { name: /^전송/ }).click()
  await expect(page.getByText('200 OK', { exact: true })).toBeVisible()
  expect((await latestResult(page)).fields).toEqual(result.fields)
  await page.getByRole('button', { name: '히스토리', exact: true }).click()
  await page.locator('.history-row').first().click()
  await page.getByRole('button', { name: /^전송/ }).click()
  await expect
    .poll(async () => (await page.evaluate(() => window.wook.load())).historyTotal)
    .toBe(3)
  expect((await latestResult(page)).fields).toEqual(result.fields)
})

test('binary upload, canceled picker, removal and missing source work at minimum window size', async () => {
  const page = await application.firstWindow()
  await application.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].setSize(1000, 700)
  })
  await page.evaluate(() =>
    window.wook.saveAppearance({ latinFont: 'jetbrains', koreanFont: 'noto', scale: 150 }),
  )
  await page.reload()
  await page.getByRole('textbox', { name: '요청 URL' }).fill(baseUrl)
  await page.getByRole('combobox', { name: 'HTTP 메서드' }).selectOption('PUT')
  await page.getByRole('tab', { name: '본문', exact: true }).click()
  await page.getByRole('radio', { name: 'Binary 파일' }).check()
  const path = join(directory, 'temporary.bin')
  await writeFile(path, bytes)
  await selectFiles([path], false)
  await page.getByRole('button', { name: '바이너리 본문 파일 선택' }).click()
  await expect(page.locator('.attachment-name').filter({ hasText: 'temporary.bin' })).toBeVisible()
  await application.evaluate(({ dialog }) => {
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] })
  })
  await page.getByRole('button', { name: '바이너리 본문 파일 선택' }).click()
  await expect(page.locator('.attachment-name').filter({ hasText: 'temporary.bin' })).toBeVisible()
  await page.getByRole('button', { name: /^전송/ }).click()
  await expect(page.getByText('200 OK', { exact: true })).toBeVisible()
  expect((await latestResult(page)).bytes).toBe(bytes.toString('base64'))
  await page.screenshot({ path: 'test-results/binary-upload-compact.png' })
  await rm(path)
  await page.getByRole('button', { name: /^전송/ }).click()
  await expect(page.locator('.response-warning.error')).toContainText('다시 선택')
  await page.getByRole('button', { name: '바이너리 본문 temporary.bin 제거' }).click()
  await expect(page.getByText('선택한 파일 없음')).toBeVisible()
  await page.getByRole('button', { name: /^전송/ }).click()
  await expect(page.locator('.response-warning.error')).toContainText('파일을 선택하세요')
  await page.getByRole('radio', { name: 'Form Data', exact: true }).check()
  await page.getByRole('button', { name: '텍스트 필드 추가' }).click()
  await page.getByRole('textbox', { name: '폼 데이터 1 키' }).fill('upload')
  await page.getByRole('combobox', { name: '폼 데이터 1 유형' }).selectOption('file')
  await selectFiles(paths, true)
  await page.getByRole('button', { name: '폼 데이터 1 파일 선택' }).click()
  await page.getByRole('button', { name: '폼 데이터 1 두 번째.txt 제거' }).click()
  await expect(page.locator('.attachment-name').filter({ hasText: '두 번째.txt' })).toHaveCount(0)
  await page.getByRole('button', { name: /^전송/ }).click()
  await expect(page.getByText('200 OK', { exact: true })).toBeVisible()
  expect((await latestResult(page)).fields).toEqual([
    { key: 'upload', name: '첨부 파일.bin', bytes: bytes.toString('base64') },
  ])
  expect(
    await page
      .locator('.editor-content')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true)
  await page.screenshot({ path: 'test-results/multipart-upload-compact.png' })
})
