import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import {
  Activity, Archive, ArrowDown, ArrowUp, BookOpen, Boxes, Cable, Check, ChevronDown,
  CircleAlert, Clipboard, Cloud, Code2, Database, Download, FileJson, GitBranch,
  HardDrive, LayoutDashboard, LockKeyhole, LogOut, Menu, Plus, Search, Settings2,
  ShieldAlert, Trash2, Upload, X,
} from 'lucide-react'
import type { EasyStockPrivateData, RoadmapLane } from '../types/easystock'
import { clearPrivateData, exportPrivateJson, loadPrivateData, readPrivateJsonFile, savePrivateData } from '../lib/storage'
import { getFirebaseAuth, getSavedFirebaseConfig, logout, saveFirebaseConfig, signInWithGoogle, type FirebaseWebConfig } from '../lib/firebase'
import { searchPrivateData } from '../lib/search'
import { removeAt, reorder, replaceAt } from '../lib/data-actions'

const ALLOWED_EMAIL = 'jimmyeyes0316@gmail.com'
export const canAccessPrivateData = (email?: string | null) => email?.toLowerCase() === ALLOWED_EMAIL
export function canRenderPrivateContent(email: string | null | undefined, data: EasyStockPrivateData | null | undefined): data is EasyStockPrivateData {
  return canAccessPrivateData(email) && data !== null && data !== undefined
}

const navigation = [
  { label: 'Dashboard', key: 'dashboard', icon: LayoutDashboard },
  { label: 'Infrastructure', key: 'infrastructure', icon: Boxes },
  { label: 'Connection Guide', key: 'connections', icon: Cable },
  { label: 'EasyStock Architecture', key: 'architecture', icon: GitBranch },
  { label: 'Data Sources', key: 'apis', icon: Database },
  { label: 'Intraday AI', key: 'intraday', icon: Activity },
  { label: 'Rebound AI', key: 'reboundAI', icon: Activity },
  { label: 'Historical Learning', key: 'historicalLearning', icon: BookOpen },
  { label: 'Research Governance', key: 'research', icon: ShieldAlert },
  { label: 'Paper Trading', key: 'paperTrading', icon: FileJson },
  { label: 'Market Risk', key: 'marketRisk', icon: CircleAlert },
  { label: 'Chrome Extension', key: 'chromeExtension', icon: Boxes },
  { label: 'NAS AI Environment', key: 'docker', icon: HardDrive },
  { label: 'Backup', key: 'backup', icon: Archive },
  { label: 'Current Work', key: 'currentWork', icon: Check },
  { label: 'Roadmap', key: 'roadmap', icon: GitBranch },
  { label: 'Commands', key: 'commands', icon: Code2 },
  { label: 'Change Log', key: 'changelog', icon: Clipboard },
  { label: 'Notes', key: 'notes', icon: BookOpen },
]

const titles: Record<string, string> = Object.fromEntries(navigation.map(({ key, label }) => [key, label]))
const detailText: Record<string, string> = {
  infrastructure: '私人基礎設施拓樸。所有節點及說明均由匯入的私人 JSON 提供。',
  connections: '連線資訊僅保存在此瀏覽器；不要填入密碼、token 或私鑰。',
  architecture: '系統資料流與元件說明，Production 與 Research 狀態分開標示。',
  apis: '明確區分行情、交易與研究能力；支援行情不代表可進行交易。',
  intraday: '當沖 AI 的流程、驗證、問題與研究發現。',
  reboundAI: 'Rebound AI 研究資料流；候選研究模型不得視為正式模型。',
  historicalLearning: '歷史資料覆蓋率、重建、IS/OOS 與穩健性檢查。',
  research: '研究模型升級治理流程與准入狀態。',
  paperTrading: '模擬交易額度、損益、帳務規則與問題追蹤。',
  marketRisk: 'Market Risk 架構、因素、veto 與驗證紀錄。',
  chromeExtension: 'Chrome Extension 版本、問題與後續規劃。',
  docker: 'NAS AI 工作環境的描述性資訊；網站不會連線查詢 NAS。',
  backup: '備份來源、目的地、排程、保留政策與還原指引。',
  currentWork: 'DOING、NEXT、BACKLOG、BLOCKED、DONE 工作項目。',
  roadmap: '拖曳卡片至不同欄位即可調整 roadmap 狀態。',
  commands: '私人指令庫。執行危險命令前請先確認目標與備份。',
  changelog: '依日期整理的維運與產品變更歷史。',
  notes: '私人知識筆記。',
}

const workflowText: Record<string, string[]> = {
  intraday: ['Premarket', 'Market Risk', 'Universe', 'Features', 'Model', 'Risk Gate', 'Candidate', 'Paper', 'Evaluation', 'Research'],
  reboundAI: ['Candidate Collection', 'PASSED / PENDING / NEAR_MISS / REJECTED_CONTROL', 'Feature Dataset', 'Outcome Label', 'Training Dataset', 'Candidate Model', 'Research Validation', 'Future Promotion'],
  research: ['Data', 'Dataset Version', 'Train', 'Validation', 'IS', 'OOS', 'Walk Forward', 'Robustness', 'Paper', 'Real Market Validation', 'Promotion Decision'],
}

type AuthState = 'checking' | 'setup' | 'signed-out' | 'denied' | 'loading-data' | 'needs-import' | 'ready' | 'error'

