import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'

let application: ElectronApplication
let server: Server
let directory: string
let baseUrl: string

async function launch() {
  return electron.launch({
    args: [
      ...(process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : []),
      join(process.cwd(), 'out/main/index.js'),
    ],
    env: { ...process.env, WOOK_POST_TEST_DATA_DIR: join(directory, 'data') },
  })
}

test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'wook-post-e2e-'))
  server = createServer(async (request, response) => {
    if (request.url?.startsWith('/slow')) {
      const timer = setTimeout(() => response.end('late'), 10_000)
      response.on('close', () => clearTimeout(timer))
      return
    }
    if (request.url?.startsWith('/binary')) {
      response.writeHead(200, { 'Content-Type': 'application/octet-stream' })
      response.end(Buffer.from([0, 255, 128, 13, 10]))
      return
    }
    response.writeHead(200, { 'Content-Type': 'application/json' })
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(chunk as Buffer)
    response.end(
      JSON.stringify({
        message: '연결 성공',
        method: request.method,
        path: request.url,
        authorization: request.headers.authorization ?? null,
        body: Buffer.concat(chunks).toString('utf8'),
      }),
    )
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  application = await launch()
})

test.afterAll(async () => {
  if (application)
    await application
      .evaluate(({ dialog }) => {
        dialog.showMessageBoxSync = () => 1
      })
      .catch(() => {})
  await application?.close()
  server?.closeAllConnections()
  await new Promise<void>((resolve) => server?.close(() => resolve()))
  await rm(directory, { recursive: true, force: true })
})

test('desktop request → save → export → import → restart → replay → cancel → binary export', async () => {
  let page = await application.firstWindow()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await expect(page.getByText('API와 대화를 시작하세요.')).toBeVisible()
  await page.screenshot({ path: 'test-results/desktop-welcome.png' })
  expect(
    await page.evaluate(() => typeof (window as unknown as { require?: unknown }).require),
  ).toBe('undefined')

  await page.getByRole('button', { name: '컬렉션 추가', exact: true }).click()
  await page.getByRole('textbox', { name: '저장 이름' }).fill('로컬 API')
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('textbox', { name: '요청 URL' }).fill(baseUrl + '/echo?client=wook')
  await page.getByRole('button', { name: '파라미터 추가' }).click()
  await page.getByRole('textbox', { name: '파라미터 1 키' }).fill('q')
  await page.getByRole('textbox', { name: '파라미터 1 값' }).fill('한글')
  await page.getByRole('button', { name: /요청 저장/ }).click()
  await page.getByRole('textbox', { name: '저장 이름' }).fill('상태 확인')
  const workspace = await page.evaluate(() => window.wook.load())
  await page
    .getByRole('combobox', { name: '저장할 컬렉션' })
    .selectOption(workspace.workspace.collections[0].id)
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: /^전송/ }).click()
  await expect(page.getByText('200 OK', { exact: true })).toBeVisible()
  await expect(page.getByLabel('응답 본문', { exact: true })).toContainText('연결 성공')
  await page.screenshot({ path: 'test-results/desktop-response.png' })

  const exportPath = join(directory, 'backup.json')
  await application.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path })
  }, exportPath)
  await page.getByRole('button', { name: '내보내기', exact: true }).click()
  await page.getByRole('button', { name: '파일 저장', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const backup = JSON.parse(await readFile(exportPath, 'utf8'))
  expect(backup.history).toHaveLength(1)
  expect(backup.workspace.requests[0].name).toBe('상태 확인')
  expect(backup.history[0].response.bodyText).toContain('연결 성공')
  await application.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] })
  }, exportPath)
  await page.getByRole('button', { name: '가져오기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '가져오기 미리보기' })).toBeVisible()
  await page.getByRole('button', { name: '가져오기 적용' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const imported = await page.evaluate(() => window.wook.load())
  expect(imported.workspace.requests).toHaveLength(2)
  expect(imported.historyTotal).toBe(1)

  await application.close()
  application = await launch()
  page = await application.firstWindow()
  page.on('pageerror', (error) => errors.push(error.message))
  await expect(page.getByText('API와 대화를 시작하세요.')).toBeVisible()
  expect((await page.evaluate(() => window.wook.load())).workspace.requests).toHaveLength(2)
  await page.getByRole('button', { name: '히스토리', exact: true }).click()
  await page.locator('.history-row').first().click()
  await expect(page.getByText('200 OK', { exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '요청 URL' })).toHaveValue(/client=wook&q=/)
  await page.getByRole('button', { name: /^전송/ }).click()
  await expect
    .poll(async () => (await page.evaluate(() => window.wook.load())).historyTotal)
    .toBe(2)

  await page.getByRole('textbox', { name: '요청 URL' }).fill(baseUrl + '/slow')
  await page.getByRole('button', { name: /^전송/ }).click()
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await expect(page.locator('.response-warning.error')).toContainText('요청을 취소했습니다.')
  await page.getByRole('textbox', { name: '요청 URL' }).fill(baseUrl + '/binary')
  await page.getByRole('button', { name: /^전송/ }).click()
  await expect(page.getByRole('heading', { name: '바이너리 응답' })).toBeVisible()
  const binaryPath = join(directory, 'response.bin')
  await application.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path })
  }, binaryPath)
  await page.getByRole('button', { name: '본문 파일 저장', exact: true }).click()
  await page.getByRole('button', { name: '파일 저장', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await readFile(binaryPath)).toEqual(Buffer.from([0, 255, 128, 13, 10]))

  const invalidPath = join(directory, 'invalid.json')
  await writeFile(invalidPath, '{"format":"wook-post","schemaVersion":99}')
  await application.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] })
  }, invalidPath)
  const before = await page.evaluate(() => window.wook.load())
  await page.getByRole('button', { name: '가져오기', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('형식 또는 버전')
  expect(await page.evaluate(() => window.wook.load())).toEqual(before)
  expect(errors).toEqual([])
})

