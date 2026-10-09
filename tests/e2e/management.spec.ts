import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { emptyWorkspace, newRequest } from '../../src/shared/models'
import { defaultAppearance } from '../../src/shared/appearance'

let application: ElectronApplication
let directory: string
let server: Server
let baseUrl: string
let errors: string[]

async function launch() {
  const app = await electron.launch({
    args: [
      ...(process.platform === 'linux' && process.getuid?.() === 0 ? ['--no-sandbox'] : []),
      process.cwd(),
    ],
    env: { ...process.env, WOOK_POST_TEST_DATA_DIR: join(directory, 'data') },
  })
  const page = await app.firstWindow()
  page.on('pageerror', (error) => errors.push(error.message))
  await expect(page.getByRole('button', { name: '앱 설정', exact: true })).toBeEnabled()
  return app
}

test.beforeEach(async () => {
  errors = []
  directory = await mkdtemp(join(tmpdir(), 'wpost-management-'))
  server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end('{"message":"컬렉션 테스트"}')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  application = await launch()
})

test.afterEach(async () => {
  if (application) {
    await application
      .evaluate(({ dialog }) => {
        dialog.showMessageBoxSync = () => 1
      })
      .catch(() => {})
    await application.close()
  }
  server?.closeAllConnections()
  await new Promise<void>((resolve) => server?.close(() => resolve()))
  await rm(directory, { recursive: true, force: true })
  expect(errors).toEqual([])
})

async function seed(page: Page) {
  const collection = { id: crypto.randomUUID(), name: 'API A' }
  const other = { id: crypto.randomUUID(), name: 'API B' }
  const workspace = {
    ...emptyWorkspace(),
    collections: [collection, other],
    requests: [
      { ...newRequest(), collectionId: collection.id, name: '요청 A', url: baseUrl },
      { ...newRequest(), collectionId: other.id, name: '요청 B', url: baseUrl },
    ],
  }
  await page.evaluate((workspace) => window.wook.saveWorkspace(workspace), workspace)
  await page.reload()
  await page.locator('.request-row').filter({ hasText: '요청 A' }).locator('button').first().click()
  await page.getByRole('button', { name: /^전송/ }).click()
  await expect(page.getByText('200 OK', { exact: true })).toBeVisible()
  return workspace
}