export default function App() {
  const [authState, setAuthState] = useState<AuthState>(getSavedFirebaseConfig() ? 'checking' : 'setup')
  const [user, setUser] = useState<User | null>(null)
  const [data, setData] = useState<EasyStockPrivateData | null>(null)
  const [active, setActive] = useState('dashboard')
  const [editMode, setEditMode] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const deniedRef = useRef(false)

  useEffect(() => {
    if (!getSavedFirebaseConfig()) { setAuthState('setup'); return }
    let alive = true
    try {
      const auth = getFirebaseAuth()
      const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
        if (!alive) return
        setUser(nextUser)
        setError('')
        if (!nextUser) { setData(null); setAuthState(deniedRef.current ? 'denied' : 'signed-out'); return }
        if (!canAccessPrivateData(nextUser.email)) {
          setData(null)
          deniedRef.current = true
          setAuthState('denied')
          await logout()
          return
        }
        deniedRef.current = false
        setAuthState('loading-data')
        try {
          const saved = await loadPrivateData()
          if (!alive) return
          setData(saved ?? null)
          setAuthState(saved ? 'ready' : 'needs-import')
        } catch (cause) {
          if (!alive) return
          setError(cause instanceof Error ? cause.message : '無法讀取本機資料')
          setAuthState('error')
        }
      })
      return () => { alive = false; unsubscribe() }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Firebase 設定無效')
      setAuthState('setup')
    }
  }, [authState === 'setup' ? 'setup' : 'configured'])

  const results = useMemo(() => data ? searchPrivateData(data, query).slice(0, 12) : [], [data, query])

  const onLogin = async () => {
    setError('')
    try { await signInWithGoogle() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Google 登入失敗') }
  }

  const onImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const imported = await readPrivateJsonFile(file)
      await savePrivateData(imported)
      setData(imported); setDirty(false); setError(''); setNotice('私人資料已匯入並儲存至此瀏覽器的 IndexedDB。'); setAuthState('ready')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '匯入失敗') }
  }

  const exportData = () => {
    if (!data) return
    const blob = new Blob([exportPrivateJson(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'private-data.json'; anchor.click()
    URL.revokeObjectURL(url)
    setNotice('JSON 備份已匯出至你的裝置。')
  }

  const updateData = (next: EasyStockPrivateData) => { setData({ ...next, meta: { ...next.meta, updatedAt: new Date().toISOString() } }); setDirty(true); setNotice('') }
  const saveLocal = async () => {
    if (!data) return
    try { await savePrivateData(data); setDirty(false); setNotice('已儲存至本機 IndexedDB。') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '儲存失敗') }
  }

  if (authState === 'setup' || authState === 'signed-out' || authState === 'checking') {
    return <LoginScreen error={error} onLogin={onLogin} onConfigured={() => { setError(''); setAuthState('checking') }} />
  }
  if (authState === 'denied') return <AccessDenied onBack={() => { deniedRef.current = false; setAuthState('signed-out') }} />
  if (authState === 'loading-data') return <CenteredMessage label="正在檢查本機 IndexedDB…" />
  if (authState === 'needs-import' || authState === 'error') return <ImportGate error={error} fileInput={fileInput} onImport={onImportFile} onLogout={async () => { await logout(); setAuthState('signed-out') }} />
  if (!canRenderPrivateContent(user?.email, data)) return <CenteredMessage label="尚未載入私人 EasyStock 資料" />

  const changePage = (page: string) => { setActive(page); setQuery(''); setMobileNav(false) }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Activity size={19} /></div><div><strong>EasyStock Ops</strong><span>KNOWLEDGE CENTER</span></div><button className="icon-btn mobile-close" aria-label="關閉導覽" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
      <div className="workspace"><span className="live-dot" /> PRIVATE WORKSPACE <ChevronDown size={13} /></div>
      <nav aria-label="主導覽">
        {navigation.map(({ label, key, icon: Icon }) => <button key={key} className={`nav-item ${active === key ? 'active' : ''}`} onClick={() => changePage(key)}><Icon size={16} /><span>{label}</span>{key === 'currentWork' && <span className="nav-count">{data.currentWork.filter((item) => item.status === 'DOING').length || ''}</span>}</button>)}
      </nav>
      <div className="sidebar-footer"><div className="secure-label"><LockKeyhole size={14} /><span>Local-only private data</span></div><div className="version-label">OPS CENTER <span>v0.1</span></div></div>
    </aside>
    {mobileNav && <button className="nav-backdrop" aria-label="關閉選單" onClick={() => setMobileNav(false)} />}
    <main className="main-shell">
      <header className="topbar">
        <button className="icon-btn hamburger" aria-label="開啟導覽" onClick={() => setMobileNav(true)}><Menu size={19} /></button>
        <div className="breadcrumb"><span>EasyStock Ops</span><span className="crumb-slash">/</span><strong>{titles[active] || active}</strong></div>
        <div className="top-actions">
          <div className="search-wrap"><Search size={16} /><input aria-label="全站搜尋" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋私人知識…" /><kbd>⌘ K</kbd>
            {query.trim() && <div className="search-results">{results.length ? results.map((result, index) => <button key={`${result.section}-${index}`} onClick={() => changePage(sectionPage(result.section))}><span>{result.title}</span><small>{titles[result.section] || result.section} · {result.excerpt}</small></button>) : <div className="empty-search">沒有符合的內容</div>}</div>}
          </div>
          <span className="user-chip"><span className="avatar">{(user?.displayName || 'J').slice(0, 1).toUpperCase()}</span><span className="user-name">{user?.displayName || user?.email}</span></span>
          <button className={`button button-small ${editMode ? 'button-edit-on' : 'button-quiet'}`} onClick={() => setEditMode(!editMode)}><Settings2 size={14} />{editMode ? '閱讀模式' : '編輯模式'}</button>
          <button className="button button-small button-quiet export-btn" onClick={exportData}><Download size={14} /><span>Export</span></button>
          <button className="button button-small button-quiet import-btn" onClick={() => fileInput.current?.click()}><Upload size={14} /><span>Import</span></button>
          <button className="icon-btn logout-btn" aria-label="清除本機資料" title="清除 IndexedDB 私人資料" onClick={async () => { if (window.confirm('確定清除這個瀏覽器的 EasyStock 私人資料？請先匯出備份。')) { await clearPrivateData(); setData(null); setDirty(false); setAuthState('needs-import'); setNotice('本機私人資料已清除。') } }}><Trash2 size={15} /></button>
          <button className="icon-btn logout-btn" aria-label="登出" title="Google 登出" onClick={async () => { await logout(); setData(null); setAuthState('signed-out') }}><LogOut size={16} /></button>
        </div>
      </header>
      <input ref={fileInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={onImportFile} />
      <div className="content-area">
        {(error || notice) && <div className={`toast ${error ? 'toast-error' : ''}`} role="status"><span>{error || notice}</span><button onClick={() => { setError(''); setNotice('') }} aria-label="關閉通知"><X size={15} /></button></div>}
        {dirty && <div className="unsaved-banner"><span><span className="unsaved-dot" />有尚未儲存的本機修改</span><button className="button button-primary button-small" onClick={saveLocal}>Save Local</button></div>}
        {active === 'dashboard' ? <Dashboard data={data} onNavigate={changePage} /> : active === 'infrastructure' ? <Infrastructure data={data} editMode={editMode} onUpdate={updateData} /> : active === 'architecture' ? <Architecture data={data} editMode={editMode} onUpdate={updateData} /> : active === 'roadmap' ? <RoadmapPage data={data} editMode={editMode} onUpdate={updateData} /> : <DataPage page={active} data={data} editMode={editMode} onUpdate={updateData} />}
      </div>
      <footer className="main-footer"><span><LockKeyhole size={12} /> Private data stays in this browser</span><span>Last local update · {data.meta.updatedAt || '—'}</span></footer>
    </main>
  </div>
}

function sectionPage(section: string) {
  if (section === 'services') return 'dashboard'
  if (section === 'docker') return 'docker'
  return navigation.some((item) => item.key === section) ? section : 'notes'
}

function LoginScreen({ error, onLogin, onConfigured }: { error: string; onLogin: () => void; onConfigured: () => void }) {
  const [config, setConfig] = useState<FirebaseWebConfig>({ apiKey: '', authDomain: '', projectId: '', appId: '' })
  const [editing, setEditing] = useState(false)
  const configSaved = !!getSavedFirebaseConfig()
  const submitConfig = (event: FormEvent) => {
    event.preventDefault()
    if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) return
    void saveFirebaseConfig(config).then(() => { setEditing(false); onConfigured() })
  }
  return <div className="login-page"><div className="login-card">
    <div className="login-logo"><span className="brand-mark"><Activity size={21} /></span><span>EasyStock <b>Ops</b></span></div>
    <div className="login-overline">PRIVATE OPERATIONS · KNOWLEDGE BASE</div>
    <h1>你的 EasyStock<br /><span>維運控制中心</span></h1>
    <p className="login-copy">架構、研究、連線與待辦，集中在你的私人工作空間。</p>
    <div className="login-security"><LockKeyhole size={16} /><span>登入只提供介面存取控管。私人資料只儲存在這台裝置。</span></div>
    {error && <div className="inline-error">{error}</div>}
    {editing ? <form className="firebase-form" onSubmit={submitConfig}>
      <div className="form-heading"><strong>設定 Firebase Web app</strong><span>設定只保存在這個瀏覽器，不會寫入 repo。</span></div>
      {(['apiKey', 'authDomain', 'projectId', 'appId'] as const).map((field) => <label key={field}>{field}<input required value={config[field]} onChange={(event) => setConfig({ ...config, [field]: event.target.value })} autoComplete="off" /></label>)}
      <button className="button button-primary login-submit" type="submit">儲存本機設定 <ArrowDown size={15} /></button>
      {configSaved && <button type="button" className="text-button" onClick={() => setEditing(false)}>返回登入</button>}
      <small>在 Firebase Console 建立 Web app、啟用 Google Authentication，並將部署網域加入 Authorized domains。</small>
    </form> : <div className="login-actions">
      <button className="button google-button" disabled={!configSaved} onClick={onLogin}><GoogleMark />使用 Google 帳號登入</button>
      {!configSaved && <div className="config-hint">首次使用，請先設定 Firebase Web app。</div>}
      <div className="allowed-user"><span>允許帳號</span><code>{ALLOWED_EMAIL}</code></div>
      <button className="text-button config-link" onClick={() => setEditing(true)}><Settings2 size={13} />Firebase 設定</button>
    </div>}
    <div className="login-bottom"><span><span className="live-dot" /> LOCAL DATA ONLY</span><span>EasyStock Ops &amp; Knowledge Center</span></div>
  </div></div>
}

function GoogleMark() { return <span className="google-mark">G</span> }

function AccessDenied({ onBack }: { onBack: () => void }) {
  return <div className="center-page"><div className="denied-card"><div className="denied-icon"><ShieldAlert size={25} /></div><h1>此帳號沒有 EasyStock Ops 權限</h1><p>只有指定的 Google 帳號可以開啟私人工作空間。</p><button className="button button-primary" onClick={onBack}>返回登入</button></div></div>
}

function ImportGate({ error, fileInput, onImport, onLogout }: { error: string; fileInput: React.RefObject<HTMLInputElement>; onImport: (event: React.ChangeEvent<HTMLInputElement>) => void; onLogout: () => void }) {
  return <div className="import-page"><div className="import-card"><div className="import-icon"><FileJson size={26} /></div><div className="eyebrow">PRIVATE DATA · LOCAL ONLY</div><h1>尚未載入私人 EasyStock 資料</h1><p>登入已通過。請從自己的備份匯入 JSON。資料會留在此瀏覽器的 IndexedDB，不會上傳。</p>
    {error && <div className="inline-error">{error}</div>}
    <input ref={fileInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={onImport} />
    <button className="button button-primary import-primary" onClick={() => fileInput.current?.click()}><Upload size={16} />匯入 private-data.json</button>
    <div className="import-meta"><span><LockKeyhole size={13} />IndexedDB 本機儲存</span><span>JSON schema 驗證</span></div>
    <button className="text-button import-logout" onClick={onLogout}><LogOut size={14} />Google 登出</button>
  </div></div>
}

function CenteredMessage({ label }: { label: string }) { return <div className="center-page"><div className="loading-mark"><Activity size={20} /></div><p>{label}</p></div> }

function Dashboard({ data, onNavigate }: { data: EasyStockPrivateData; onNavigate: (page: string) => void }) {
  const activeItems = data.currentWork.filter((item) => item.status === 'DOING')
  const nextItems = data.currentWork.filter((item) => item.status === 'NEXT')
  const openItems = data.currentWork.filter((item) => !['DOING', 'DONE'].includes(item.status))
  const recent = [...data.changelog].slice(0, 4)
  const warnings = [...(Array.isArray(data.marketRisk.knownIssues) ? data.marketRisk.knownIssues as unknown[] : []), ...(Array.isArray(data.intraday.knownIssues) ? data.intraday.knownIssues as unknown[] : [])]
  return <>
    <PageHeading eyebrow="OPS OVERVIEW" title="工程戰情室" subtitle="EasyStock 私人維運、研究與知識總覽。資料由本機 JSON 驅動。" />
    <div className="hero-strip"><div className="hero-copy"><span className="hero-kicker"><span className="live-dot" /> PRIVATE OPERATIONS</span><h2>EasyStock <span>Ops Center</span></h2><p>Production、研究、基礎設施與下一步，一眼掌握。</p></div><div className="hero-stats"><div><strong>{data.services.length}</strong><span>SYSTEMS</span></div><div><strong>{openItems.length}</strong><span>OPEN WORK</span></div><div><strong>{data.apis.length}</strong><span>DATA SOURCES</span></div></div><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /></div>
    <section className="section-block"><div className="section-title-row"><SectionTitle title="Operations Status" note="狀態由私人 JSON 提供" /><button className="subtle-link" onClick={() => onNavigate('infrastructure')}>Infrastructure <ArrowDown size={13} /></button></div>
      <div className="status-grid">{data.services.map((service, index) => <button key={`${service.name}-${index}`} className="status-card" onClick={() => onNavigate(service.name.toLowerCase().includes('nas') ? 'docker' : service.name.toLowerCase().includes('research') ? 'research' : 'infrastructure')}><div className="status-card-icon">{serviceIcon(index)}</div><div className="status-text"><strong>{service.name}</strong><span>{service.description || 'Service status'}</span></div><StatusBadge status={service.status} /></button>)}</div>
    </section>
    <div className="dashboard-columns"><section className="panel"><div className="panel-heading"><div><h3>目前正在處理</h3><p>DOING · {activeItems.length} items</p></div><button className="panel-link" onClick={() => onNavigate('currentWork')}>全部工作 <ArrowDown size={13} /></button></div>{activeItems.length ? activeItems.slice(0, 4).map((item, i) => <WorkRow key={i} item={item} />) : <EmptyLine>目前沒有進行中的項目</EmptyLine>}</section>
      <section className="panel"><div className="panel-heading"><div><h3>下一步</h3><p>NEXT · {nextItems.length} items</p></div><span className="tiny-icon"><Activity size={15} /></span></div>{nextItems.length ? nextItems.slice(0, 4).map((item, i) => <WorkRow key={i} item={item} />) : <EmptyLine>尚未安排下一步</EmptyLine>}</section></div>
    <div className="dashboard-columns"><section className="panel"><div className="panel-heading"><div><h3>近期完成</h3><p>CHANGE LOG</p></div><button className="panel-link" onClick={() => onNavigate('changelog')}>時間線 <ArrowDown size={13} /></button></div>{recent.length ? recent.map((item, i) => <div className="timeline-row" key={i}><span className="timeline-dot" /><time>{item.date}</time><div><strong>{item.title}</strong><small>{item.area} · {item.status}</small></div></div>) : <EmptyLine>尚無變更紀錄</EmptyLine>}</section>
      <section className="panel"><div className="panel-heading"><div><h3>重要警告</h3><p>KNOWN ISSUES</p></div><span className="warning-count">{warnings.length}</span></div>{warnings.length ? warnings.slice(0, 4).map((item, i) => <div className="warning-row" key={i}><CircleAlert size={15} /><span>{displayValue(item)}</span></div>) : <EmptyLine>目前沒有登錄的警告</EmptyLine>}</section></div>
  </>
}

function serviceIcon(index: number) {
  const icons = [Cloud, HardDrive, GitBranch, LayoutDashboard, LockKeyhole, Code2, Activity, Cable, Archive, FileJson, BookOpen]
  const Icon = icons[index % icons.length]
  return <Icon size={17} />
}

function Infrastructure({ data, editMode, onUpdate }: { data: EasyStockPrivateData; editMode: boolean; onUpdate: (data: EasyStockPrivateData) => void }) {
  const diagram = data.infrastructure.diagram || []
  return <><PageHeading eyebrow="INFRASTRUCTURE" title="Infrastructure" subtitle={detailText.infrastructure} />
    <section className="panel architecture-panel"><div className="panel-heading"><div><h3>System Topology</h3><p>USER · SOURCE · STORAGE · RUNTIME</p></div><span className="tiny-icon"><Boxes size={16} /></span></div>
      <div className="infra-diagram"><div className="infra-root"><span className="node-icon"><LayoutDashboard size={17} /></span><div><strong>User / Operator</strong><small>Browser workspace</small></div></div><div className="infra-branches">{diagram.map((node, index) => <div className="infra-branch" key={node.id || index}><div className="infra-card"><span className="node-icon">{serviceIcon(index + 1)}</span><div><strong>{node.label}</strong><small>{node.description}</small></div><StatusBadge status={node.status || 'RESEARCH'} /></div>{node.children?.length ? <div className="infra-children">{node.children.map((child) => <div className="infra-child" key={child.id}><span />{child.label}</div>)}</div> : null}</div>)}</div></div>
    </section>
    <div className="section-block"><SectionTitle title="Infrastructure Systems" note="Edit Mode 內可更新節點 JSON" /><RecordCollection items={data.infrastructure.systems as unknown as Record<string, unknown>[]} editMode={editMode} onChange={(systems) => onUpdate({ ...data, infrastructure: { ...data.infrastructure, systems: systems as unknown as EasyStockPrivateData['infrastructure']['systems'] } })} /></div>
    {editMode && <JsonEditor title="編輯 Architecture Diagram" value={diagram} editMode={editMode} onSave={(value) => onUpdate({ ...data, infrastructure: { ...data.infrastructure, diagram: value as EasyStockPrivateData['infrastructure']['diagram'] } })} />}
  </>
}

function Architecture({ data, editMode, onUpdate }: { data: EasyStockPrivateData; editMode: boolean; onUpdate: (data: EasyStockPrivateData) => void }) {
  const architecture = data.architecture
  const selectedNodes = architecture.nodes || []
  const [selected, setSelected] = useState<string | null>(null)
  const node = selectedNodes.find((item) => item.id === selected)
  return <><PageHeading eyebrow="SYSTEM DESIGN" title="EasyStock Architecture" subtitle={detailText.architecture} />
    <section className="panel"><div className="panel-heading"><div><h3>Data Flow</h3><p>SELECT A NODE TO VIEW DETAILS</p></div><span className="tiny-icon"><GitBranch size={16} /></span></div><div className="flow-diagram">{(architecture.dataFlow || []).map((item, index) => <div className="flow-step-wrap" key={item.id || index}><button className={`flow-node ${selected === item.id ? 'selected' : ''}`} onClick={() => setSelected(selected === item.id ? null : item.id)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.label}</strong>{item.status && <StatusBadge status={item.status} />}</button>{index < architecture.dataFlow.length - 1 && <div className="flow-arrow">↓</div>}</div>)}</div>{node && <div className="node-detail"><strong>{node.label}</strong><p>{node.description}</p></div>}</section>
    <section className="section-block"><SectionTitle title="Architecture Nodes" note="點選流程節點查看說明" /><RecordCollection items={selectedNodes as unknown as Record<string, unknown>[]} editMode={editMode} onChange={(nodes) => onUpdate({ ...data, architecture: { ...architecture, nodes: nodes as unknown as typeof selectedNodes } })} /></section>
    {editMode && <JsonEditor title="編輯 Data Flow" value={architecture.dataFlow} onSave={(value) => onUpdate({ ...data, architecture: { ...architecture, dataFlow: value as typeof architecture.dataFlow } })} />}
  </>
}

function DataPage({ page, data, editMode, onUpdate }: { page: string; data: EasyStockPrivateData; editMode: boolean; onUpdate: (data: EasyStockPrivateData) => void }) {
  const value = data[page]
  const label = titles[page] || page
  const workflow = workflowText[page]
  const description = detailText[page] || '在此管理 EasyStock 私人維運與知識資料。'
  if (page === 'docker' && Array.isArray(value)) return <><PageHeading eyebrow="NAS AI ENVIRONMENT" title={label} subtitle={description} /><section className="panel workflow-panel"><div className="panel-heading"><div><h3>Browser → EasyStock Repository</h3><p>NAS ACCESS AND AI WORKFLOW · JSON-DRIVEN</p></div><StatusBadge status="RESEARCH" /></div><div className="workflow">{data.nasAIEnvironment.workflow.map((step, index) => <div className="workflow-step" key={step.id || index}><span className="workflow-index">{String(index + 1).padStart(2, '0')}</span><strong>{step.label}</strong><small className="workflow-description">{step.description}</small></div>)}</div>{data.nasAIEnvironment.notes && <div className="workflow-notes">{data.nasAIEnvironment.notes}</div>}</section><section className="section-block"><SectionTitle title="Docker Inventory" note="RAM · Role · Persistence · Repository Mount" /><RecordCollection items={value as unknown as Record<string, unknown>[]} editMode={editMode} onChange={(docker) => onUpdate({ ...data, docker: docker as unknown as EasyStockPrivateData['docker'] })} /></section></>
  if (page === 'apis' && Array.isArray(value)) return <><PageHeading eyebrow="DATA SOURCES" title={label} subtitle={description} /><ApiTable apis={value as EasyStockPrivateData['apis']} /><section className="section-block"><SectionTitle title="API Inventory" note="行情、交易、研究能力分開記錄" /><RecordCollection items={value as unknown as Record<string, unknown>[]} editMode={editMode} onChange={(apis) => onUpdate({ ...data, apis: apis as unknown as EasyStockPrivateData['apis'] })} /></section></>
  if (page === 'connections' && Array.isArray(value)) return <><PageHeading eyebrow="ACCESS DIRECTORY" title={label} subtitle={description} /><ConnectionList items={value as EasyStockPrivateData['connections']} editMode={false} onChange={(connections) => onUpdate({ ...data, connections })} />{editMode && <div className="section-block"><SectionTitle title="Manage connections" /><RecordCollection items={value as unknown as Record<string, unknown>[]} editMode onChange={(connections) => onUpdate({ ...data, connections: connections as unknown as EasyStockPrivateData['connections'] })} /></div>}</>
  if (page === 'commands' && Array.isArray(value)) return <><PageHeading eyebrow="COMMAND LIBRARY" title={label} subtitle={description} /><CommandList items={value as EasyStockPrivateData['commands']} editMode={false} onChange={(commands) => onUpdate({ ...data, commands })} />{editMode && <div className="section-block"><SectionTitle title="Manage commands" note="DANGEROUS / DELETE 會以警告色標示" /><RecordCollection items={value as unknown as Record<string, unknown>[]} editMode onChange={(commands) => onUpdate({ ...data, commands: commands as unknown as EasyStockPrivateData['commands'] })} /></div>}</>
  if (workflow) return <><PageHeading eyebrow={page === 'research' ? 'MODEL LIFECYCLE' : 'RESEARCH & VALIDATION'} title={label} subtitle={description} /><section className="panel workflow-panel"><div className="panel-heading"><div><h3>{page === 'research' ? 'Promotion Governance' : `${label} Workflow`}</h3><p>RESEARCH IS NOT PRODUCTION</p></div><StatusBadge status={page === 'research' ? 'RESEARCH' : 'IN DEVELOPMENT'} /></div><div className="workflow">{workflow.map((step, index) => <div key={step} className="workflow-step"><span className="workflow-index">{String(index + 1).padStart(2, '0')}</span><strong>{step}</strong>{index < workflow.length - 1 && <span className="workflow-connector" />}</div>)}</div></section><div className="data-cards">{Object.entries(value as Record<string, unknown>).map(([key, child]) => <DataCard key={key} title={humanize(key)} value={child} />)}</div><JsonEditor title={`編輯 ${label} JSON`} value={value} editMode={editMode} onSave={(next) => onUpdate({ ...data, [page]: next })} /></>
  if (Array.isArray(value)) return <><PageHeading eyebrow={label.toUpperCase()} title={label} subtitle={description} />{page === 'currentWork' ? <><WorkBoard items={value as EasyStockPrivateData['currentWork']} editMode={editMode} onChange={(currentWork) => onUpdate({ ...data, currentWork })} />{editMode && <div className="section-block"><SectionTitle title="Edit work items" /><RecordCollection items={value as unknown as Record<string, unknown>[]} editMode onChange={(currentWork) => onUpdate({ ...data, currentWork: currentWork as unknown as EasyStockPrivateData['currentWork'] })} /></div>}</> : <RecordCollection items={value as Record<string, unknown>[]} editMode={editMode} onChange={(items) => onUpdate({ ...data, [page]: items })} />}</>
  return <><PageHeading eyebrow={label.toUpperCase()} title={label} subtitle={description} />{value && typeof value === 'object' ? <div className="data-cards">{Object.entries(value as Record<string, unknown>).map(([key, child]) => <DataCard key={key} title={humanize(key)} value={child} />)}</div> : <EmptyLine>此區段沒有資料</EmptyLine>}<JsonEditor title={`編輯 ${label} JSON`} value={value} editMode={editMode} onSave={(next) => onUpdate({ ...data, [page]: next })} /></>
}

function PageHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div><div className="heading-meta"><span><span className="live-dot" /> PRIVATE</span><span>LOCAL JSON</span></div></div> }
function SectionTitle({ title, note }: { title: string; note?: string }) { return <div className="section-title"><h2>{title}</h2>{note && <span>{note}</span>}</div> }
function StatusBadge({ status }: { status: string }) { return <span className={`status-badge status-${status.toLowerCase().replaceAll(' ', '-')}`}>{status}</span> }
function EmptyLine({ children }: { children: React.ReactNode }) { return <div className="empty-line">{children}</div> }
function WorkRow({ item }: { item: EasyStockPrivateData['currentWork'][number] }) { return <div className="work-row"><span className={`priority priority-${item.priority.toLowerCase()}`} /><div><strong>{item.title}</strong><small>{item.area} · {item.priority}</small></div><StatusBadge status={item.status} /></div> }

function RecordCollection({ items, editMode, onChange }: { items: Record<string, unknown>[]; editMode: boolean; onChange: (items: Record<string, unknown>[]) => void }) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const beginEdit = (index: number, item: Record<string, unknown>) => { setEditingIndex(index); setDraft(JSON.stringify(item, null, 2)) }
  const saveEdit = () => {
    if (editingIndex === null) return
    try { const next = JSON.parse(draft); if (!next || typeof next !== 'object' || Array.isArray(next)) throw new Error('項目必須是 JSON object'); onChange(replaceAt(items, editingIndex, next)); setEditingIndex(null) }
    catch (cause) { window.alert(cause instanceof Error ? cause.message : 'JSON 格式錯誤') }
  }
  const move = (index: number, offset: number) => { const target = index + offset; if (target < 0 || target >= items.length) return; onChange(reorder(items, index, target)) }
  return <div className="record-list">{items.map((item, index) => <article className="record-card" key={`${String(item.name ?? item.title ?? item.id ?? 'record')}-${index}`}>
    {editingIndex === index ? <div className="record-editor"><textarea aria-label="編輯 JSON 項目" value={draft} onChange={(event) => setDraft(event.target.value)} /><div><button className="button button-primary button-small" onClick={saveEdit}>套用修改</button><button className="button button-quiet button-small" onClick={() => setEditingIndex(null)}>取消</button></div></div> : <><div className="record-top"><div><strong>{String(item.name ?? item.title ?? item.label ?? `Item ${index + 1}`)}</strong><span>{String(item.type ?? item.area ?? item.category ?? '')}</span></div>{typeof item.status === 'string' && <StatusBadge status={item.status} />}</div><div className="record-fields">{Object.entries(item).filter(([key, val]) => !['name', 'title', 'label', 'status', 'command'].includes(key) && ['string', 'number', 'boolean'].includes(typeof val)).map(([key, val]) => <div key={key}><small>{humanize(key)}</small><span>{String(val)}</span></div>)}</div>{typeof item.command === 'string' && <pre className="code-block"><code>{item.command}</code></pre>}{typeof item.description === 'string' && <p className="record-description">{item.description}</p>}</>}
    {editMode && editingIndex !== index && <div className="record-actions"><button aria-label={`上移第 ${index + 1} 項`} disabled={!index} onClick={() => move(index, -1)}><ArrowUp size={14} /></button><button aria-label={`下移第 ${index + 1} 項`} disabled={index === items.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14} /></button><button onClick={() => beginEdit(index, item)}>編輯 JSON</button><button className="delete-action" onClick={() => { if (window.confirm('確定刪除此項目？')) onChange(removeAt(items, index)) }}><Trash2 size={14} />刪除</button></div>}</article>)}
    {editMode && <button className="add-record" onClick={() => { const item = { title: 'New item', description: '', status: 'PLANNED' }; onChange([...items, item]); beginEdit(items.length, item) }}><Plus size={15} />新增項目</button>}
    {!items.length && !editMode && <EmptyLine>目前沒有記錄</EmptyLine>}
  </div>
}

