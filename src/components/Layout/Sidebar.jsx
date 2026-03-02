import { useState, useRef, useEffect } from 'react'
import {
  LayoutDashboard, Megaphone, Package, Database,
  Settings, Sun, Moon, BarChart2,
  Target, FileBarChart, Upload, Table2, History,
  TrendingUp, GitBranch, Zap, ChevronDown, GripVertical,
  Users, Sliders, LayoutTemplate, Plus
} from 'lucide-react'

/* ─────────── 기본 네비 구조 ─────────── */
export const DEFAULT_SECTIONS = [
  {
    id: 'overview', label: 'Overview', icon: 'LayoutDashboard',
    subs: [{ id:'dashboard', label:'종합 대시보드', icon:'LayoutDashboard' }]
  },
  {
    id: 'marketing', label: 'Marketing', icon: 'Megaphone',
    subs: [
      { id:'performance', label:'매체 성과',  icon:'TrendingUp'   },
      { id:'goals',       label:'목표 설정',  icon:'Target'       },
      { id:'reports',     label:'리포트',     icon:'FileBarChart' },
    ]
  },
  {
    id: 'product', label: 'Product', icon: 'Package',
    subs: [
      { id:'overview', label:'개요',      icon:'Package'   },
      { id:'funnel',   label:'퍼널 분석', icon:'GitBranch' },
      { id:'events',   label:'이벤트',    icon:'Zap'       },
    ]
  },
  {
    id: 'datastudio', label: 'Data Studio', icon: 'Database',
    subs: [
      { id:'upload',  label:'CSV 업로드',  icon:'Upload'  },
      { id:'tables',  label:'테이블 관리', icon:'Table2'  },
      { id:'history', label:'업로드 기록', icon:'History' },
    ]
  },
  {
    id: 'settings', label: 'Settings', icon: 'Settings',
    subs: [
      { id:'general', label:'일반 설정', icon:'Sliders'        },
      { id:'tabs',    label:'탭 설정',   icon:'LayoutTemplate' },
      { id:'team',    label:'팀 관리',   icon:'Users'          },
    ]
  },
]

const ICONS = {
  LayoutDashboard, Megaphone, Package, Database, Settings,
  TrendingUp, Target, FileBarChart, Upload, Table2, History,
  GitBranch, Zap, Users, Sliders, LayoutTemplate,
}
const Icon = ({ name, size=16, className='' }) => {
  const C = ICONS[name]; return C ? <C size={size} className={className}/> : null
}

const STORAGE_ORDER = 'sidebar_order_v2'
const STORAGE_OPEN  = 'sidebar_open_v2'

