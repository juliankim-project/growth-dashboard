import { useState, useRef, useEffect } from 'react'
import { SUB_COLOR_OPTIONS } from '../../store/useConfig'
import { APP_VERSION } from '../../version'
import {
  LayoutDashboard, Megaphone, Package, Database,
  Settings, Sun, Moon, BarChart2,
  Target, FileBarChart, Upload, Table2, History,
  TrendingUp, GitBranch, Zap, ChevronDown, GripVertical,
  Users, Sliders, LayoutTemplate, Plus, Pencil,
  /* icon picker 추가 아이콘 */
  Star, Bell, Globe, Calendar, Clock, Bookmark, Flag, Tag,
  PieChart, Activity, Briefcase, Folder, Box, Monitor,
  ShoppingCart, DollarSign, CreditCard, Search, Filter,
  Mail, Phone, Home, Shield, Wrench, Cpu, Server,
  Wifi, Map, Image, Heart, Award, Rocket, Compass, Layers, Eye, Tv,
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
    id: 'useranalysis', label: '예약&유저 분석', icon: 'Users',
    subs: [
      { id:'pace',     label:'체크인 페이스',    icon:'Calendar'    },
      { id:'segment',  label:'유저 세그먼트',    icon:'Users'       },
      { id:'cohort',   label:'코호트 분석',      icon:'Activity'    },
      { id:'ltv',      label:'LTV · 구매주기',   icon:'TrendingUp'  },
      { id:'pattern',  label:'이용 패턴',        icon:'Clock'       },
      { id:'branch',   label:'지점 · 권역 비교', icon:'Home'        },
      { id:'exclude',  label:'유저 제외',        icon:'Shield'      },
    ]
  },
  {
    id: 'ailab', label: 'AI 연구소', icon: 'Cpu',
    subs: [
      { id:'ask',     label:'질문하기',  icon:'Search'  },
      { id:'history', label:'질문내역',  icon:'History' },
    ]
  },
  {
    id: 'datastudio', label: 'Data Studio', icon: 'Database',
    subs: [
      { id:'upload',  label:'CSV 업로드',  icon:'Upload'  },
      { id:'tables',       label:'데이터 설정', icon:'Table2'   },
      { id:'templates',    label:'위젯 템플릿', icon:'LayoutTemplate' },
      { id:'history',      label:'업로드 기록', icon:'History'  },
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

export const ICONS = {
  LayoutDashboard, Megaphone, Package, Database, Settings,
  TrendingUp, Target, FileBarChart, Upload, Table2, History,
  GitBranch, Zap, Users, Sliders, LayoutTemplate, BarChart2, Layers,
  Star, Bell, Globe, Calendar, Clock, Bookmark, Flag, Tag,
  PieChart, Activity, Briefcase, Folder, Box, Monitor,
  ShoppingCart, DollarSign, CreditCard, Search, Filter,
  Mail, Phone, Home, Shield, Wrench, Cpu, Server,
  Wifi, Map, Image, Heart, Award, Rocket, Compass, Eye, Tv,
}

/* 아이콘 피커용 순서 정렬 목록 */
export const ICON_LIST = [
  'LayoutDashboard','LayoutTemplate','Layers','BarChart2','PieChart','Activity',
  'TrendingUp','Target','FileBarChart','GitBranch','Zap','Rocket',
  'Megaphone','Package','Database','Settings','Sliders','Briefcase',
  'Users','Heart','Star','Award','Bookmark','Flag',
  'Upload','Table2','History','Search','Filter','Folder',
  'DollarSign','CreditCard','ShoppingCart','Monitor','Server','Cpu',
  'Globe','Map','Compass','Wifi','Mail','Phone',
  'Calendar','Clock','Bell','Tag','Shield','Home',
  'Wrench','Box','Image','Eye','Tv','Star',
]

export const Icon = ({ name, size=16, className='' }) => {
  const C = ICONS[name]; return C ? <C size={size} className={className}/> : null
}

const STORAGE_ORDER     = 'sidebar_order_v2'
const STORAGE_OPEN      = 'sidebar_open_v2'
const STORAGE_SUB_ORDER = 'sidebar_sub_order_v1'

/* ─────────── 메인 컴포넌트 ─────────── */
export default function Sidebar({
  nav, setNav, dark, toggleDark, config={},
  getSectionLabel, getSubLabel, getCustomSubs, getL3Subs, reorderL3Subs,
  customSections = [],
  /* 인라인 편집 setters */
  setSectionLabel, setSubLabel, renameL3Sub,
}) {
  /* 커스텀 섹션을 DEFAULT와 동일한 형태로 변환 */
  const toSectionDef = (cs) => ({
    id: cs.id, label: cs.label, icon: 'LayoutTemplate', subs: [], isCustom: true,
  })

  const [sections, setSections] = useState(() => {
    const customDefs = (customSections || []).map(toSectionDef)
    const allDefs    = [...DEFAULT_SECTIONS, ...customDefs]
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_ORDER) || '[]')
      if (saved.length) {
        return saved.map(id => allDefs.find(s => s.id === id))
          .filter(Boolean)
          .concat(allDefs.filter(s => !saved.includes(s.id)))
      }
    } catch {}
    return allDefs
  })

  /* customSections prop 변경 시 sections 동기화 (추가/삭제) */
  const customSectionsKey = (customSections || []).map(s => s.id).join(',')
  useEffect(() => {
    const customDefs = (customSections || []).map(toSectionDef)
    setSections(prev => {
      const filtered = prev.filter(s => !s.isCustom || customDefs.some(cs => cs.id === s.id))
      const existingIds = filtered.map(s => s.id)
      const toAdd = customDefs.filter(cs => !existingIds.includes(cs.id))
      return [...filtered, ...toAdd]
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customSectionsKey])

  const [open, setOpen] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_OPEN) || '{}')
      return Object.keys(saved).length ? saved : { overview: true }
    } catch { return { overview: true } }
  })

  /* L2 서브 커스텀 순서 (섹션별, localStorage) */
  const [subOrders, setSubOrders] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_SUB_ORDER) || '{}') } catch { return {} }
  })

  /* L2 서브별 L3 서서브 열림 상태 */
  const [l3Open, setL3Open] = useState({})

  /* ── 인라인 이름 편집 상태 ── */
  const [sidebarEdit, setSidebarEdit] = useState(null)
  // null | { type:'section'|'sub'|'l3sub', key:string, value:string }

  const commitSidebarEdit = (inputVal) => {
    if (!sidebarEdit) return
    const { type, key } = sidebarEdit
    const v = (inputVal ?? '').trim()
    if (!v) { setSidebarEdit(null); return }
    if (type === 'section')  setSectionLabel?.(key, v)
    else if (type === 'sub') {
      const [sid, subId] = key.split('\x00')
      setSubLabel?.(sid, subId, v)
    } else if (type === 'l3sub') {
      const [sid, subId, l3Id] = key.split('\x00')
      renameL3Sub?.(sid, subId, l3Id, v)
    }
    setSidebarEdit(null)
  }

  /* ── L1 섹션 드래그 refs ── */
  const dragIdx = useRef(null)
  const overIdx = useRef(null)
  const [dragId, setDragId] = useState(null)

  /* ── L2 서브 드래그 refs ── */
  const subDragSec  = useRef(null)
  const subDragFrom = useRef(null)
  const subDragTo   = useRef(null)
  const [subDragId, setSubDragId] = useState(null)

  /* ── L3 서서브 드래그 refs ── */
  const l3DragSec  = useRef(null)
  const l3DragSub  = useRef(null)
  const l3DragFrom = useRef(null)
  const l3DragTo   = useRef(null)
  const [l3DragId, setL3DragId] = useState(null)

  /* nav 변경 시 해당 섹션 자동 오픈 */
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
  useEffect(() => {
    localStorage.setItem(STORAGE_SUB_ORDER, JSON.stringify(subOrders))
  }, [subOrders])

  const toggleSection = (sec) => {
    const isOpen = !!open[sec.id]
    setOpen(prev => ({ ...prev, [sec.id]: !isOpen }))
    if (!isOpen) {
      const hiddenBuiltins = config.deletedBuiltinSubs?.[sec.id] || []
      const customSubsList = getCustomSubs?.(sec.id) || []
      const firstBuiltin   = (sec.subs || []).find(s => !hiddenBuiltins.includes(s.id))
      const firstSub       = firstBuiltin || customSubsList[0]
      if (firstSub) setNav({ section: sec.id, sub: firstSub.id, l3sub: null })
    }
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
      setNav({ section: sectionId, sub: subId, l3sub: l3subs[0].id })
    }
  }

  /* ── L1 섹션 드래그 핸들러 ── */
  const onDragStart = (e, idx) => {
    dragIdx.current = idx; setDragId(sections[idx].id)
    e.dataTransfer.effectAllowed = 'move'
  }
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

  /* ── L2 서브 드래그 핸들러 ── */
  const onSubDragStart = (e, secId, subIdx, subId) => {
    e.stopPropagation()
    subDragSec.current = secId; subDragFrom.current = subIdx; setSubDragId(subId)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onSubDragEnter = (e, subIdx) => {
    e.stopPropagation(); e.preventDefault()
    subDragTo.current = subIdx
  }
  const onSubDragOver  = e => { e.stopPropagation(); e.preventDefault() }
  const onSubDragEnd   = (e, secId, orderedSubs) => {
    e.stopPropagation()
    const from = subDragFrom.current, to = subDragTo.current
    if (from !== null && to !== null && from !== to && subDragSec.current === secId) {
      const newOrder = orderedSubs.map(s => s.id)
      const [item] = newOrder.splice(from, 1)
      newOrder.splice(to, 0, item)
      setSubOrders(prev => ({ ...prev, [secId]: newOrder }))
    }
    subDragSec.current = null; subDragFrom.current = null; subDragTo.current = null; setSubDragId(null)
  }

  /* ── L3 서서브 드래그 핸들러 ── */
  const onL3DragStart = (e, secId, subId, l3Idx, l3Id) => {
    e.stopPropagation()
    l3DragSec.current = secId; l3DragSub.current = subId
    l3DragFrom.current = l3Idx; setL3DragId(l3Id)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onL3DragEnter = (e, l3Idx) => {
    e.stopPropagation(); e.preventDefault()
    l3DragTo.current = l3Idx
  }
  const onL3DragOver  = e => { e.stopPropagation(); e.preventDefault() }
  const onL3DragEnd   = e => {
    e.stopPropagation()
    const from = l3DragFrom.current, to = l3DragTo.current
    const sec = l3DragSec.current, sub = l3DragSub.current
    if (from !== null && to !== null && from !== to && sec && sub) {
      reorderL3Subs?.(sec, sub, from, to)
    }
    l3DragSec.current = null; l3DragSub.current = null
    l3DragFrom.current = null; l3DragTo.current = null; setL3DragId(null)
  }

  /* ── 인라인 편집 input 렌더 헬퍼 (uncontrolled — 한글 IME 호환) ── */
  const InlineInput = ({ value, onCommit, onCancel }) => {
    const inputRef = useRef(null)
    const doCommit = () => { const v = inputRef.current?.value; onCommit(v) }
    return (
      <input
        ref={inputRef}
        autoFocus
        defaultValue={value}
        onBlur={doCommit}
        onKeyDown={e => {
          if (e.nativeEvent.isComposing) return
          if (e.key === 'Enter') { e.preventDefault(); doCommit() }
          if (e.key === 'Escape') { e.preventDefault(); onCancel() }
        }}
        onClick={e => e.stopPropagation()}
        className={`flex-1 min-w-0 px-1.5 py-0.5 rounded text-xs outline-none
          ${dark ? 'bg-[#2C333A] text-white border border-[#579DFF]' : 'bg-white text-slate-800 border border-[#0C66E4]'}`}
      />
    )
  }

  const t = dark
    ? { text:'text-slate-400', hover:'hover:bg-[#22272B] hover:text-white', border:'border-[#A1BDD914]' }
    : { text:'text-slate-700', hover:'hover:bg-slate-100 hover:text-slate-800', border:'border-slate-200' }

  /* config 값 */
  const projectName = config.projectName || 'Growth HQ'
  const logoUrl     = config.logoUrl || null

  return (
    <aside className={`flex flex-col w-[264px] min-h-screen shrink-0 border-r transition-colors duration-200
      ${dark ? 'bg-[#1D2125] border-[#A1BDD914]' : 'bg-white border-slate-200'}`}>

      {/* 로고 */}
      <div className={`flex items-center gap-2.5 px-6 py-6 border-b ${t.border}`}>
        {logoUrl ? (
          <img src={logoUrl} alt="logo" className="w-10 h-10 rounded-lg object-cover shrink-0"/>
        ) : (
          <div className="w-10 h-10 rounded-lg bg-[#0C66E4] flex items-center justify-center shrink-0">
            <BarChart2 size={20} className="text-white"/>
          </div>
        )}
        <span className={`font-bold text-[18px] truncate ${dark ? 'text-white' : 'text-slate-800'}`}>
          {projectName}
        </span>
      </div>

      {/* 네비 */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
        <p className={`px-3 pb-2 text-[11px] font-bold uppercase tracking-widest ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
          ≡ 드래그로 순서 변경
        </p>

        {sections.map((sec, idx) => {
          const isOpen     = !!open[sec.id]
          const isActive   = nav.section === sec.id
          const isDragging = dragId === sec.id

          /* 라벨 */
          const secLabel   = getSectionLabel?.(sec.id) || sec.label
          /* 아이콘 (config 오버라이드 → 기본값) */
          const secIcon    = config.sectionIcons?.[sec.id] || sec.icon

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

          /* L2 서브 순서 적용 */
          const savedSubOrder = subOrders[sec.id] || []
          const orderedSubs   = savedSubOrder.length
            ? [
                ...savedSubOrder.map(id => allSubs.find(s => s.id === id)).filter(Boolean),
                ...allSubs.filter(s => !savedSubOrder.includes(s.id)),
              ]
            : allSubs

          const isEditingSection = sidebarEdit?.type === 'section' && sidebarEdit?.key === sec.id

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
                onClick={() => { if (!isEditingSection) toggleSection(sec) }}
                className={`w-full flex items-center gap-2 px-3 py-3 rounded-lg text-sm transition-all duration-150 text-left group/sec
                  ${isActive ? dark ? 'text-white' : 'text-slate-800' : `${t.text} ${t.hover}`}`}
              >
                <GripVertical size={14}
                  className={`shrink-0 cursor-grab active:cursor-grabbing ${dark ? 'text-slate-600 group-hover/sec:text-slate-400' : 'text-slate-600 group-hover/sec:text-slate-700'}`}/>
                <Icon name={secIcon} size={17} className={isActive ? 'text-[#579DFF]' : 'opacity-80'}/>

                {isEditingSection ? (
                  <InlineInput
                    value={sidebarEdit.value}
                    onCommit={commitSidebarEdit}
                    onCancel={() => setSidebarEdit(null)}
                  />
                ) : (
                  <>
                    <span className="font-semibold flex-1 truncate">{secLabel}</span>
                    {/* 연필 버튼 (hover 시 표시) */}
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setSidebarEdit({ type: 'section', key: sec.id, value: secLabel })
                      }}
                      className={`opacity-0 group-hover/sec:opacity-100 p-0.5 rounded transition-opacity shrink-0
                        ${dark ? 'text-slate-500 hover:text-[#579DFF]' : 'text-slate-600 hover:text-[#0C66E4]'}`}
                      title="이름 변경"
                    >
                      <Pencil size={11}/>
                    </button>
                  </>
                )}

                {!isEditingSection && (
                  <ChevronDown size={14}
                    className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${dark ? 'text-slate-400' : 'text-slate-700'}`}/>
                )}
              </button>

              {/* 서브메뉴 */}
              {isOpen && (
                <div className="pl-5 pr-1 pb-1.5 flex flex-col gap-0.5">
                  {orderedSubs.map((sub, subIdx) => {
                    const subLabel    = getSubLabel?.(sec.id, sub.id) || sub.label
                    const subIcon     = config.subIcons?.[`${sec.id}.${sub.id}`] || sub.icon
                    const l3subs      = getL3Subs?.(sec.id, sub.id) || []
                    const hasL3Subs   = l3subs.length > 0
                    const l3key       = `${sec.id}.${sub.id}`
                    const l3IsOpen    = !!l3Open[l3key]
                    const l3subActive = isActive && nav.sub === sub.id && nav.l3sub && l3subs.some(s => s.id === nav.l3sub)
                    const subActive   = isActive && nav.sub === sub.id && !nav.l3sub
                    const anyActive   = subActive || l3subActive
                    const isSubDragging = subDragId === sub.id
                    const editKey     = `${sec.id}\x00${sub.id}`
                    const isEditingSub = sidebarEdit?.type === 'sub' && sidebarEdit?.key === editKey

                    return (
                      <div key={sub.id}
                        draggable
                        onDragStart={e => onSubDragStart(e, sec.id, subIdx, sub.id)}
                        onDragEnter={e => onSubDragEnter(e, subIdx)}
                        onDragOver={onSubDragOver}
                        onDragEnd={e => onSubDragEnd(e, sec.id, orderedSubs)}
                        className={`rounded-lg transition-all ${isSubDragging ? 'opacity-30' : ''}`}
                      >
                        <button
                          onClick={() => { if (!isEditingSub) handleSubClick(sec.id, sub.id) }}
                          className={`w-full flex items-center gap-1.5 px-2.5 py-2.5 rounded-lg text-sm transition-all duration-150 text-left group/sub
                            ${subActive ? 'bg-[#0C66E4] text-white'
                              : l3subActive ? dark ? 'bg-[#579DFF]/15 text-[#85B8FF]' : 'bg-[#E9F2FF] text-[#0055CC]'
                              : `${t.text} ${t.hover}`}`}
                        >
                          <GripVertical size={12}
                            className={`shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover/sub:opacity-100 transition-opacity
                              ${subActive ? 'text-white/50' : dark ? 'text-slate-400' : 'text-slate-700'}`}/>
                          <Icon name={subIcon} size={14} className={anyActive ? (subActive ? 'text-white' : 'text-[#579DFF]') : 'opacity-60'}/>

                          {isEditingSub ? (
                            <InlineInput
                              value={sidebarEdit.value}
                              onCommit={commitSidebarEdit}
                              onCancel={() => setSidebarEdit(null)}
                            />
                          ) : (
                            <>
                              <span className={`${anyActive ? 'font-semibold' : 'font-medium'} flex-1 truncate`}>{subLabel}</span>
                              {(() => {
                                const colorId = config.subColors?.[`${sec.id}.${sub.id}`]
                                const colorInfo = colorId && SUB_COLOR_OPTIONS.find(c => c.id === colorId)
                                return colorInfo ? (
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: colorInfo.hex }} title={colorInfo.label}/>
                                ) : null
                              })()}
                              <button
                                onClick={e => {
                                  e.stopPropagation()
                                  setSidebarEdit({ type: 'sub', key: editKey, value: subLabel })
                                }}
                                className={`opacity-0 group-hover/sub:opacity-100 p-0.5 rounded transition-opacity shrink-0
                                  ${subActive ? 'text-white/50 hover:text-white' : dark ? 'text-slate-500 hover:text-[#579DFF]' : 'text-slate-600 hover:text-[#0C66E4]'}`}
                                title="이름 변경"
                              >
                                <Pencil size={10}/>
                              </button>
                            </>
                          )}

                          {!isEditingSub && hasL3Subs && (
                            <ChevronDown size={12}
                              className={`shrink-0 transition-transform duration-200 ${l3IsOpen ? '' : '-rotate-90'}
                                ${anyActive ? (subActive ? 'text-white/70' : 'text-[#579DFF]') : dark ? 'text-slate-400' : 'text-slate-700'}`}
                            />
                          )}
                        </button>

                        {/* L3 서서브 목록 */}
                        {hasL3Subs && l3IsOpen && (
                          <div className="pl-7 pr-1 pb-0.5 flex flex-col gap-0.5">
                            {l3subs.map((ls, l3Idx) => {
                              const l3Active    = isActive && nav.sub === sub.id && nav.l3sub === ls.id
                              const isL3Dragging = l3DragId === ls.id
                              const l3Icon      = config.l3subIcons?.[`${sec.id}.${sub.id}.${ls.id}`] || null
                              const l3EditKey   = `${sec.id}\x00${sub.id}\x00${ls.id}`
                              const isEditingL3 = sidebarEdit?.type === 'l3sub' && sidebarEdit?.key === l3EditKey

                              return (
                                <div key={ls.id}
                                  draggable
                                  onDragStart={e => onL3DragStart(e, sec.id, sub.id, l3Idx, ls.id)}
                                  onDragEnter={e => onL3DragEnter(e, l3Idx)}
                                  onDragOver={onL3DragOver}
                                  onDragEnd={onL3DragEnd}
                                  className={`rounded-lg transition-all ${isL3Dragging ? 'opacity-30' : ''}`}
                                >
                                  <button
                                    onClick={() => { if (!isEditingL3) goTo(sec.id, sub.id, ls.id) }}
                                    className={`w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs transition-all duration-150 text-left group/l3
                                      ${l3Active ? 'bg-[#0C66E4] text-white' : `${t.text} ${t.hover}`}`}
                                  >
                                    <GripVertical size={11}
                                      className={`shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover/l3:opacity-100 transition-opacity
                                        ${l3Active ? 'text-white/50' : dark ? 'text-slate-400' : 'text-slate-700'}`}/>
                                    {l3Icon
                                      ? <Icon name={l3Icon} size={12} className={l3Active ? 'text-white' : 'opacity-60'}/>
                                      : <span className={`text-[10px] shrink-0 ${l3Active ? 'text-white/60' : dark ? 'text-slate-400' : 'text-slate-700'}`}>◆</span>
                                    }

                                    {isEditingL3 ? (
                                      <InlineInput
                                        value={sidebarEdit.value}
                                        onCommit={commitSidebarEdit}
                                        onCancel={() => setSidebarEdit(null)}
                                      />
                                    ) : (
                                      <>
                                        <span className={`${l3Active ? 'font-semibold' : 'font-medium'} flex-1 truncate`}>{ls.label}</span>
                                        <button
                                          onClick={e => {
                                            e.stopPropagation()
                                            setSidebarEdit({ type: 'l3sub', key: l3EditKey, value: ls.label })
                                          }}
                                          className={`opacity-0 group-hover/l3:opacity-100 p-0.5 rounded transition-opacity shrink-0
                                            ${l3Active ? 'text-white/50 hover:text-white' : dark ? 'text-slate-500 hover:text-[#579DFF]' : 'text-slate-600 hover:text-[#0C66E4]'}`}
                                          title="이름 변경"
                                        >
                                          <Pencil size={10}/>
                                        </button>
                                      </>
                                    )}
                                  </button>
                                </div>
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

      {/* 다크모드 토글 + 버전 */}
      <div className={`px-3 pb-5 border-t pt-4 ${t.border}`}>
        <button onClick={toggleDark}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all ${t.text} ${t.hover}`}>
          {dark ? <Sun size={16} className="text-yellow-400"/> : <Moon size={16} className="text-[#579DFF]"/>}
          <span className="font-medium">{dark ? 'Light Mode' : 'Dark Mode'}</span>
          <span className={`ml-auto text-xs ${dark ? 'text-slate-600' : 'text-slate-400'}`}>Ver {APP_VERSION}</span>
        </button>
      </div>
    </aside>
  )
}