function JsonEditor({ title, value, editMode, onSave }: { title: string; value: unknown; editMode?: boolean; onSave: (value: unknown) => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { if (open) setText(JSON.stringify(value, null, 2)) }, [open, value])
  if (!editMode) return null
  return <section className="json-editor-wrap"><button className="json-toggle" onClick={() => setOpen(!open)}><Code2 size={15} />{title}<span>{open ? '收合' : '展開'}</span></button>{open && <><textarea className="json-textarea" aria-label={title} value={text} onChange={(event) => setText(event.target.value)} /><div className="json-editor-footer">{error && <span className="field-error">{error}</span>}<button className="button button-primary button-small" onClick={() => { try { const next = JSON.parse(text); onSave(next); setError(''); setOpen(false) } catch { setError('JSON 格式錯誤') } }}>套用 JSON 修改</button></div></>}</section>
}

function DataCard({ title, value }: { title: string; value: unknown }) {
  if (Array.isArray(value)) return <section className="panel data-card"><div className="panel-heading"><div><h3>{title}</h3><p>{value.length} RECORDS</p></div><span className="tiny-icon"><Database size={15} /></span></div><div className="mini-list">{value.length ? value.map((item, index) => <div key={index}><span className="mini-dot" /><span>{displayValue(item)}</span></div>) : <EmptyLine>尚無資料</EmptyLine>}</div></section>
  return <section className="panel data-card"><div className="panel-heading"><div><h3>{title}</h3><p>KNOWLEDGE RECORD</p></div><span className="tiny-icon"><BookOpen size={15} /></span></div><div className="data-card-value">{displayValue(value)}</div></section>
}

