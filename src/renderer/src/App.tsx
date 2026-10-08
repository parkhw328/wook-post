import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Database,
  FileJson2,
  Folder,
  FolderPlus,
  Globe2,
  History,
  Layers3,
  LoaderCircle,
  Plus,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Square,
  Terminal,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import type {
  AppState,
  Environment,
  ExportOptions,
  HistoryEntry,
  ImportPreview,
  RequestDraft,
  Workspace,
} from '../../shared/contracts'
import { emptyWorkspace, METHODS, newPair, newRequest } from '../../shared/models'
import { formatBytes, JsonView, Modal, PairEditor } from './components'

type Tab = { draft: RequestDraft; baseline: string; response: HistoryEntry | null }
type EditorSection = 'params' | 'headers' | 'body' | 'auth' | 'settings'
const tabFor = (draft: RequestDraft): Tab => ({
  draft,
  baseline: JSON.stringify(draft),
  response: null,
})
const blankState: AppState = { workspace: emptyWorkspace(), history: [], historyTotal: 0 }

export function App() {
  const [state, setState] = useState<AppState>(blankState)
  const [ready, setReady] = useState(false)
  const [tabs, setTabs] = useState<Tab[]>(() => [tabFor(newRequest())])
  const [activeId, setActiveId] = useState(tabs[0].draft.id)
  const [section, setSection] = useState<EditorSection>('params')
  const [sidebar, setSidebar] = useState<'collections' | 'history'>('collections')
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<string[]>([])
  const [operation, setOperation] = useState<{ id: string; tabId: string } | null>(null)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  const [modal, setModal] = useState<
    'save' | 'collection' | 'environments' | 'export' | 'about' | null
  >(null)
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null)
  const [confirm, setConfirm] = useState<{
    title: string
    text: string
    action: () => void
  } | null>(null)
  const [name, setName] = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [exportScope, setExportScope] = useState<ExportOptions['scope']>('workspace')
  const [responseSection, setResponseSection] = useState<'body' | 'headers'>('body')
  const [pretty, setPretty] = useState(true)
  const [envDrafts, setEnvDrafts] = useState<Environment[]>([])
  const [envId, setEnvId] = useState<string | null>(null)
  const [dataPath, setDataPath] = useState('')
  const operationRef = useRef(false)
  const workspaceBusy = useRef(false)
  const current = tabs.find((tab) => tab.draft.id === activeId) ?? tabs[0]
  const draft = current.draft
  const response = current.response?.response
  const isDirty = (tab: Tab) => JSON.stringify(tab.draft) !== tab.baseline
  const dirty = isDirty(current)
  const hasUnsavedChanges = tabs.some(isDirty)
  const saved = state.workspace.requests.some((request) => request.id === draft.id)
  const activeEnvironment = state.workspace.environments.find(
    (item) => item.id === state.workspace.activeEnvironmentId,
  )
  const notify = useCallback((text: string, error = false) => setMessage({ text, error }), [])
  const fail = useCallback(
    (error: unknown) =>
      notify(
        error instanceof Error
          ? error.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
          : String(error),
        true,
      ),
    [notify],
  )

  useEffect(() => {
    if (!window.wook) {
      notify('데스크톱 앱에서 열어주세요. 터미널에서 npm run dev로 시작할 수 있습니다.', true)
      return
    }
    window.wook
      .load()
      .then((data) => {
        setState(data)
        setReady(true)
      })
      .catch(fail)
    window.wook
      .info()
      .then((info) => setDataPath(info.dataPath))
      .catch(fail)
  }, [fail, notify])
  useEffect(() => {
    if (!message || message.error) return
    const timer = window.setTimeout(() => setMessage(null), 6000)
    return () => window.clearTimeout(timer)
  }, [message])
  useEffect(() => {
    if (!hasUnsavedChanges && !operation) return
    const preventClose = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preventClose)
    return () => window.removeEventListener('beforeunload', preventClose)
  }, [hasUnsavedChanges, operation])

  const updateDraft = (patch: Partial<RequestDraft>) =>
    setTabs((items) =>
      items.map((tab) =>
        tab.draft.id === activeId ? { ...tab, draft: { ...tab.draft, ...patch } } : tab,
      ),
    )
  const persist = async (workspace: Workspace): Promise<boolean> => {
    if (workspaceBusy.current) {
      notify('저장 중입니다. 잠시 후 다시 시도하세요.', true)
      return false
    }
    workspaceBusy.current = true
    setWorking(true)
    try {
      setState(await window.wook.saveWorkspace(workspace))
      return true
    } catch (error) {
      fail(error)
      return false
    } finally {
      workspaceBusy.current = false
      setWorking(false)
    }
  }
  const openRequest = (request: RequestDraft, entry?: HistoryEntry) => {
    const target = entry
      ? {
          ...request,
          id: crypto.randomUUID(),
          collectionId: state.workspace.collections.some((item) => item.id === request.collectionId)
            ? request.collectionId
            : null,
        }
      : request
    setTabs((items) =>
      items.some((tab) => tab.draft.id === target.id)
        ? items
        : [...items, { ...tabFor(structuredClone(target)), response: entry ?? null }],
    )
    setActiveId(target.id)
    setSection('params')
  }
  const addTab = () => openRequest(newRequest())
  const closeTab = (tab: Tab) => {
    const close = () => {
      const remaining = tabs.filter((item) => item.draft.id !== tab.draft.id)
      const next = remaining.length ? remaining : [tabFor(newRequest())]
      setTabs(next)
      if (activeId === tab.draft.id) setActiveId(next[next.length - 1].draft.id)
    }
    if (isDirty(tab))
      setConfirm({
        title: '요청 탭 닫기',
        text: '저장하지 않은 변경 내용이 있습니다. 탭을 닫을까요?',
        action: close,
      })
    else close()
  }
  const openSave = () => {
    setName(draft.name)
    setCollectionId(draft.collectionId ?? '')
    setModal('save')
  }
  const saveRequest = async () => {
    if (!name.trim()) return
    const next = { ...draft, name: name.trim(), collectionId: collectionId || null }
    const requests = state.workspace.requests.some((item) => item.id === draft.id)
      ? state.workspace.requests.map((item) => (item.id === draft.id ? next : item))
      : [...state.workspace.requests, next]
    if (await persist({ ...state.workspace, requests })) {
      setTabs((items) =>
        items.map((tab) =>
          tab.draft.id === next.id ? { ...tab, draft: next, baseline: JSON.stringify(next) } : tab,
        ),
      )
      setModal(null)
      notify('요청을 컬렉션에 저장했습니다.')
    }
  }
  const send = async () => {
    if (!ready || operationRef.current || !draft.url.trim()) return
    operationRef.current = true
    const id = crypto.randomUUID()
    const tabId = draft.id
    setOperation({ id, tabId })
    setMessage(null)
    try {
      const entry = await window.wook.send(draft, id)
      setTabs((items) =>
        items.map((tab) => (tab.draft.id === tabId ? { ...tab, response: entry } : tab)),
      )
      const loaded = await window.wook.load()
      setState((previous) => ({
        ...previous,
        history: loaded.history,
        historyTotal: loaded.historyTotal,
      }))
      if (entry.response.error) notify(entry.response.error, true)
    } catch (error) {
      fail(error)
    } finally {
      operationRef.current = false
      setOperation(null)
    }
  }
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (modal || importPreview || confirm || (!event.ctrlKey && !event.metaKey)) return
      if (event.key === 'Enter') {
        event.preventDefault()
        void send()
      }
      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        openSave()
      }
    }
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  })

  const importFile = async () => {
    setWorking(true)
    try {
      setImportPreview(await window.wook.previewImport())
    } catch (error) {
      fail(error)
    } finally {
      setWorking(false)
    }
  }
  const applyImport = async () => {
    if (!importPreview) return
    setWorking(true)
    try {
      setState(await window.wook.applyImport(importPreview.token))
      setImportPreview(null)
      notify('데이터를 가져왔습니다. 환경 변수는 상단에서 선택하세요.')
    } catch (error) {
      fail(error)
    } finally {
      setWorking(false)
    }
  }
  const exportData = async () => {
    setWorking(true)
    try {
      const path = await window.wook.exportData({
        scope: exportScope,
        historyId: current.response?.id,
      })
      if (path) {
        setModal(null)
        notify(`저장 완료: ${path}`)
      }
    } catch (error) {
      fail(error)
    } finally {
      setWorking(false)
    }
  }
  const showExport = (scope: ExportOptions['scope']) => {
    setExportScope(scope)
    setModal('export')
  }
  const openEnvironment = () => {
    setEnvDrafts(structuredClone(state.workspace.environments))
    setEnvId(state.workspace.activeEnvironmentId ?? state.workspace.environments[0]?.id ?? null)
    setModal('environments')
  }
  const removeRequest = (request: RequestDraft) =>
    setConfirm({
      title: '저장한 요청 삭제',
      text: `"${request.name}"을 컬렉션에서 삭제할까요? 히스토리는 유지됩니다.`,
      action: () => {
        void persist({
          ...state.workspace,
          requests: state.workspace.requests.filter((item) => item.id !== request.id),
        })
      },
    })
  const filteredRequests = state.workspace.requests.filter((item) =>
    `${item.name} ${item.url} ${item.method}`.toLowerCase().includes(search.toLowerCase()),
  )
  const filteredHistory = state.history.filter((item) =>
    `${item.name} ${item.url} ${item.method} ${item.status}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )
  const environmentDraft = envDrafts.find((item) => item.id === envId)
  const requestRow = (request: RequestDraft) => (
    <div className={`request-row ${request.id === draft.id ? 'selected' : ''}`} key={request.id}>
      <button onClick={() => openRequest(request)} title={request.url}>
        <span className={`method-label method-${request.method}`}>{request.method}</span>
        <span className="ellipsis">{request.name}</span>
      </button>
      <button
        className="icon-button row-action"
        aria-label={`${request.name} 삭제`}
        onClick={() => removeRequest(request)}
      >
        <Trash2 size={13} />
      </button>
    </div>
  )

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Zap size={21} fill="currentColor" />
          </span>
          <span>
            Wook<span className="brand-light"> Post</span>
          </span>
          <span className="alpha-label">ALPHA</span>
        </div>
        <div className="topbar-right">
          <span className="local-label">
            <span className="status-dot" />이 기기에 저장
          </span>
          <span className="topbar-divider" />
          <button className="icon-button" aria-label="앱 정보" onClick={() => setModal('about')}>
            <CircleHelp size={18} />
          </button>
          <span className="avatar">HP</span>
        </div>
      </header>
      <div className="app-body">
        <nav className="rail" aria-label="주 메뉴">
          <button
            className={`rail-button ${sidebar === 'collections' ? 'active' : ''}`}
            onClick={() => {
              setSidebar('collections')
              setSearch('')
            }}
            aria-label="컬렉션"
            title="컬렉션"
          >
            <Layers3 size={21} />
          </button>
          <button
            className={`rail-button ${sidebar === 'history' ? 'active' : ''}`}
            onClick={() => {
              setSidebar('history')
              setSearch('')
            }}
            aria-label="히스토리"
            title="히스토리"
          >
            <History size={21} />
          </button>
          <button
            className="rail-button"
            onClick={openEnvironment}
            aria-label="환경 변수 관리"
            title="환경 변수"
          >
            <Globe2 size={21} />
          </button>
          <div className="rail-spacer" />
          <button
            className="rail-button"
            onClick={() => setModal('about')}
            aria-label="설정 및 정보"
          >
            <Settings2 size={20} />
          </button>
        </nav>
        <aside className="sidebar">
          <div className="workspace-heading">
            <div className="workspace-icon">
              <Layers3 size={17} />
            </div>
            <div>
              <strong>내 워크스페이스</strong>
              <small>나만의 API 작업 공간</small>
            </div>
            <span className="local-badge">LOCAL</span>
          </div>
          <div className="transfer-actions">
            <button disabled={!ready || working} onClick={() => void importFile()}>
              <ArrowDownToLine size={14} />
              가져오기
            </button>
            <button disabled={!ready || working} onClick={() => showExport('workspace')}>
              <ArrowUpFromLine size={14} />
              내보내기
            </button>
          </div>
          <div className="search-box">
            <Search size={15} />
            <input
              aria-label="요청 검색"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={sidebar === 'history' ? '불러온 기록 검색' : '요청 검색'}
            />
            {search && (
              <button
                className="icon-button"
                onClick={() => setSearch('')}
                aria-label="검색 지우기"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div className="sidebar-section-title">
            <span>
              {sidebar === 'collections' ? '컬렉션' : '히스토리'}{' '}
              <em>
                {sidebar === 'collections' ? state.workspace.requests.length : state.historyTotal}
              </em>
            </span>
            {sidebar === 'collections' ? (
              <button
                className="icon-button"
                onClick={() => {
                  setName('')
                  setModal('collection')
                }}
                aria-label="컬렉션 추가"
              >
                <FolderPlus size={16} />
              </button>
            ) : (
              <button
                className="icon-button"
                disabled={!state.historyTotal}
                onClick={() => showExport('history')}
                aria-label="히스토리 내보내기"
              >
                <ArrowUpFromLine size={15} />
              </button>
            )}
          </div>
          <div className="sidebar-content">
            {sidebar === 'collections' ? (
              <>
                {state.workspace.collections.map((collection) => (
                  <div key={collection.id} className="collection-group">
                    <button
                      className="collection-heading"
                      onClick={() =>
                        setCollapsed((values) =>
                          values.includes(collection.id)
                            ? values.filter((id) => id !== collection.id)
                            : [...values, collection.id],
                        )
                      }
                    >
                      {collapsed.includes(collection.id) ? (
                        <ChevronRight size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                      <Folder size={15} />
                      <span className="ellipsis">{collection.name}</span>
                      <small>
                        {
                          state.workspace.requests.filter(
                            (item) => item.collectionId === collection.id,
                          ).length
                        }
                      </small>
                    </button>
                    {!collapsed.includes(collection.id) &&
                      filteredRequests
                        .filter((item) => item.collectionId === collection.id)
                        .map(requestRow)}
                  </div>
                ))}
                {filteredRequests.some((item) => !item.collectionId) && (
                  <div className="unfiled-title">분류하지 않은 요청</div>
                )}
                {filteredRequests.filter((item) => !item.collectionId).map(requestRow)}
                {!state.workspace.requests.length && (
                  <div className="sidebar-empty">
                    <Folder size={27} />
                    <strong>첫 요청을 보관해 보세요</strong>
                    <p>
                      자주 쓰는 요청을 저장하고
                      <br />
                      컬렉션으로 정리할 수 있어요.
                    </p>
                    <button className="text-button" onClick={addTab}>
                      <Plus size={13} />새 요청 만들기
                    </button>
                  </div>
                )}
                {search && !filteredRequests.length && (
                  <p className="small-empty">검색 결과가 없습니다.</p>
                )}
              </>
            ) : (
              <>
                <div className="history-date-label">최근 요청 · {state.history.length}건 표시</div>
                {filteredHistory.map((entry) => (
                  <button
                    className="history-row"
                    key={entry.id}
                    title={entry.url}
                    onClick={() => {
                      window.wook
                        .getHistory(entry.id)
                        .then((value) => {
                          if (value) openRequest(value.request, value)
                        })
                        .catch(fail)
                    }}
                  >
                    <div>
                      <span className={`method-label method-${entry.method}`}>{entry.method}</span>
                      <span
                        className={`history-status ${entry.error || (entry.status ?? 0) >= 400 ? 'bad' : ''}`}
                      >
                        {entry.error ? 'ERR' : entry.status}
                      </span>
                      <time>
                        {new Date(entry.startedAt).toLocaleString('ko-KR', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                    <strong className="ellipsis">{entry.name}</strong>
                    <small className="ellipsis">{entry.url}</small>
                  </button>
                ))}
                {!state.historyTotal && (
                  <div className="sidebar-empty">
                    <Clock3 size={27} />
                    <strong>요청의 흐름을 한눈에</strong>
                    <p>
                      전송한 요청과 응답이
                      <br />
                      여기에 자동으로 저장됩니다.
                    </p>
                  </div>
                )}
                {state.history.length < state.historyTotal && (
                  <button
                    className="load-more"
                    onClick={() => {
                      window.wook
                        .listHistory(state.history.length)
                        .then((entries) =>
                          setState((value) => ({
                            ...value,
                            history: [...value.history, ...entries],
                          })),
                        )
                        .catch(fail)
                    }}
                  >
                    이전 기록 더 보기
                  </button>
                )}
                {!!state.historyTotal && (
                  <button
                    className="clear-history"
                    onClick={() => {
                      window.wook.clearHistory().then(setState).catch(fail)
                    }}
                  >
                    <Trash2 size={12} />
                    히스토리 전체 삭제
                  </button>
                )}
              </>
            )}
          </div>
          <div className="sidebar-footer">
            <ShieldCheck size={15} />
            <div>
              <strong>로그인 없이, 로컬에서</strong>
              <span>요청은 지정한 서버로만 전송됩니다.</span>
            </div>
          </div>
        </aside>
        <main className="main-panel">
          <div className="request-tabs" role="tablist" aria-label="열린 요청">
            <div className="tabs-scroll">
              {tabs.map((tab) => (
                <div
                  className={`request-tab ${tab.draft.id === activeId ? 'active' : ''}`}
                  key={tab.draft.id}
                >
                  <button
                    role="tab"
                    aria-selected={tab.draft.id === activeId}
                    onClick={() => setActiveId(tab.draft.id)}
                  >
                    <span className={`method-label method-${tab.draft.method}`}>
                      {tab.draft.method}
                    </span>
                    <span className="ellipsis">{tab.draft.name}</span>
                    {isDirty(tab) && <span className="dirty-dot" title="저장하지 않은 변경" />}
                  </button>
                  <button
                    className="icon-button"
                    disabled={operation?.tabId === tab.draft.id}
                    onClick={() => closeTab(tab)}
                    aria-label={`${tab.draft.name} 탭 닫기`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <button className="icon-button add-tab" aria-label="새 요청" onClick={addTab}>
              <Plus size={17} />
            </button>
            <div className="environment-select">
              <Globe2 size={14} />
              <select
                aria-label="활성 환경"
                disabled={!ready || working}
                value={state.workspace.activeEnvironmentId ?? ''}
                onChange={(event) => {
                  void persist({
                    ...state.workspace,
                    activeEnvironmentId: event.target.value || null,
                  })
                }}
              >
                <option value="">환경 선택 안 함</option>
                {state.workspace.environments.map((environment) => (
                  <option key={environment.id} value={environment.id}>
                    {environment.name}
                  </option>
                ))}
              </select>
              <button className="icon-button" onClick={openEnvironment} aria-label="환경 편집">
                <Settings2 size={14} />
              </button>
            </div>
          </div>
          <div className="request-editor">
            <div className="request-titlebar">
              <div className="request-breadcrumb">
                <Folder size={14} />
                <span>
                  {state.workspace.collections.find((item) => item.id === draft.collectionId)
                    ?.name ?? '내 워크스페이스'}
                </span>
                <ChevronRight size={12} />
                <strong>{draft.name}</strong>
                {dirty && <span className="unsaved-label">변경됨</span>}
              </div>
              <button className="save-button" disabled={!ready || working} onClick={openSave}>
                <Save size={14} />
                {saved ? '저장' : '요청 저장'}
                <kbd>Ctrl S</kbd>
              </button>
            </div>
            <form
              className="url-bar"
              onSubmit={(event) => {
                event.preventDefault()
                void send()
              }}
            >
              <div className="url-input-group">
                <select
                  className={`method-select method-${draft.method}`}
                  aria-label="HTTP 메서드"
                  value={draft.method}
                  onChange={(event) =>
                    updateDraft({ method: event.target.value as RequestDraft['method'] })
                  }
                >
                  {METHODS.map((method) => (
                    <option key={method}>{method}</option>
                  ))}
                </select>
                <span className="url-divider" />
                <input
                  aria-label="요청 URL"
                  placeholder="https://api.example.com/v1/users"
                  value={draft.url}
                  onChange={(event) => updateDraft({ url: event.target.value })}
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
              {operation ? (
                <button
                  className="send-button cancel"
                  type="button"
                  onClick={() => {
                    window.wook.cancel(operation.id).catch(fail)
                  }}
                >
                  <Square size={15} fill="currentColor" />
                  취소
                </button>
              ) : (
                <button
                  className="send-button"
                  type="submit"
                  disabled={!ready || !draft.url.trim()}
                >
                  <Send size={15} />
                  전송<kbd>↵</kbd>
                </button>
              )}
            </form>
            <div className="editor-tabs" role="tablist" aria-label="요청 설정">
              {(
                [
                  [
                    'params',
                    '파라미터',
                    draft.params.filter((item) => item.enabled && item.key).length,
                  ],
                  [
                    'headers',
                    '헤더',
                    draft.headers.filter((item) => item.enabled && item.key).length,
                  ],
                  ['body', '본문', draft.bodyMode !== 'none' ? '•' : null],
                  ['auth', '인증', draft.auth.type !== 'none' ? '•' : null],
                  ['settings', '설정', null],
                ] as const
              ).map(([id, title, count]) => (
                <button
                  role="tab"
                  aria-selected={section === id}
                  key={id}
                  className={section === id ? 'active' : ''}
                  onClick={() => setSection(id)}
                >
                  {title}
                  {!!count && <span>{count}</span>}
                </button>
              ))}
              <div className="editor-tabs-spacer" />
              <span className="variables-hint">
                {'{{변수}}'}
                <span> 환경 변수 사용</span>
              </span>
            </div>
            <div className="editor-content">
              {section === 'params' && (
                <>
                  <PairEditor
                    label="파라미터"
                    pairs={draft.params}
                    onChange={(params) => updateDraft({ params })}
                    keyPlaceholder="파라미터 이름"
                    valuePlaceholder="값 또는 {{변수}}"
                  />
                  <p className="editor-note">
                    활성화한 파라미터를 URL의 기존 쿼리 뒤에 추가합니다.
                  </p>
                </>
              )}
              {section === 'headers' && (
                <>
                  <PairEditor
                    label="헤더"
                    pairs={draft.headers}
                    onChange={(headers) => updateDraft({ headers })}
                    keyPlaceholder="Content-Type"
                    valuePlaceholder="application/json"
                  />
                  <p className="editor-note">
                    Content-Type은 본문 유형에 맞게 자동 설정됩니다. 직접 입력한 값이 우선합니다.
                  </p>
                </>
              )}
              {section === 'body' && (
                <>
                  <div className="body-controls">
                    {(
                      [
                        ['none', '없음'],
                        ['json', 'JSON'],
                        ['text', 'Text'],
                        ['form', 'Form URL Encoded'],
                      ] as const
                    ).map(([mode, label]) => (
                      <label key={mode}>
                        <input
                          type="radio"
                          name="body-mode"
                          value={mode}
                          checked={draft.bodyMode === mode}
                          onChange={() => updateDraft({ bodyMode: mode })}
                        />
                        {label}
                      </label>
                    ))}
                    {draft.bodyMode === 'json' && (
                      <button
                        className="text-button"
                        onClick={() => {
                          try {
                            updateDraft({ body: JSON.stringify(JSON.parse(draft.body), null, 2) })
                          } catch {
                            notify('JSON 형식을 확인하세요. 환경 변수는 전송 시 치환됩니다.', true)
                          }
                        }}
                      >
                        JSON 정렬
                      </button>
                    )}
                  </div>
                  {draft.bodyMode === 'none' ? (
                    <div className="inline-empty">
                      <FileJson2 size={23} />
                      <span>이 요청은 본문을 보내지 않습니다.</span>
                    </div>
                  ) : draft.bodyMode === 'form' ? (
                    <PairEditor
                      label="폼 필드"
                      pairs={draft.form}
                      onChange={(form) => updateDraft({ form })}
                    />
                  ) : (
                    <textarea
                      className="body-editor"
                      aria-label="요청 본문"
                      spellCheck={false}
                      placeholder={
                        draft.bodyMode === 'json'
                          ? '{\n  "message": "Hello, Wook Post!"\n}'
                          : '보낼 내용을 입력하세요.'
                      }
                      value={draft.body}
                      onChange={(event) => updateDraft({ body: event.target.value })}
                    />
                  )}
                </>
              )}
              {section === 'auth' && (
                <div className="auth-panel">
                  <div>
                    <label className="field-label" htmlFor="auth-type">
                      인증 방식
                    </label>
                    <select
                      id="auth-type"
                      value={draft.auth.type}
                      onChange={(event) =>
                        updateDraft({
                          auth: {
                            ...draft.auth,
                            type: event.target.value as RequestDraft['auth']['type'],
                          },
                        })
                      }
                    >
                      <option value="none">인증 없음</option>
                      <option value="bearer">Bearer Token</option>
                      <option value="basic">Basic Auth</option>
                    </select>
                    <p className="editor-note">인증 값은 전송 시 헤더에 적용됩니다.</p>
                  </div>
                  <div>
                    {draft.auth.type === 'none' ? (
                      <p className="muted">인증이 필요한 API라면 방식을 선택하세요.</p>
                    ) : draft.auth.type === 'bearer' ? (
                      <label className="field-label">
                        토큰
                        <input
                          className="field-input"
                          type="password"
                          autoComplete="off"
                          value={draft.auth.token}
                          onChange={(event) =>
                            updateDraft({ auth: { ...draft.auth, token: event.target.value } })
                          }
                          placeholder="토큰 또는 {{token}}"
                        />
                      </label>
                    ) : (
                      <>
                        <label className="field-label">
                          사용자 이름
                          <input
                            className="field-input"
                            value={draft.auth.username}
                            onChange={(event) =>
                              updateDraft({ auth: { ...draft.auth, username: event.target.value } })
                            }
                          />
                        </label>
                        <label className="field-label">
                          비밀번호
                          <input
                            className="field-input"
                            type="password"
                            autoComplete="off"
                            value={draft.auth.password}
                            onChange={(event) =>
                              updateDraft({ auth: { ...draft.auth, password: event.target.value } })
                            }
                          />
                        </label>
                      </>
                    )}
                  </div>
                </div>
              )}
              {section === 'settings' && (
                <div className="request-settings">
                  <label className="field-label">
                    요청 제한 시간 (ms)
                    <input
                      className="field-input"
                      type="number"
                      min={100}
                      max={120000}
                      value={draft.timeoutMs}
                      onChange={(event) => updateDraft({ timeoutMs: Number(event.target.value) })}
                    />
                    <small>100 ~ 120,000 ms · 기본 30초</small>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={draft.followRedirects}
                      onChange={(event) => updateDraft({ followRedirects: event.target.checked })}
                    />
                    리다이렉트 따라가기
                  </label>
                  <p className="editor-note">
                    서버 인증서를 검증합니다. 응답은 최대 5 MiB까지 수신합니다.
                  </p>
                </div>
              )}
            </div>
          </div>
          <section className="response-panel" aria-label="응답">
            <div className="response-heading">
              <div className="response-title">
                응답
                {response && (
                  <span
                    className={`response-status ${response.error || (response.status ?? 0) >= 400 ? 'bad' : ''}`}
                  >
                    <span className="status-dot" />
                    {response.error ? '오류' : `${response.status} ${response.statusText}`}
                  </span>
                )}
              </div>
              <div className="response-meta">
                {response && (
                  <>
                    <span>
                      <Clock3 size={12} />
                      {response.durationMs} ms
                    </span>
                    <span>
                      <Database size={12} />
                      {formatBytes(response.sizeBytes)}
                    </span>
                    <button className="text-button" onClick={() => showExport('response')}>
                      <ArrowUpFromLine size={13} />
                      응답 내보내기
                    </button>
                  </>
                )}
                {!response && <span>요청 결과가 여기에 표시됩니다</span>}
              </div>
            </div>
            {operation?.tabId === activeId ? (
              <div className="response-empty">
                <LoaderCircle className="spin" size={32} />
                <h2>응답을 기다리고 있어요</h2>
                <p>요청은 완료 후 히스토리에 자동 저장됩니다.</p>
              </div>
            ) : !response ? (
              <div className="response-empty">
                <div className="empty-art">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="empty-icon">
                    <Terminal size={35} strokeWidth={1.4} />
                  </div>
                  <span className="art-dot" />
                </div>
                <span className="eyebrow">YOUR NEXT REQUEST STARTS HERE</span>
                <h1>API와 대화를 시작하세요.</h1>
                <p>
                  URL을 입력하고 전송하면 응답을 바로 확인할 수 있어요.
                  <br />
                  모든 요청 기록은 이 기기에 남습니다.
                </p>
                <button
                  className="demo-button"
                  onClick={() => {
                    updateDraft({ url: 'http://127.0.0.1:4545/echo', name: '로컬 서버 테스트' })
                    notify('별도 터미널에서 npm run demo:server를 실행한 후 전송하세요.')
                  }}
                >
                  로컬 테스트 URL 입력
                  <ArrowUpRight size={14} />
                </button>
                <div className="keyboard-hint">
                  <kbd>Ctrl</kbd>
                  <span>+</span>
                  <kbd>Enter</kbd>
                  <span>요청 전송</span>
                </div>
              </div>
            ) : (
              <>
                {response.error && <div className="response-warning error">{response.error}</div>}
                {response.truncated && (
                  <div className="response-warning">
                    응답 크기 제한 또는 통신 중단으로 일부만 저장되었습니다. 내보내기에도 수신한
                    부분만 포함됩니다.
                  </div>
                )}
                <div className="response-toolbar">
                  <div role="tablist" aria-label="응답 보기">
                    <button
                      role="tab"
                      aria-selected={responseSection === 'body'}
                      className={responseSection === 'body' ? 'active' : ''}
                      onClick={() => setResponseSection('body')}
                    >
                      본문
                    </button>
                    <button
                      role="tab"
                      aria-selected={responseSection === 'headers'}
                      className={responseSection === 'headers' ? 'active' : ''}
                      onClick={() => setResponseSection('headers')}
                    >
                      헤더 <span>{response.headers.length}</span>
                    </button>
                  </div>
                  <div className="response-tools">
                    {responseSection === 'body' && response.encoding === 'text' && (
                      <>
                        <button className={pretty ? 'active' : ''} onClick={() => setPretty(true)}>
                          Pretty
                        </button>
                        <button
                          className={!pretty ? 'active' : ''}
                          onClick={() => setPretty(false)}
                        >
                          Raw
                        </button>
                        <span className="tool-divider" />
                        <button
                          aria-label="응답 복사"
                          title="응답 복사"
                          onClick={() => {
                            navigator.clipboard
                              .writeText(response.bodyText)
                              .then(() => notify('응답 본문을 복사했습니다.'))
                              .catch(fail)
                          }}
                        >
                          <Copy size={14} />
                        </button>
                      </>
                    )}
                    <button
                      aria-label="응답 본문 파일 저장"
                      title="응답 본문 파일 저장"
                      onClick={() => showExport('body')}
                    >
                      <ArrowDownToLine size={14} />
                    </button>
                  </div>
                </div>
                <div className="response-content">
                  {responseSection === 'headers' ? (
                    <table className="response-headers">
                      <thead>
                        <tr>
                          <th>KEY</th>
                          <th>VALUE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {response.headers.map((header, index) => (
                          <tr key={index}>
                            <td>{header.key}</td>
                            <td>{header.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : response.encoding === 'base64' ? (
                    <div className="binary-response">
                      <FileJson2 size={32} />
                      <h3>바이너리 응답</h3>
                      <p>원본 바이트를 파일로 저장할 수 있습니다.</p>
                      <button className="secondary-button" onClick={() => showExport('body')}>
                        본문 파일 저장
                      </button>
                    </div>
                  ) : response.bodyText ? (
                    <JsonView text={response.bodyText} pretty={pretty} />
                  ) : (
                    <p className="small-empty">응답 본문이 없습니다.</p>
                  )}
                </div>
              </>
            )}
          </section>
        </main>
      </div>
      <footer className="statusbar">
        <span>
          <span className="status-dot" />
          {operation ? '요청 전송 중' : ready ? '준비됨' : '앱 연결 확인 중'}
        </span>
        <span>{activeEnvironment?.name ?? '환경 선택 안 함'}</span>
        <span className="statusbar-spacer" />
        <span>
          <Database size={11} />
          로컬 저장소
        </span>
        <span>v{__APP_VERSION__}</span>
      </footer>
      {message && (
        <div
          className={`toast ${message.error ? 'error' : ''}`}
          role={message.error ? 'alert' : 'status'}
        >
          <span>{message.error ? <CircleHelp size={17} /> : <Check size={17} />}</span>
          <p>{message.text}</p>
          <button className="icon-button" onClick={() => setMessage(null)} aria-label="알림 닫기">
            <X size={15} />
          </button>
        </div>
      )}

      {(modal === 'save' || modal === 'collection') && (
        <Modal title={modal === 'save' ? '요청 저장' : '새 컬렉션'} onClose={() => setModal(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (modal === 'save') void saveRequest()
              else if (name.trim())
                void persist({
                  ...state.workspace,
                  collections: [
                    ...state.workspace.collections,
                    { id: crypto.randomUUID(), name: name.trim() },
                  ],
                }).then((ok) => {
                  if (ok) setModal(null)
                })
            }}
          >
            <label className="field-label">
              이름
              <input
                autoFocus
                className="field-input"
                aria-label="저장 이름"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={200}
                required
              />
            </label>
            {modal === 'save' && (
              <label className="field-label">
                컬렉션
                <select
                  className="field-input"
                  aria-label="저장할 컬렉션"
                  value={collectionId}
                  onChange={(event) => setCollectionId(event.target.value)}
                >
                  <option value="">분류하지 않음</option>
                  {state.workspace.collections.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setModal(null)}>
                취소
              </button>
              <button className="primary-button" disabled={working || !name.trim()} type="submit">
                저장
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === 'environments' && (
        <Modal title="환경 변수" onClose={() => setModal(null)} wide>
          <p className="modal-description">
            URL, 헤더, 본문, 인증에 {'{{baseUrl}}'}처럼 사용할 수 있습니다. 값은 로컬에 평문으로
            저장됩니다.
          </p>
          <div className="environment-manager">
            <div className="environment-list">
              {envDrafts.map((environment) => (
                <button
                  className={envId === environment.id ? 'active' : ''}
                  key={environment.id}
                  onClick={() => setEnvId(environment.id)}
                >
                  <Globe2 size={14} />
                  <span className="ellipsis">{environment.name}</span>
                </button>
              ))}
              <button
                onClick={() => {
                  const environment = {
                    id: crypto.randomUUID(),
                    name: '새 환경',
                    values: [newPair('baseUrl', 'http://127.0.0.1:4545')],
                  }
                  setEnvDrafts([...envDrafts, environment])
                  setEnvId(environment.id)
                }}
              >
                <Plus size={14} />
                환경 추가
              </button>
            </div>
            <div className="environment-detail">
              {environmentDraft ? (
                <>
                  <div className="environment-name">
                    <input
                      className="field-input"
                      aria-label="환경 이름"
                      value={environmentDraft.name}
                      onChange={(event) =>
                        setEnvDrafts((items) =>
                          items.map((item) =>
                            item.id === envId ? { ...item, name: event.target.value } : item,
                          ),
                        )
                      }
                      maxLength={200}
                    />
                    <button
                      className="icon-button"
                      aria-label="선택한 환경 삭제"
                      onClick={() => {
                        setEnvDrafts((items) => items.filter((item) => item.id !== envId))
                        setEnvId(null)
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <PairEditor
                    label="변수"
                    pairs={environmentDraft.values}
                    onChange={(values) =>
                      setEnvDrafts((items) =>
                        items.map((item) => (item.id === envId ? { ...item, values } : item)),
                      )
                    }
                    keyPlaceholder="baseUrl"
                  />
                </>
              ) : (
                <p className="small-empty">환경을 추가하거나 선택하세요.</p>
              )}
            </div>
          </div>
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => setModal(null)}>
              취소
            </button>
            <button
              className="primary-button"
              disabled={working || envDrafts.some((item) => !item.name.trim())}
              onClick={() => {
                void persist({
                  ...state.workspace,
                  environments: envDrafts,
                  activeEnvironmentId:
                    state.workspace.activeEnvironmentId &&
                    envDrafts.some((item) => item.id === state.workspace.activeEnvironmentId)
                      ? state.workspace.activeEnvironmentId
                      : null,
                }).then((ok) => {
                  if (ok) {
                    setModal(null)
                    notify('환경을 저장했습니다. 상단에서 사용할 환경을 선택하세요.')
                  }
                })
              }}
            >
              환경 저장
            </button>
          </div>
        </Modal>
      )}
      {modal === 'export' && (
        <Modal title="데이터 내보내기" onClose={() => setModal(null)}>
          <p className="modal-description">
            필요한 범위를 선택해 파일로 보관하거나 다른 기기로 옮기세요.
          </p>
          <div className="export-options">
            {[
              ['workspace', '전체 백업', '컬렉션, 환경 변수, 모든 히스토리와 응답'],
              ['history', '히스토리', '전송한 요청과 응답 기록'],
              ['postman', 'Postman Collection v2.1', '저장한 요청과 현재 선택한 환경의 변수'],
              ...(current.response
                ? [
                    ['response', '선택한 응답 백업', '요청·응답·측정값을 JSON으로 저장'],
                    ['body', '응답 본문 파일', '수신한 본문 바이트를 그대로 저장'],
                  ]
                : []),
            ].map(([value, title, detail]) => (
              <label key={value} className={exportScope === value ? 'selected' : ''}>
                <input
                  type="radio"
                  name="export-scope"
                  value={value}
                  checked={exportScope === value}
                  onChange={() => setExportScope(value as ExportOptions['scope'])}
                />
                <div>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </div>
              </label>
            ))}
          </div>
          <p className="export-notice">
            토큰, 비밀번호, 쿠키, 응답 데이터가 포함될 수 있습니다. 신뢰하는 곳에 보관하세요.
            {exportScope === 'postman' &&
              ' Postman 파일에는 히스토리와 Wook Post의 시간 제한·리다이렉트 설정이 포함되지 않습니다.'}
            {(exportScope === 'body' || exportScope === 'response') &&
              response?.truncated &&
              ' 선택한 응답은 일부만 수신했습니다.'}
          </p>
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => setModal(null)}>
              취소
            </button>
            <button className="primary-button" disabled={working} onClick={() => void exportData()}>
              <ArrowUpFromLine size={15} />
              파일 저장
            </button>
          </div>
        </Modal>
      )}
      {importPreview && (
        <Modal title="가져오기 미리보기" onClose={() => setImportPreview(null)}>
          <p className="import-filename">
            <FileJson2 size={19} />
            {importPreview.fileName}
          </p>
          <p className="modal-description">
            {importPreview.format} · 기존 데이터를 유지하면서 추가합니다.
          </p>
          <div className="import-counts">
            <div>
              <strong>{importPreview.requests}</strong>
              <span>요청</span>
            </div>
            <div>
              <strong>{importPreview.history}</strong>
              <span>히스토리</span>
            </div>
            <div>
              <strong>{importPreview.environments}</strong>
              <span>환경</span>
            </div>
          </div>
          {importPreview.warnings.map((warning) => (
            <p className="export-notice" key={warning}>
              {warning}
            </p>
          ))}
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => setImportPreview(null)}>
              취소
            </button>
            <button
              className="primary-button"
              disabled={working}
              onClick={() => void applyImport()}
            >
              가져오기 적용
            </button>
          </div>
        </Modal>
      )}
      {modal === 'about' && (
        <Modal title="Wook Post" onClose={() => setModal(null)}>
          <div className="about-brand">
            <div className="brand-mark">
              <Zap size={25} fill="currentColor" />
            </div>
            <div>
              <h3>API 작업을, 내 손안에.</h3>
              <p>v{__APP_VERSION__} · Windows x64</p>
            </div>
          </div>
          <dl className="about-info">
            <dt>제작자</dt>
            <dd>
              Hyunwook Park
              <br />
              parkhw328@gmail.com
            </dd>
            <dt>데이터 위치</dt>
            <dd>{dataPath || '확인 중'}</dd>
            <dt>키보드 단축키</dt>
            <dd>
              Ctrl + Enter · 전송
              <br />
              Ctrl + S · 요청 저장
            </dd>
          </dl>
          <p className="export-notice">
            초기 알파 버전입니다. 데이터는 로컬 SQLite에 평문으로 저장됩니다. 백업으로 중요한 요청을
            보관하세요.
          </p>
          <div className="modal-actions">
            <button className="primary-button" onClick={() => setModal(null)}>
              확인
            </button>
          </div>
        </Modal>
      )}
      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)}>
          <p className="modal-description">{confirm.text}</p>
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => setConfirm(null)}>
              취소
            </button>
            <button
              className="danger-button"
              onClick={() => {
                confirm.action()
                setConfirm(null)
              }}
            >
              계속
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
