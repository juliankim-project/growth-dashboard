import { useState, useEffect } from 'react'
import Sidebar        from './components/Layout/Sidebar'
import Header         from './components/Layout/Header'
import { useConfig }  from './store/useConfig'
import { useDateRange } from './store/useDateRange'
import { useAuth }    from './store/useAuth'
import Login          from './pages/Login'
import Spinner        from './components/UI/Spinner'

import Overview       from './pages/Overview'
import Product        from './pages/Product'
import ProductFunnel  from './pages/product/Funnel'
import ProductEvents  from './pages/product/Events'
import DataUpload     from './pages/DataStudio'
import DataTables     from './pages/datastudio/Tables'
import DataHistory    from './pages/datastudio/History'
import SettingsGeneral from './pages/settings/General'
import TabSettings    from './pages/settings/TabSettings'
import SettingsTeam   from './pages/settings/Team'
import CustomDashboard from './pages/CustomDashboard'
import ComingSoon     from './pages/ComingSoon'

/* ────────────────────────────────────────────
   빌트인 페이지 맵 (그 외는 CustomDashboard)
──────────────────────────────────────────── */
const BUILTIN_MAP = {
  'overview.dashboard':  Overview,
  'product.overview':    Product,
  'product.funnel':      ProductFunnel,
  'product.events':      ProductEvents,
  'datastudio.upload':   DataUpload,
  'datastudio.tables':   DataTables,
  'datastudio.history':  DataHistory,
  'settings.general':    SettingsGeneral,
  'settings.team':       SettingsTeam,
}

/**
 * marketing 섹션 하위 페이지 + 모든 커스텀 서브탭은
 * CustomDashboard (L3 탭) 으로 렌더링
 */
const CUSTOM_TAB_KEYS = new Set([
  'marketing.performance',
  'marketing.goals',
  'marketing.reports',
])

/* ────────────── 대시보드 메인 ────────────── */
function Dashboard({ dark, setDark, user, signOut }) {
  const [nav, setNav] = useState({ section: 'overview', sub: 'dashboard' })
  const cfg = useConfig()
  const { dateRange, setPreset, setCustomRange, filterByDate } = useDateRange()

  const key = `${nav.section}.${nav.sub}`

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
        getL3Tabs={cfg.getL3Tabs}
        addL3Tab={cfg.addL3Tab}
        removeL3Tab={cfg.removeL3Tab}
        renameL3Tab={cfg.renameL3Tab}
      />
    )
  } else {
    const customSubs = cfg.getCustomSubs(nav.section)
    const isCustom   = customSubs.some(s => s.id === nav.sub)

    if (isCustom || CUSTOM_TAB_KEYS.has(key)) {
      /* marketing 페이지 + 커스텀 서브탭 → L3 탭 지원 CustomDashboard */
      PageContent = (
        <CustomDashboard
          key={key}
          dark={dark}
          filterByDate={filterByDate}
          tabsConfig={makeTabsConfig(nav.section, nav.sub)}
        />
      )
    } else {
      const Comp = BUILTIN_MAP[key]
      PageContent = Comp
        ? <Comp dark={dark} nav={nav} filterByDate={filterByDate}/>
        : <ComingSoon dark={dark} nav={nav}/>
    }
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