function ConnectionList({ items, editMode, onChange }: { items: EasyStockPrivateData['connections']; editMode: boolean; onChange: (items: EasyStockPrivateData['connections']) => void }) {
  const [copied, setCopied] = useState(-1)
  return <div className="connection-grid">{items.map((connection, index) => <article className="panel connection-card" key={`${connection.name}-${index}`}><div className="panel-heading"><div><div className="connection-type">{connection.type}</div><h3>{connection.name}</h3></div><StatusBadge status={connection.status} /></div><p className="connection-description">{connection.description || connection.notes || '尚未填寫說明'}</p><div className="connection-fields">{connection.host && <div><small>HOST</small><code>{connection.host}</code></div>}{connection.port && <div><small>PORT</small><code>{connection.port}</code></div>}{connection.username && <div><small>USERNAME</small><code>{connection.username}</code></div>}{connection.url && <div><small>URL</small><code>{connection.url}</code></div>}</div>{connection.command && <div className="command-preview"><pre>{connection.command}</pre><button className="copy-button" onClick={async () => { await navigator.clipboard?.writeText(connection.command!); setCopied(index); window.setTimeout(() => setCopied(-1), 1600) }}>{copied === index ? <Check size={13} /> : <Clipboard size={13} />}{copied === index ? 'Copied' : 'Copy'}</button></div>}{editMode && <RecordCollection items={[connection as unknown as Record<string, unknown>]} editMode onChange={(changed) => { const next = [...items]; next[index] = changed[0] as unknown as typeof connection; onChange(next) }} />}</article>)}{editMode && <RecordCollection items={[]} editMode onChange={(list) => onChange([...items, ...list as unknown as typeof items])} />}{!items.length && <EmptyLine>尚未加入連線資料</EmptyLine>}</div>
}

