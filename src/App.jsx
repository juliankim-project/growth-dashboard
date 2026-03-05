import { useState, useEffect } from 'react'
import Sidebar from './components/Layout/Sidebar'
import Header from './components/Layout/Header'
import { useConfig } from './store/useConfig'
import { useDateRange } from './store/useDateRange'
import { useAuth } from './store/useAuth'
import Login from './pages/Login'
import Spinner from './components/UI/Spinner'
import ErrorBoundary from './components/UI/ErrorBoundary'

/* 항상 고정 UI (DataStudio / Settings) */
import DataUpload from './pages/DataStudio'
import DataTables from './pages/datastudio/Tables'
import DataHistory from './pages/datastudio/History'
import SettingsGeneral from './pages/settings/General'
import TabSettings from './pages/settings/TabSettings'
import SettingsTeam from './pages/settings/Team'

/* 커스텀 대시보드 (Overview · Marketing · Product · 커스텀 서브탭 전부) */
import CustomDashboard from './pages/CustomDashboard'
import ComingSoon from './pages/ComingSoon'

/* ──────────────────────────────────────────────
   항상 고정 UI 로 렌더할 키 목록
   나머지는 전부 CustomDashboard (완전 커스텀 가능)
────────────────────────────────────────────── */
const FIXED_MAP = {
  'datastudio.upload': DataUpload,
  'datastudio.tables': DataTables,
  'datastudio.history': DataHistory,
  'settings.general': SettingsGeneral,
  'settings.team': SettingsTeam,
}

import { DEFAULT_SECTIONS } from './components/Layout/Sidebar'

