import { useState, useEffect } from 'react'
import Sidebar    from './components/Layout/Sidebar'
import Header     from './components/Layout/Header'

/* Pages */
import Overview           from './pages/Overview'
import Marketing          from './pages/Marketing'
import MarketingGoals     from './pages/marketing/Goals'
import MarketingReports   from './pages/marketing/Reports'
import Product            from './pages/Product'
import ProductFunnel      from './pages/product/Funnel'
import ProductEvents      from './pages/product/Events'
import DataUpload         from './pages/DataStudio'
import DataTables         from './pages/datastudio/Tables'
import DataHistory        from './pages/datastudio/History'
import SettingsGeneral    from './pages/settings/General'
import SettingsTeam       from './pages/settings/Team'
import ComingSoon         from './pages/ComingSoon'

/* section.sub → 컴포넌트 매핑 */
const PAGE_MAP = {
  'overview.dashboard':      Overview,
  'marketing.performance':   Marketing,
  'marketing.goals':         MarketingGoals,
  'marketing.reports':       MarketingReports,
  'product.overview':        Product,
  'product.funnel':          ProductFunnel,
  'product.events':          ProductEvents,
  'datastudio.upload':       DataUpload,
  'datastudio.tables':       DataTables,
  'datastudio.history':      DataHistory,
  'settings.general':        SettingsGeneral,
  'settings.team':           SettingsTeam,
}

export default function App() {
  const [nav, setNav] = useState({ section: 'overview', sub: 'dashboard' })
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem('theme')
      return saved ? saved === 'dark' : true
    } catch { return true }
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  const key           = `${nav.section}.${nav.sub}`
  const PageComponent = PAGE_MAP[key] || ComingSoon

  return (
    <div className={`flex h-screen overflow-hidden ${dark ? 'bg-[#13151C]' : 'bg-[#F4F6FA]'}`}>
      <Sidebar nav={nav} setNav={setNav} dark={dark} toggleDark={() => setDark(d => !d)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header nav={nav} dark={dark} />
        <main className="flex-1 overflow-y-auto">
          <PageComponent dark={dark} nav={nav} />
        </main>
      </div>
    </div>
  )
}