function ApiTable({ apis }: { apis: EasyStockPrivateData['apis'] }) {
  return <section className="panel api-panel"><div className="panel-heading"><div><h3>Source Capability Matrix</h3><p>DATA ≠ TRADING PERMISSION</p></div><span className="tiny-icon"><Database size={15} /></span></div><div className="table-scroll"><table><thead><tr><th>Source</th><th>Category</th><th>Production</th><th>Market Data</th><th>Trading</th><th>Historical</th><th>Realtime</th><th>Status</th></tr></thead><tbody>{apis.map((api, index) => <tr key={`${api.name}-${index}`}><td><strong>{api.name}</strong><small>{api.purpose}</small></td><td>{api.category}</td><td><BooleanMark value={api.production} /></td><td><BooleanMark value={api.marketData} /></td><td><BooleanMark value={api.trading} /></td><td><BooleanMark value={api.historicalData} /></td><td><BooleanMark value={api.realtime} /></td><td><StatusBadge status={api.status} /></td></tr>)}</tbody></table></div></section>
}
function BooleanMark({ value }: { value: boolean }) { return <span className={value ? 'bool-yes' : 'bool-no'}>{value ? 'YES' : 'NO'}</span> }

function CommandList({ items, editMode, onChange }: { items: EasyStockPrivateData['commands']; editMode: boolean; onChange: (items: EasyStockPrivateData['commands']) => void }) {
  const [copied, setCopied] = useState(-1)
  const categories = [...new Set(items.map((item) => item.category))]
  return <>{categories.map((category) => <section className="section-block" key={category}><SectionTitle title={category} note={`${items.filter((item) => item.category === category).length} COMMANDS`} /><div className="command-list">{items.map((item, index) => item.category === category && <article className={`panel command-card danger-${item.danger.toLowerCase()}`} key={`${item.title}-${index}`}><div className="command-card-head"><div><h3>{item.title}</h3><p>{item.description}</p></div><span className={`danger-badge danger-${item.danger.toLowerCase()}`}>{item.danger}</span></div><pre className="code-block"><code>{item.command}</code><button className="copy-button" onClick={async () => { await navigator.clipboard?.writeText(item.command); setCopied(index); window.setTimeout(() => setCopied(-1), 1500) }}>{copied === index ? <Check size={13} /> : <Clipboard size={13} />}{copied === index ? 'Copied' : 'Copy'}</button></pre>{['DANGEROUS', 'DELETE'].includes(item.danger) && <div className="danger-warning"><ShieldAlert size={14} />危險操作：執行前請確認目標、影響範圍與備份狀態。</div>}{editMode && <RecordCollection items={[item as unknown as Record<string, unknown>]} editMode onChange={(changed) => { const next = [...items]; next[index] = changed[0] as unknown as typeof item; onChange(next) }} />}</article>)}</div></section>)}{editMode && <RecordCollection items={[]} editMode onChange={(list) => onChange([...items, ...list as unknown as typeof items])} />}</>
}

