import { useState, useEffect } from 'react'
import Sidebar        from './components/Layout/Sidebar'
import Header         from './components/Layout/Header'
import { useConfig }  from './store/useConfig'
import { useDateRange } from './store/useDateRange'

import Overview         from './pages/Overview'
import Marketing        from './pages/Marketing'
import MarketingGoals   from './pages/marketing/Goals'
import MarketingReports from './pages/marketing/Reports'
import Product          from './pages/Product'
import ProductFunnel    from './pages/product/Funnel'
import ProductEvents    from './pages/product/Events'
import DataUpload       from './pages/DataStudio'
import DataTables       from './pages/datastudio/Tables'
import DataHistory      from './pages/datastudio/History'
import SettingsGeneral  from './pages/settings/General'
import TabSettings      from './pages/settings/TabSettings'
import SettingsTeam     from './pages/settings/Team'
import CustomDashboard  from './pages/CustomDashboard'
import ComingSoon       from './pages/ComingSoon'

const BUILTIN_MAP = {
  'overview.dashboard':    Overview,
  'marketing.performance': Marketing,
  'marketing.goals':       MarketingGoals,
  'marketing.reports':     MarketingReports,
  'product.overview':      Product,
  'product.funnel':        ProductFunnel,
  'product.events':        ProductEvents,
  'datastudio.upload':     DataUpload,
  'datastudio.tables':     DataTables,
  'datastudio.history':    DataHistory,
  'settings.general':      SettingsGeneral,
  'settings.team':         SettingsTeam,
}

export default function App() {
  const [nav,  setNav]  = useState({ section: 'overview', sub: 'dashboard' })
  const [dark, setDark] = useState(() => {
    try { return (localStorage.getItem('theme') ?? 'dark') === 'dark' } catch { return true }
  })
  const cfg = useConfig()
  const { dateRange, setPreset, setCustomRange, filterByDate } = useDateRange()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  const key = `${nav.section}.${nav.sub}`

  let PageContent = null

  if (key === 'settings.tabs') {
    PageContent = (
      <TabSettings
        dark={dark}
        config={cfg.config}
        onUpdateSection={cfg.setSectionLabel}
        onUpdateSub={cfg.setSubLabel}
        onAddSub={(sid, label) => {
          const id = cfg.addCustomSub(sid, label)
          setNav({ section: sid, sub: id })
        }}
        onRemoveSub={(sid, sub) => {
          cfg.removeCustomSub(sid, sub)
          if (nav.section === sid && nav.sub === sub)
            setNav({ section: sid, sub: 'dashboard' })
        }}
      />
    )
  } else {
    const customSubs = cfg.getCustomSubs(nav.section)
    const isCustom   = customSubs.some(s => s.id === nav.sub)

    if (isCustom) {
      PageContent = (
        <CustomDashboard
          key={key}
          dark={dark}
          initialDashboard={cfg.getDashboard(nav.section, nav.sub)}
          onSaveDashboard={d => cfg.saveDashboard(nav.section, nav.sub, d)}
          filterByDate={filterByDate}
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
        />
        <main className="flex-1 overflow-y-auto">{PageContent}</main>
      </div>
    </div>
  )
}