test('environment, JSON body, bearer auth, shortcuts and unsaved-close protection work in the UI', async () => {
  const page = await application.firstWindow()
  await page.getByRole('button', { name: '새 요청', exact: true }).click()
  await page.getByRole('button', { name: '환경 변수 관리', exact: true }).click()
  await page.getByRole('button', { name: '환경 추가', exact: true }).click()
  await page.getByRole('textbox', { name: '환경 이름' }).fill('E2E Local')
  await page.getByRole('textbox', { name: '변수 1 값' }).fill(baseUrl)
  await page.getByRole('button', { name: '환경 저장', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('combobox', { name: '활성 환경' }).selectOption({ label: 'E2E Local' })
  await expect(page.getByRole('combobox', { name: '활성 환경' })).toBeEnabled()
  await page.getByRole('textbox', { name: '요청 URL' }).fill('{{baseUrl}}/echo')
  await page.getByRole('combobox', { name: 'HTTP 메서드' }).selectOption('POST')
  await page.getByRole('tab', { name: '본문', exact: true }).click()
  await page.getByRole('radio', { name: 'JSON', exact: true }).check()
  await page
    .getByRole('textbox', { name: '요청 본문', exact: true })
    .fill('{"name":"한글","server":"{{baseUrl}}"}')
  await page.getByRole('tab', { name: '인증', exact: true }).click()
  await page.getByRole('combobox', { name: '인증 방식' }).selectOption('bearer')
  await page.getByLabel('토큰', { exact: true }).fill('local-test-token')
  await page.keyboard.press('Control+Enter')
  await expect(page.getByText('200 OK', { exact: true })).toBeVisible()
  const data = await page.evaluate(() => window.wook.load())
  const entry = await page.evaluate((id) => window.wook.getHistory(id), data.history[0].id)
  const body = JSON.parse(entry!.response.bodyText)
  expect(body.authorization).toBe('Bearer local-test-token')
  expect(JSON.parse(body.body)).toEqual({ name: '한글', server: baseUrl })

  await application.evaluate(({ dialog, BrowserWindow }) => {
    dialog.showMessageBoxSync = () => 0
    BrowserWindow.getAllWindows()[0].close()
  })
  await expect(page.getByRole('textbox', { name: '요청 URL' })).toBeVisible()
  await page.keyboard.press('Control+s')
  await expect(page.getByRole('dialog', { name: '요청 저장', exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: '저장 이름' }).fill('인증된 JSON 요청')
  await page.getByRole('dialog').getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
