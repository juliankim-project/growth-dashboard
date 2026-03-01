import { useState, useEffect } from 'react'
import Sidebar        from './components/Layout/Sidebar'
import Header         from './components/Layout/Header'
import { useConfig }  from './store/useConfig'
import { useDateRange } from './store/useDateRange'
import { useAuth }    from './store/useAuth'
import Login          from './pages/Login'
import Spinner        from './components/UI/Spinner'

/* 항상 고정 UI (DataStudio / Settings) */
import DataUpload     from './pages/DataStudio'
import DataTables     from './pages/datastudio/Tables'
import DataHistory    from './pages/datastudio/History'
import SettingsGeneral from './pages/settings/General'
import TabSettings    from './pages/settings/TabSettings'
import SettingsTeam   from './pages/settings/Team'

/* 커스텀 대시보드 (Overview · Marketing · Product · 커스텀 서브탭 전부) */
import CustomDashboard from './pages/CustomDashboard'
import ComingSoon      from './pages/ComingSoon'

/* ──────────────────────────────────────────────
   항상 고정 UI 로 렌더할 키 목록
   나머지는 전부 CustomDashboard (완전 커스텀 가능)
────────────────────────────────────────────── */
const FIXED_MAP = {
  'datastudio.upload':   DataUpload,
  'datastudio.tables':   DataTables,
  'datastudio.history':  DataHistory,
  'settings.general':    SettingsGeneral,
  'settings.team':       SettingsTeam,
}

import { DEFAULT_SECTIONS } from './components/Layout/Sidebar'

/* ────────────── 대시보드 메인 ────────────── */
function Dashboard({ dark, setDark, user, signOut }) {
  const [nav, setNav] = useState({ section: 'overview', sub: 'dashboard' })
  const cfg = useConfig()
  const { dateRange, setPreset, setCustomRange, filterByDate } = useDateRange()

  const key = `${nav.section}.${nav.sub}`

  /* ── nav 가드: 숨겨진 빌트인 탭에 있으면 같은 섹션 첫 번째 보이는 탭으로 이동 ── */
  useEffect(() => {
    const sec = DEFAULT_SECTIONS.find(s => s.id === nav.section)
    if (!sec) return
    const hiddenBuiltins = cfg.config.deletedBuiltinSubs?.[nav.section] || []
    const isBuiltinSub   = sec.subs.some(s => s.id === nav.sub)
    const isHidden       = isBuiltinSub && hiddenBuiltins.includes(nav.sub)
    if (!isHidden) return

    // 숨겨지지 않은 첫 번째 서브탭으로 이동
    const visibleBuiltin = sec.subs.find(s => !hiddenBuiltins.includes(s.id))
    const customSubs     = cfg.getCustomSubs(nav.section)
    const fallbackSub    = visibleBuiltin?.id ?? customSubs[0]?.id ?? 'dashboard'
    setNav({ section: nav.section, sub: fallbackSub })
  }, [nav, cfg.config.deletedBuiltinSubs])

  /* ── tabsConfig 생성 헬퍼 ── */
  const makeTabsConfig = (section, sub) => ({
    tabs:         cfg.getL3Tabs(section, sub),
    addTab:       (label) => cfg.addL3Tab(section, sub, label),
    removeTab:    (tabId) => cfg.removeL3Tab(section, sub, tabId),
    renameTab:    (tabId, label) => cfg.renameL3Tab(section, sub, tabId, label),
    getDashboard: (tabId) => cfg.getDashboard(section, sub, tabId),
    saveDashboard:(dashboard, tabId) => cfg.saveDashboard(section, sub, dashboard, tabId),
  })

  /* ── 페이지 결정 ── */
  let PageContent = null

  if (key === 'settings.tabs') {
    PageContent = (
      <TabSettings
        dark={dark}
        config={cfg.config}
        onUpdateSection={cfg.setSectionLabel}
        onUpdateSub={cfg.setSubLabel}
        onAddSub={(sid, label) => cfg.addCustomSub(sid, label)}
        onRemoveSub={(sid, sub) => {
          cfg.removeCustomSub(sid, sub)
          if (nav.section === sid && nav.sub === sub)
            setNav({ section: sid, sub: 'dashboard' })
        }}
        onHideBuiltinSub={(sid, sub) => {
          cfg.hideBuiltinSub(sid, sub)
          // nav 가드 useEffect 가 자동으로 처리
        }}
        onShowBuiltinSub={cfg.showBuiltinSub}
        getL3Tabs={cfg.getL3Tabs}
        addL3Tab={cfg.addL3Tab}
        removeL3Tab={cfg.removeL3Tab}
        renameL3Tab={cfg.renameL3Tab}
        getSubDataSource={cfg.getSubDataSource}
        setSubDataSource={cfg.setSubDataSource}
      />
    )
  } else if (FIXED_MAP[key]) {
    /* DataStudio · Settings 고정 UI */
    const Comp = FIXED_MAP[key]
    PageContent = <Comp dark={dark} nav={nav} filterByDate={filterByDate}/>
  } else {
    /* Overview · Marketing · Product · 커스텀 서브탭 → 모두 CustomDashboard */
    const subDataSource = cfg.getSubDataSource(nav.section, nav.sub)
    PageContent = (
      <CustomDashboard
        key={key}
        dark={dark}
        filterByDate={filterByDate}
        tabsConfig={makeTabsConfig(nav.section, nav.sub)}
        subDataSource={subDataSource}
      />
    )
  }

  return (
    <div className={`flex h-screen overflow-hidden ${dark ? 'bg-[#13151C]' : 'bg-[#F4F6FA]'}`}>
      <Sidebar
        nav={nav} setNav={setNav}
        dark={dark} toggleDark={() => setDark(d => !d)}
        config={cfg.config}
        getSectionLabel={cfg.getSectionLabel}
        getSubLabel={cfg.getSubLabel}
        getCustomSubs={cfg.getCustomSubs}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          nav={nav}
          dark={dark}
          config={cfg.config}
          dateRange={dateRange}
          setPreset={setPreset}
          setCustomRange={setCustomRange}
          user={user}
          onSignOut={signOut}
        />
        <main className="flex-1 overflow-hidden">{PageContent}</main>
      </div>
    </div>
  )
}

/* ────────────── 루트 ────────────── */
export default function App() {
  const [dark, setDark] = useState(() => {
    try { return (localStorage.getItem('theme') ?? 'dark') === 'dark' } catch { return true }
  })
  const { session, loading, accessError, user, signInWithMagicLink, signOut } = useAuth()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  if (loading) return (
    <div className={`min-h-screen flex items-center justify-center ${dark ? 'bg-[#0F1117]' : 'bg-[#F4F6FA]'}`}>
      <Spinner dark={dark} />
    </div>
  )

  if (!session) return (
    <Login dark={dark} onSignInWithMagicLink={signInWithMagicLink} accessError={accessError}/>
  )

  return <Dashboard dark={dark} setDark={setDark} user={user} signOut={signOut} />
}