/* ────────────── 대시보드 메인 ────────────── */
function Dashboard({ dark, setDark, user, signOut }) {
  const [nav, setNav] = useState({ section: 'overview', sub: 'dashboard', l3sub: null })
  const cfg = useConfig()
  const { dateRange, setPreset, setCustomRange, filterByDate } = useDateRange()

  const key = nav.l3sub
    ? `${nav.section}.${nav.sub}.${nav.l3sub}`
    : `${nav.section}.${nav.sub}`

  /* ── nav 가드: 숨겨진 빌트인 탭에 있으면 같은 섹션 첫 번째 보이는 탭으로 이동 ── */
  useEffect(() => {
    const sec = DEFAULT_SECTIONS.find(s => s.id === nav.section)
    if (!sec) return
    const hiddenBuiltins = cfg.config.deletedBuiltinSubs?.[nav.section] || []
    const isBuiltinSub = sec.subs.some(s => s.id === nav.sub)
    const isHidden = isBuiltinSub && hiddenBuiltins.includes(nav.sub)
    if (!isHidden) return

    // 숨겨지지 않은 첫 번째 서브탭으로 이동
    const visibleBuiltin = sec.subs.find(s => !hiddenBuiltins.includes(s.id))
    const customSubs = cfg.getCustomSubs(nav.section)
    const fallbackSub = visibleBuiltin?.id ?? customSubs[0]?.id ?? 'dashboard'
    setNav({ section: nav.section, sub: fallbackSub, l3sub: null })
  }, [nav, cfg.config.deletedBuiltinSubs])

  /* ── nav 가드: L3 서서브 자동 선택 / 유효성 검사 ── */
  useEffect(() => {
    const currentKey = `${nav.section}.${nav.sub}`
    // 고정 페이지는 l3sub 불필요
    if (FIXED_MAP[currentKey]) return
    if (nav.section === 'settings') return

    const l3subs = cfg.config.l3subs?.[currentKey] || []

    if (nav.l3sub) {
      // 현재 l3sub 유효성 확인
      if (!l3subs.find(s => s.id === nav.l3sub)) {
        setNav(prev => ({ ...prev, l3sub: null }))
      }
    } else {
      // l3sub 없을 때: l3subs가 있으면 첫 번째로 자동 이동
      if (l3subs.length > 0) {
        setNav(prev => ({ ...prev, l3sub: l3subs[0].id }))
      }
    }
  }, [nav.section, nav.sub, nav.l3sub, cfg.config.l3subs])

  /* ── tabsConfig 생성 헬퍼 (l3sub 지원) ── */
  const makeTabsConfig = (section, sub, l3sub = null) => ({
    tabs: cfg.getL3Tabs(section, sub, l3sub),
    addTab: (label) => cfg.addL3Tab(section, sub, label, l3sub),
    removeTab: (tabId) => cfg.removeL3Tab(section, sub, tabId, l3sub),
    renameTab: (tabId, label) => cfg.renameL3Tab(section, sub, tabId, label, l3sub),
    reorderTabs: (fromIdx, toIdx) => cfg.reorderL3Tabs(section, sub, fromIdx, toIdx, l3sub),
    getDashboard: (tabId) => cfg.getDashboard(section, sub, tabId, l3sub),
    saveDashboard: (dashboard, tabId) => cfg.saveDashboard(section, sub, dashboard, tabId, l3sub),
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
          if (nav.section === sid && nav.sub === sub) {
            const isDefault = DEFAULT_SECTIONS.some(s => s.id === sid)
            setNav({ section: isDefault ? sid : 'overview', sub: 'dashboard', l3sub: null })
          }
        }}
        onHideBuiltinSub={(sid, sub) => {
          cfg.hideBuiltinSub(sid, sub)
          // nav 가드 useEffect 가 자동으로 처리
        }}
        onShowBuiltinSub={cfg.showBuiltinSub}
        getL3Subs={cfg.getL3Subs}
        addL3Sub={cfg.addL3Sub}
        removeL3Sub={cfg.removeL3Sub}
        renameL3Sub={cfg.renameL3Sub}
        getL3Tabs={cfg.getL3Tabs}
        addL3Tab={cfg.addL3Tab}
        removeL3Tab={cfg.removeL3Tab}
        renameL3Tab={cfg.renameL3Tab}
        getSubDataSource={cfg.getSubDataSource}
        setSubDataSource={cfg.setSubDataSource}
        customSections={cfg.config.customSections || []}
        addCustomSection={cfg.addCustomSection}
        removeCustomSection={(id) => {
          cfg.removeCustomSection(id)
          if (nav.section === id) setNav({ section: 'overview', sub: 'dashboard', l3sub: null })
        }}
        setSectionIcon={cfg.setSectionIcon}
        setSubIcon={cfg.setSubIcon}
        setL3SubIcon={cfg.setL3SubIcon}
      />
    )
  } else if (key === 'settings.general') {
    PageContent = (
      <SettingsGeneral
        dark={dark}
        projectName={cfg.config.projectName}
        logoUrl={cfg.config.logoUrl}
        setProjectName={cfg.setProjectName}
        setLogoUrl={cfg.setLogoUrl}
      />
    )
  } else if (FIXED_MAP[key]) {
    /* DataStudio · Settings 고정 UI */
    const Comp = FIXED_MAP[key]
    PageContent = <Comp dark={dark} nav={nav} filterByDate={filterByDate} />
  } else {
    /* Overview · Marketing · Product · 커스텀 서브탭 → 모두 CustomDashboard */
    const subDataSource = cfg.getSubDataSource(nav.section, nav.sub)
    PageContent = (
      <CustomDashboard
        key={key}
        dark={dark}
        filterByDate={filterByDate}
        tabsConfig={makeTabsConfig(nav.section, nav.sub, nav.l3sub)}
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
        getL3Subs={cfg.getL3Subs}
        reorderL3Subs={cfg.reorderL3Subs}
        customSections={cfg.config.customSections || []}
        setSectionLabel={cfg.setSectionLabel}
        setSubLabel={cfg.setSubLabel}
        renameL3Sub={cfg.renameL3Sub}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          nav={nav}
          dark={dark}
          config={cfg.config}
          getL3Subs={cfg.getL3Subs}
          dateRange={dateRange}
          setPreset={setPreset}
          setCustomRange={setCustomRange}
          user={user}
          onSignOut={signOut}
        />
        <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          <ErrorBoundary key={key} dark={dark} label="페이지">
            {PageContent}
          </ErrorBoundary>
        </main>
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
    <Login dark={dark} onSignInWithMagicLink={signInWithMagicLink} accessError={accessError} />
  )

  return <Dashboard dark={dark} setDark={setDark} user={user} signOut={signOut} />
}