function WorkBoard({ items, editMode, onChange }: { items: EasyStockPrivateData['currentWork']; editMode: boolean; onChange: (items: EasyStockPrivateData['currentWork']) => void }) {
  const statuses: EasyStockPrivateData['currentWork'][number]['status'][] = ['DOING', 'NEXT', 'BACKLOG', 'BLOCKED', 'DONE']
  return <div className="work-board">{statuses.map((status) => <section className="work-column" key={status}><div className="column-heading"><span className={`column-dot dot-${status.toLowerCase()}`} /><h3>{status}</h3><span>{items.filter((item) => item.status === status).length}</span></div>{items.map((item, index) => item.status === status && <article className="work-card" key={`${item.title}-${index}`}><div className="work-card-top"><span className={`priority priority-${item.priority.toLowerCase()}`} />{item.priority}<span className="work-area">{item.area}</span></div><strong>{item.title}</strong><p>{item.description}</p>{item.dependency && <small>Depends on · {item.dependency}</small>}{editMode && <div className="work-card-actions"><button onClick={() => { const next = [...items]; next[index] = { ...item, status: statuses[(statuses.indexOf(status) + 1) % statuses.length] }; onChange(next) }}>Move →</button><button className="delete-action" onClick={() => { if (window.confirm('確定刪除此工作項目？')) onChange(items.filter((_, i) => i !== index)) }}><Trash2 size={13} /></button></div>}</article>)}{editMode && status === 'DOING' && <button className="add-record" onClick={() => onChange([...items, { title: 'New work item', area: 'General', priority: 'P2', status: 'DOING' }])}><Plus size={14} />新增工作</button>}</section>)}</div>
}