/* ─────────── 메인 컴포넌트 ─────────── */
export default function Sidebar({ nav, setNav, dark, toggleDark, config={}, getSectionLabel, getSubLabel, getCustomSubs, getL3Subs }) {

  const [sections, setSections] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_ORDER) || '[]')
      if (saved.length) {
        return saved.map(id => DEFAULT_SECTIONS.find(s => s.id === id))
          .filter(Boolean)
          .concat(DEFAULT_SECTIONS.filter(s => !saved.includes(s.id)))
      }
    } catch {}
    return DEFAULT_SECTIONS
  })

  const [open, setOpen] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_OPEN) || '{}')
      return Object.keys(saved).length ? saved : { overview: true }
    } catch { return { overview: true } }
  })

  /* L2 서브별 L3 서서브 열림 상태 */
  const [l3Open, setL3Open] = useState({})

  const dragIdx = useRef(null)
  const overIdx = useRef(null)
  const [dragId, setDragId] = useState(null)

  /* nav 변경 시 해당 섹션 자동 오픈 (외부에서 setNav 호출될 때 대응) */
  useEffect(() => {
    setOpen(prev => ({ ...prev, [nav.section]: true }))
  }, [nav.section])

  /* nav.l3sub 변경 시 해당 L2 서브의 L3 패널 자동 오픈 */
  useEffect(() => {
    if (nav.l3sub) {
      const key = `${nav.section}.${nav.sub}`
      setL3Open(prev => ({ ...prev, [key]: true }))
    }
  }, [nav.section, nav.sub, nav.l3sub])

  useEffect(() => {
    localStorage.setItem(STORAGE_ORDER, JSON.stringify(sections.map(s => s.id)))
  }, [sections])
  useEffect(() => {
    localStorage.setItem(STORAGE_OPEN, JSON.stringify(open))
  }, [open])

  const toggleSection = (sec) => {
    const isOpen = !!open[sec.id]
    setOpen(prev => ({ ...prev, [sec.id]: !isOpen }))
    if (!isOpen) setNav({ section: sec.id, sub: sec.subs[0].id, l3sub: null })
  }

  const goTo = (sectionId, subId, l3subId = null) => {
    setNav({ section: sectionId, sub: subId, l3sub: l3subId })
    setOpen(prev => ({ ...prev, [sectionId]: true }))
  }

  /* L2 서브 클릭: L3 서서브가 있으면 토글/자동선택, 없으면 직접 이동 */
  const handleSubClick = (sectionId, subId) => {
    const l3subs = getL3Subs?.(sectionId, subId) || []
    if (l3subs.length === 0) {
      goTo(sectionId, subId, null)
      return
    }
    const key = `${sectionId}.${subId}`
    const wasOpen = !!l3Open[key]
    setL3Open(prev => ({ ...prev, [key]: !wasOpen }))
    setOpen(prev => ({ ...prev, [sectionId]: true }))
    if (!wasOpen) {
      // 열릴 때 첫 번째 L3 서서브로 이동
      setNav({ section: sectionId, sub: subId, l3sub: l3subs[0].id })
    }
  }

  const onDragStart = (e, idx) => { dragIdx.current = idx; setDragId(sections[idx].id); e.dataTransfer.effectAllowed = 'move' }
  const onDragEnter = (e, idx) => { overIdx.current = idx; e.preventDefault() }
  const onDragOver  = e => e.preventDefault()
  const onDragEnd   = () => {
    const from = dragIdx.current, to = overIdx.current
    if (from !== null && to !== null && from !== to) {
      const next = [...sections]; const [m] = next.splice(from, 1); next.splice(to, 0, m)
      setSections(next)
    }
    dragIdx.current = null; overIdx.current = null; setDragId(null)
  }

  const t = dark
    ? { text:'text-slate-400', hover:'hover:bg-[#1A1D27] hover:text-white', border:'border-[#1E2130]' }
    : { text:'text-slate-500', hover:'hover:bg-slate-100 hover:text-slate-700', border:'border-slate-200' }

  return (
    <aside className={`flex flex-col w-[220px] min-h-screen shrink-0 border-r transition-colors duration-200
      ${dark ? 'bg-[#0F1117] border-[#1E2130]' : 'bg-white border-slate-200'}`}>

      {/* 로고 */}
      <div className={`flex items-center gap-2.5 px-5 py-5 border-b ${t.border}`}>
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
          <BarChart2 size={16} className="text-white"/>
        </div>
        <span className={`font-bold text-[15px] ${dark ? 'text-white' : 'text-slate-800'}`}>Growth HQ</span>
      </div>

      {/* 네비 */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto">
        <p className={`px-3 pb-2 text-[9px] font-bold uppercase tracking-widest ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
          ≡ 드래그로 순서 변경
        </p>

        {sections.map((sec, idx) => {
          const isOpen    = !!open[sec.id]
          const isActive  = nav.section === sec.id
          const isDragging = dragId === sec.id

          /* 커스텀 라벨 적용 */
          const secLabel       = getSectionLabel?.(sec.id) || sec.label
          const customSubs     = getCustomSubs?.(sec.id) || []
          const hiddenBuiltins = config.deletedBuiltinSubs?.[sec.id] || []
          const allSubs        = [
            ...sec.subs
              .filter(s => !hiddenBuiltins.includes(s.id))
              .map(s => ({ ...s, label: getSubLabel?.(sec.id, s.id) || s.label })),
            ...customSubs.map(cs => ({
              id: cs.id,
              label: getSubLabel?.(sec.id, cs.id) || cs.label,
              icon: 'LayoutTemplate',
              isCustom: true,
            })),
          ]

          return (
            <div key={sec.id}
              draggable
              onDragStart={e => onDragStart(e, idx)}
              onDragEnter={e => onDragEnter(e, idx)}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              className={`rounded-lg transition-all ${isDragging ? 'opacity-30' : ''}`}
            >
              {/* 섹션 헤더 */}
              <button
                onClick={() => toggleSection(sec)}
                className={`w-full flex items-center gap-2 px-2 py-2.5 rounded-lg text-xs transition-all duration-150 text-left group
                  ${isActive ? dark ? 'text-white' : 'text-slate-800' : `${t.text} ${t.hover}`}`}
              >
                <GripVertical size={12}
                  className={`shrink-0 cursor-grab active:cursor-grabbing ${dark ? 'text-slate-700 group-hover:text-slate-500' : 'text-slate-300 group-hover:text-slate-400'}`}/>
                <Icon name={sec.icon} size={14} className={isActive ? 'text-indigo-500' : 'opacity-80'}/>
                <span className="font-semibold flex-1">{secLabel}</span>
                <ChevronDown size={12}
                  className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${dark ? 'text-slate-600' : 'text-slate-300'}`}/>
              </button>

              {/* 서브메뉴 */}
              {isOpen && (
                <div className="pl-6 pr-1 pb-1.5 flex flex-col gap-0.5">
                  {allSubs.map(sub => {
                    const subLabel   = getSubLabel?.(sec.id, sub.id) || sub.label
                    const l3subs     = getL3Subs?.(sec.id, sub.id) || []
                    const hasL3Subs  = l3subs.length > 0
                    const l3key      = `${sec.id}.${sub.id}`
                    const l3IsOpen   = !!l3Open[l3key]
                    // L3 서서브가 있으면 그 중 하나가 active일 때 L2는 semi-active
                    const l3subActive = isActive && nav.sub === sub.id && nav.l3sub && l3subs.some(s => s.id === nav.l3sub)
                    const subActive   = isActive && nav.sub === sub.id && !nav.l3sub
                    const anyActive   = subActive || l3subActive

                    return (
                      <div key={sub.id}>
                        <button
                          onClick={() => handleSubClick(sec.id, sub.id)}
                          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all duration-150 text-left
                            ${subActive ? 'bg-indigo-600 text-white'
                              : l3subActive ? dark ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
                              : `${t.text} ${t.hover}`}`}
                        >
                          <Icon name={sub.icon} size={12} className={anyActive ? (subActive ? 'text-white' : 'text-indigo-400') : 'opacity-60'}/>
                          <span className={`${anyActive ? 'font-semibold' : 'font-medium'} flex-1`}>{subLabel}</span>
                          {sub.isCustom && !anyActive && (
                            <span className={`text-[8px] px-1 py-0.5 rounded ${dark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-400'}`}>커스텀</span>
                          )}
                          {hasL3Subs && (
                            <ChevronDown size={10}
                              className={`shrink-0 transition-transform duration-200 ${l3IsOpen ? '' : '-rotate-90'}
                                ${anyActive ? (subActive ? 'text-white/70' : 'text-indigo-400') : dark ? 'text-slate-600' : 'text-slate-300'}`}
                            />
                          )}
                        </button>

                        {/* L3 서서브 목록 */}
                        {hasL3Subs && l3IsOpen && (
                          <div className="pl-5 pr-1 pb-0.5 flex flex-col gap-0.5">
                            {l3subs.map(ls => {
                              const l3Active = isActive && nav.sub === sub.id && nav.l3sub === ls.id
                              return (
                                <button key={ls.id}
                                  onClick={() => goTo(sec.id, sub.id, ls.id)}
                                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] transition-all duration-150 text-left
                                    ${l3Active ? 'bg-indigo-600 text-white' : `${t.text} ${t.hover}`}`}
                                >
                                  <span className={`text-[8px] shrink-0 ${l3Active ? 'text-white/60' : dark ? 'text-slate-600' : 'text-slate-300'}`}>◆</span>
                                  <span className={`${l3Active ? 'font-semibold' : 'font-medium'} flex-1 truncate`}>{ls.label}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* 다크모드 토글 */}
      <div className={`px-2 pb-4 border-t pt-3 ${t.border}`}>
        <button onClick={toggleDark}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-all ${t.text} ${t.hover}`}>
          {dark ? <Sun size={14} className="text-yellow-400"/> : <Moon size={14} className="text-indigo-400"/>}
          <span className="font-medium">{dark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>
    </aside>
  )
}