test('rename and delete a collection while preserving requests, clean tabs and history across restart', async () => {
  let page = await application.firstWindow()
  const original = await seed(page)
  const history = (await page.evaluate(() => window.wook.load())).history
  await page.getByRole('button', { name: 'API A 컬렉션 이름 변경', exact: true }).click()
  await page.getByRole('textbox', { name: '저장 이름' }).fill('  ')
  await expect(page.getByRole('button', { name: '저장', exact: true })).toBeDisabled()
  await page.getByRole('textbox', { name: '저장 이름' }).fill('변경된 API')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const renamed = (await page.evaluate(() => window.wook.load())).workspace
  expect(renamed.collections[0]).toEqual({ ...original.collections[0], name: '변경된 API' })
  expect(renamed.requests).toEqual(original.requests)
  await page.screenshot({ path: 'test-results/desktop-collection-management.png' })
  await page.getByRole('button', { name: '변경된 API 컬렉션 삭제', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: '포함된 요청도 함께 삭제' })).not.toBeChecked()
  await page.screenshot({ path: 'test-results/desktop-collection-delete.png' })
  await page.getByRole('button', { name: '취소', exact: true }).click()
  expect((await page.evaluate(() => window.wook.load())).workspace).toEqual(renamed)
  await page.getByRole('button', { name: '변경된 API 컬렉션 삭제', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: '컬렉션 삭제', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const deleted = await page.evaluate(() => window.wook.load())
  expect(deleted.workspace.collections).toEqual([original.collections[1]])
  expect(deleted.workspace.requests).toEqual([
    { ...original.requests[0], collectionId: null },
    original.requests[1],
  ])
  expect(deleted.history).toEqual(history)
  await expect(page.locator('.request-tab.active .dirty-dot')).toHaveCount(0)
  await expect(page.getByText('분류하지 않은 요청', { exact: true })).toBeVisible()
  await application.close()
  application = await launch()
  page = await application.firstWindow()
  expect(await page.evaluate(() => window.wook.load())).toEqual(deleted)
})

test('explicit collection and request deletion preserves edited open tabs and recorded responses', async () => {
  const page = await application.firstWindow()
  const original = await seed(page)
  const before = await page.evaluate(() => window.wook.load())
  await page.getByRole('textbox', { name: '요청 URL' }).fill(baseUrl + '/unsaved')
  await page.getByRole('button', { name: 'API A 컬렉션 삭제', exact: true }).click()
  await page.getByRole('checkbox', { name: '포함된 요청도 함께 삭제' }).check()
  await page.getByRole('dialog').getByRole('button', { name: '컬렉션 삭제', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const after = await page.evaluate(() => window.wook.load())
  expect(after.workspace.requests).toEqual([original.requests[1]])
  expect(after.history).toEqual(before.history)
  await expect(page.getByRole('textbox', { name: '요청 URL' })).toHaveValue(baseUrl + '/unsaved')
  await expect(page.locator('.request-tab.active .dirty-dot')).toHaveCount(1)
  await expect(page.getByLabel('응답 본문', { exact: true })).toContainText('컬렉션 테스트')
  await page.getByRole('button', { name: '요청 A 탭 닫기', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '요청 탭 닫기' })).toBeVisible()
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await page.getByRole('button', { name: /요청 저장/ }).click()
  await expect(page.getByRole('combobox', { name: '저장할 컬렉션' })).toHaveValue('')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const saved = (await page.evaluate(() => window.wook.load())).workspace
  expect(saved.requests.find((item) => item.id === original.requests[0].id)).toMatchObject({
    collectionId: null,
    url: baseUrl + '/unsaved',
  })
  await expect(page.locator('.request-tab.active .dirty-dot')).toHaveCount(0)
})

test('font and size preview cancels cleanly, persists on save, and stays usable at maximum size', async () => {
  let page = await application.firstWindow()
  await expect(page.getByText('로그인 없이, 로컬에서')).toHaveCount(0)
  await expect(page.getByText('이 기기에 저장', { exact: true })).toHaveCount(0)
  await expect(page.getByText('로컬 저장소', { exact: true })).toHaveCount(0)
  await page.getByRole('textbox', { name: '요청 URL' }).fill(baseUrl)
  await page.getByRole('button', { name: /^전송/ }).click()
  await expect(page.locator('.response-code')).toContainText('컬렉션 테스트')
  await page.getByRole('button', { name: '앱 설정', exact: true }).click()
  await page.getByRole('button', { name: '글자 크기 키우기' }).click()
  await expect(page.getByRole('slider', { name: '요청·응답 글자 크기' })).toHaveValue('105')
  await page.getByRole('button', { name: '글자 크기 줄이기' }).click()
  await expect(page.getByRole('slider', { name: '요청·응답 글자 크기' })).toHaveValue('100')
  await page.getByRole('combobox', { name: '영문 글꼴', exact: true }).selectOption('arial')
  await page.getByRole('combobox', { name: '한글 글꼴', exact: true }).selectOption('malgun')
  await page.getByRole('slider', { name: '요청·응답 글자 크기' }).fill('125')
  await expect(page.locator('.response-code')).toHaveCSS('font-size', '21.25px')
  await expect(page.locator('body')).toHaveCSS('font-size', '16px')
  await expect(page.getByRole('button', { name: '설정 저장', exact: true })).toHaveCSS(
    'font-size',
    '16px',
  )
  await expect(page.getByRole('textbox', { name: '요청 URL' })).toHaveCSS('font-size', '21.25px')
  expect(
    await page.locator('body').evaluate((body) => getComputedStyle(body).fontFamily),
  ).toContain('Arial')
  expect(await page.evaluate(() => window.wook.loadAppearance())).toEqual(defaultAppearance)
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '요청 URL' })).toHaveCSS('font-size', '17px')
  await page.getByRole('button', { name: '앱 설정', exact: true }).click()
  await expect(page.getByRole('combobox', { name: '영문 글꼴', exact: true })).toHaveValue(
    'jetbrains',
  )
  await page.getByRole('slider', { name: '요청·응답 글자 크기' }).fill('125')
  await page.getByRole('combobox', { name: '영문 글꼴', exact: true }).selectOption('arial')
  await page.getByRole('combobox', { name: '한글 글꼴', exact: true }).selectOption('malgun')
  await expect(page.getByRole('button', { name: '설정 저장', exact: true })).toBeInViewport()
  await page.screenshot({ path: 'test-results/desktop-appearance.png' })
  await page.getByRole('button', { name: '설정 저장', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  // The response preview created an unsaved request; accept its close confirmation.
  await application.evaluate(({ dialog }) => {
    dialog.showMessageBoxSync = () => 1
  })
  await application.close()
  application = await launch()
  page = await application.firstWindow()
  await expect(page.getByRole('textbox', { name: '요청 URL' })).toHaveCSS('font-size', '21.25px')
  expect(await page.evaluate(() => window.wook.loadAppearance())).toEqual({
    scale: 125,
    latinFont: 'arial',
    koreanFont: 'malgun',
  })
  await application.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1000, 700),
  )
  await page.getByRole('button', { name: '앱 설정', exact: true }).click()
  await page.getByRole('button', { name: '기본값 복원', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '요청 URL' })).toHaveCSS('font-size', '17px')
  await page.getByRole('button', { name: '취소', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '요청 URL' })).toHaveCSS('font-size', '21.25px')
  await page.getByRole('button', { name: '앱 설정', exact: true }).click()
  await page.getByRole('slider', { name: '요청·응답 글자 크기' }).fill('150')
  await expect(page.getByRole('button', { name: '글자 크기 키우기' })).toBeDisabled()
  await expect(page.locator('body')).toHaveCSS('font-size', '16px')
  await page.getByRole('combobox', { name: '영문 글꼴', exact: true }).selectOption('jetbrains')
  await expect(page.getByRole('button', { name: '설정 저장', exact: true })).toBeInViewport()
  await page.screenshot({ path: 'test-results/desktop-appearance-settings-150-compact.png' })
  await page.getByRole('button', { name: '설정 저장', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: '요청 URL' })).toHaveCSS('font-size', '25.5px')
  await page.getByRole('combobox', { name: 'HTTP 메서드' }).selectOption('OPTIONS')
  await page.getByRole('textbox', { name: '요청 URL' }).fill(baseUrl)
  await page.getByRole('button', { name: /^전송/ }).click()
  await expect(page.getByText('200 OK', { exact: true })).toBeVisible()
  await expect(page.locator('.response-code')).toHaveCSS('font-size', '25.5px')
  await page.getByRole('tablist', { name: '응답 보기' }).getByRole('tab', { name: /헤더/ }).click()
  await expect(page.locator('.response-headers td').first()).toHaveCSS('font-size', '25.5px')
  await page.getByRole('tablist', { name: '응답 보기' }).getByRole('tab', { name: '본문' }).click()
  await page.getByRole('button', { name: 'Raw', exact: true }).click()
  await expect(page.locator('.response-code')).toHaveCSS('font-size', '25.5px')
  await page.screenshot({ path: 'test-results/desktop-appearance-150-compact.png' })
  await expect(page.getByRole('button', { name: '앱 설정', exact: true })).toBeInViewport()
  await page.getByRole('button', { name: '앱 설정', exact: true }).click()
  await page.getByRole('slider', { name: '요청·응답 글자 크기' }).fill('80')
  await expect(page.getByRole('button', { name: '글자 크기 줄이기' })).toBeDisabled()
  await expect(page.locator('.response-code')).toHaveCSS('font-size', '13.6px')
  await expect(page.getByRole('textbox', { name: '요청 URL' })).toHaveCSS('font-size', '13.6px')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('textbox', { name: '요청 URL' })).toHaveCSS('font-size', '25.5px')
  await page.getByRole('button', { name: '앱 설정', exact: true }).click()
  await page.getByRole('button', { name: '기본값 복원', exact: true }).click()
  await page.getByRole('button', { name: '설정 저장', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '요청 URL' })).toHaveCSS('font-size', '17px')
  expect(await page.evaluate(() => window.wook.loadAppearance())).toEqual(defaultAppearance)
  await page.getByRole('button', { name: '앱 정보', exact: true }).click()
  await page.screenshot({ path: 'test-results/desktop-about.png' })
  await page.getByRole('button', { name: '확인', exact: true }).click()
})