function RoadmapPage({ data, editMode, onUpdate }: { data: EasyStockPrivateData; editMode: boolean; onUpdate: (data: EasyStockPrivateData) => void }) {
  const lanes: RoadmapLane[] = ['Now', 'Next', 'Later', 'Research', 'Done']
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  return <><PageHeading eyebrow="PLANNING" title="Roadmap" subtitle={detailText.roadmap} /><div className="roadmap-board">{lanes.map((lane) => <section className="roadmap-column" key={lane} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragIndex === null) return; const roadmap = data.roadmap.map((item, index) => index === dragIndex ? { ...item, lane } : item); onUpdate({ ...data, roadmap }); setDragIndex(null) }}><div className="roadmap-column-head"><h3>{lane}</h3><span>{data.roadmap.filter((item) => item.lane === lane).length}</span></div>{data.roadmap.map((item, index) => item.lane === lane && <article className="roadmap-card" key={`${item.title}-${index}`} draggable={editMode} onDragStart={() => setDragIndex(index)}><div className="roadmap-card-meta"><span>{item.area}</span>{editMode && <span className="drag-hint">DRAG</span>}</div><strong>{item.title}</strong><p>{item.description}</p>{editMode && <button className="delete-action" onClick={() => onUpdate({ ...data, roadmap: data.roadmap.filter((_, i) => i !== index) })}><Trash2 size={13} />刪除</button>}</article>)}{editMode && lane === 'Now' && <button className="add-record" onClick={() => onUpdate({ ...data, roadmap: [...data.roadmap, { title: 'New roadmap item', area: 'General', lane: 'Now' }] })}><Plus size={14} />新增項目</button>}</section>)}</div>{editMode && <div className="section-block"><SectionTitle title="Edit roadmap items" note="狀態欄位也可由 JSON 清單編輯" /><RecordCollection items={data.roadmap as unknown as Record<string, unknown>[]} editMode onChange={(roadmap) => onUpdate({ ...data, roadmap: roadmap as unknown as EasyStockPrivateData['roadmap'] })} /></div>}</>
}

function humanize(value: string) { return value.replace(/([A-Z])/g, ' $1').replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase()) }
function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return Array.isArray(value) ? value.map(displayValue).join(' · ') : Object.entries(value as Record<string, unknown>).map(([key, child]) => `${humanize(key)}: ${displayValue(child)}`).join(' · ')
}
