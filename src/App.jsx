import { useState, useEffect } from 'react'
import Sidebar    from './components/Layout/Sidebar'
import Header     from './components/Layout/Header'
import Overview   from './pages/Overview'
import Marketing  from './pages/Marketing'
import Product    from './pages/Product'
import DataStudio from './pages/DataStudio'

const PAGES = {
  overview:   Overview,
  marketing:  Marketing,
  product:    Product,
  datastudio: DataStudio,
}

export default function App() {
  const [page, setPage] = useState('overview')
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : true // 기본 다크모드
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  const PageComponent = PAGES[page] || Overview

  return (
    <div className={`flex h-screen overflow-hidden ${dark ? 'bg-[#13151C]' : 'bg-[#F4F6FA]'}`}>
      <Sidebar
        page={page}
        setPage={setPage}
        dark={dark}
        toggleDark={() => setDark(d => !d)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header page={page} dark={dark} />

        <main className="flex-1 overflow-y-auto">
          <PageComponent dark={dark} />
        </main>
      </div>
    </div>
  )
}
