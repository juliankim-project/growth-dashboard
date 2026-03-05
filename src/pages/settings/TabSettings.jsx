import { useState, useRef, useEffect } from 'react'
import { DEFAULT_SECTIONS, ICON_LIST, Icon } from '../../components/Layout/Sidebar'
import { METRICS, SUB_TYPES, DEFAULT_SUB_TYPE } from '../../store/useConfig'
import {
  Pencil, Plus, Trash2, Check, X, ChevronRight, ChevronDown,
  LayoutDashboard, LayoutTemplate, Layers, Database, Eye, EyeOff,
  RefreshCw, GripVertical, Smile,
} from 'lucide-react'

/* 사이드바와 동일한 localStorage 키 — 순서를 공유함 */
const SIDEBAR_ORDER_KEY = 'sidebar_order_v2'

function buildOrderedSections(customSections) {
  const defaultDefs = DEFAULT_SECTIONS.map(s => ({ ...s, isCustom: false }))
  const customDefs  = (customSections || []).map(cs => ({
    id: cs.id, label: cs.label, isCustom: true, subs: [],
  }))
  const allDefs = [...defaultDefs, ...customDefs]
  try {
    const saved = JSON.parse(localStorage.getItem(SIDEBAR_ORDER_KEY) || '[]')
    if (saved.length) {
      return saved.map(id => allDefs.find(s => s.id === id)).filter(Boolean)
        .concat(allDefs.filter(s => !saved.includes(s.id)))
    }
  } catch {}
  return allDefs
}

/* ─────────────────────────────────────────
   인라인 이름 편집
───────────────────────────────────────── */
function EditableLabel({ value, onSave, dark, placeholder, size = 'base' }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value)

  const commit = () => { onSave(draft.trim() || value); setEditing(false) }
  const cancel = () => { setDraft(value); setEditing(false) }

  const textCls = size === 'sm'
    ? `text-[11px] font-medium ${dark ? 'text-slate-300' : 'text-slate-600'}`
    : `text-xs font-semibold ${dark ? 'text-white' : 'text-slate-800'}`

  if (editing) return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
        placeholder={placeholder}
        className={`px-2 py-0.5 rounded border text-xs outline-none
          ${size === 'sm' ? 'w-28' : 'w-36'}
          ${dark ? 'bg-[#13151C] border-indigo-500 text-white' : 'bg-white border-indigo-400 text-slate-700'}`}
      />
      <button onClick={commit}  className="p-0.5 text-emerald-400 hover:bg-emerald-400/10 rounded"><Check size={11}/></button>
      <button onClick={cancel}  className="p-0.5 text-slate-400   hover:bg-slate-400/10   rounded"><X     size={11}/></button>
    </div>
  )

  return (
    <div className="flex items-center gap-1 group/label">
      <span className={textCls}>{value}</span>
      <button
        onClick={() => { setDraft(value); setEditing(true) }}
        className={`opacity-0 group-hover/label:opacity-100 p-0.5 rounded transition-opacity
          ${dark ? 'text-slate-600 hover:text-indigo-400' : 'text-slate-300 hover:text-indigo-500'}`}
      >
        <Pencil size={10}/>
      </button>
    </div>
  )
}

/* ─────────────────────────────────────────
   아이콘 피커
───────────────────────────────────────── */
function IconPicker({ value, onChange, dark, size = 12 }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const btnRef = useRef()
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = (e) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const pickerH = 240, pickerW = 216
      const top = r.bottom + 4 + pickerH > window.innerHeight
        ? r.top - pickerH - 4
        : r.bottom + 4
      const left = Math.min(r.left, window.innerWidth - pickerW - 8)
      setPos({ top, left })
    }
    setOpen(o => !o)
  }

  return (
    <div className="shrink-0">
      <button
        ref={btnRef}
        onClick={handleOpen}
        title="아이콘 변경"
        className={`p-1 rounded transition-colors group/iconbtn
          ${open
            ? dark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
            : dark ? 'text-slate-500 hover:bg-[#252836] hover:text-slate-300' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'
          }`}
      >
        {value ? <Icon name={value} size={size}/> : <Smile size={size}/>}
      </button>

      {open && (
        <div
          ref={ref}
          className={`fixed z-[9999] p-2 rounded-xl border shadow-xl
            ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200'}`}
          style={{ width: 216, top: pos.top, left: pos.left }}
          onClick={e => e.stopPropagation()}
        >
          <p className={`text-[9px] font-bold uppercase tracking-wider mb-1.5 px-0.5
            ${dark ? 'text-slate-600' : 'text-slate-300'}`}>아이콘 선택</p>
          <div className="grid grid-cols-9 gap-0.5">
            {ICON_LIST.map((name, i) => (
              <button
                key={`${name}-${i}`}
                onClick={() => { onChange(name); setOpen(false) }}
                title={name}
                className={`p-1.5 rounded transition-colors
                  ${value === name
                    ? dark ? 'bg-indigo-500/25 text-indigo-300' : 'bg-indigo-50 text-indigo-600'
                    : dark ? 'text-slate-400 hover:bg-[#252836] hover:text-white' : 'text-slate-500 hover:bg-slate-100'
                  }`}
              >
                <Icon name={name} size={13}/>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────
   L2 데이터 소스 설정 패널
   - 테이블명 입력
   - 지표별 컬럼명 매핑 (비워두면 기본값)
───────────────────────────────────────── */
function DataSourcePanel({ sectionId, subId, getSubDataSource, setSubDataSource, dark }) {
  const ds       = getSubDataSource(sectionId, subId)
  const table    = ds.table    || 'marketing_data'
  const fieldMap = ds.fieldMap || {}

  const [tableInput, setTableInput] = useState(table)
  const [mapInputs,  setMapInputs]  = useState(() => {
    const init = {}
    METRICS.filter(m => !m.derived).forEach(m => { init[m.id] = fieldMap[m.id] || '' })
    return init
  })
  const [saved, setSaved] = useState(false)

  const commit = () => {
    const newFieldMap = {}
    Object.entries(mapInputs).forEach(([id, col]) => {
      if (col.trim()) newFieldMap[id] = col.trim()
    })
    setSubDataSource(sectionId, subId, {
      table:    tableInput.trim() || 'marketing_data',
      fieldMap: newFieldMap,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const reset = () => {
    setTableInput('marketing_data')
    setMapInputs(() => {
      const init = {}
      METRICS.filter(m => !m.derived).forEach(m => { init[m.id] = '' })
      return init
    })
    setSubDataSource(sectionId, subId, { table: 'marketing_data', fieldMap: {} })
  }

  const inp = `px-2 py-1 rounded-lg border text-xs outline-none w-full font-mono
    ${dark ? 'bg-[#0F1117] border-[#252836] text-white placeholder:text-slate-600'
           : 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-300'}`

  const lab = `text-[10px] font-bold uppercase tracking-wide ${dark ? 'text-slate-500' : 'text-slate-400'}`

  return (
    <div className={`mt-1.5 mb-2 mx-3 rounded-xl border p-4 flex flex-col gap-4
      ${dark ? 'bg-[#0F1117] border-[#252836]' : 'bg-slate-50 border-slate-200'}`}>

      <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest
        ${dark ? 'text-indigo-400' : 'text-indigo-600'}`}>
        <Database size={12}/> 데이터 소스 설정
      </div>

      {/* 테이블명 */}
      <div>
        <p className={`${lab} mb-1.5`}>Supabase 테이블명</p>
        <input
          className={inp}
          value={tableInput}
          onChange={e => setTableInput(e.target.value)}
          placeholder="marketing_data"
          list="ds-known-tables"
        />
        <datalist id="ds-known-tables">
          <option value="marketing_data"/>
        </datalist>
      </div>

      {/* 필드 매핑 */}
      <div>
        <p className={`${lab} mb-0.5`}>필드 매핑 <span className="normal-case font-normal text-slate-500">(비워두면 기본 컬럼명 사용)</span></p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
          {METRICS.filter(m => !m.derived).map(m => (
            <div key={m.id}>
              <p className={`text-[9px] mb-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                {m.label}
                <span className={`ml-1 font-mono ${dark ? 'text-slate-700' : 'text-slate-300'}`}>
                  ({m.field})
                </span>
              </p>
              <input
                className={inp}
                value={mapInputs[m.id] || ''}
                onChange={e => setMapInputs(prev => ({ ...prev, [m.id]: e.target.value }))}
                placeholder={m.field}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex items-center gap-2">
        <button
          onClick={commit}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors
            ${saved
              ? 'bg-emerald-500 text-white'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
        >
          <Check size={11}/> {saved ? '저장됨 ✓' : '저장'}
        </button>
        <button
          onClick={reset}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors
            ${dark ? 'border-[#252836] text-slate-400 hover:text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}
        >
          <RefreshCw size={11}/> 기본값으로
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   L4 탭 칩 목록 (구 L3TabsRow, l3subId 지원 추가)
───────────────────────────────────────── */
function L3TabsRow({ sectionId, subId, l3subId = null, getL3Tabs, addL3Tab, removeL3Tab, renameL3Tab, dark }) {
  const tabs = getL3Tabs(sectionId, subId, l3subId)
  const [adding,   setAdding]   = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [renaming, setRenaming] = useState(null)

  const commitAdd = () => {
    if (!newLabel.trim()) { setAdding(false); return }
    addL3Tab(sectionId, subId, newLabel.trim(), l3subId)
    setNewLabel('')
    setAdding(false)
  }

  const commitRename = () => {
    if (!renaming) return
    renameL3Tab(sectionId, subId, renaming.id, renaming.value.trim() || renaming.prev, l3subId)
    setRenaming(null)
  }

  const chipBase = `relative group/chip flex items-center gap-1 text-[10px] font-medium
    px-2 py-0.5 rounded-full border transition-colors`

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1 pb-1">
      {tabs.map(tab => (
        <div key={tab.id} className={`${chipBase}
          ${dark
            ? 'border-[#2A2E42] text-indigo-300 bg-indigo-500/10 hover:border-indigo-500/50'
            : 'border-indigo-100 text-indigo-600 bg-indigo-50 hover:border-indigo-300'}`}>
          {renaming?.id === tab.id ? (
            <input
              autoFocus
              value={renaming.value}
              onChange={e => setRenaming(r => ({ ...r, value: e.target.value }))}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter')  commitRename()
                if (e.key === 'Escape') setRenaming(null)
              }}
              className={`text-[10px] outline-none w-20 bg-transparent
                ${dark ? 'text-white' : 'text-slate-800'}`}
            />
          ) : (
            <span
              title="더블클릭으로 이름 변경"
              onDoubleClick={() => setRenaming({ id: tab.id, value: tab.label, prev: tab.label })}
              className="cursor-text select-none"
            >
              {tab.label}
            </span>
          )}
          <button
            onClick={() => { if (confirm(`"${tab.label}" 탭을 삭제할까요?`)) removeL3Tab(sectionId, subId, tab.id, l3subId) }}
            className="opacity-0 group-hover/chip:opacity-100 ml-0.5 text-[9px]
              leading-none hover:text-red-400 transition-opacity"
            title="탭 삭제"
          >×</button>
        </div>
      ))}

      {adding ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  commitAdd()
              if (e.key === 'Escape') { setAdding(false); setNewLabel('') }
            }}
            placeholder="탭 이름"
            className={`text-[10px] px-2 py-0.5 rounded-full border outline-none w-24
              ${dark
                ? 'border-indigo-500 bg-transparent text-white placeholder:text-slate-600'
                : 'border-indigo-300 bg-white text-slate-800 placeholder:text-slate-300'}`}
          />
          <button onClick={commitAdd}
            className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700">확인</button>
          <button onClick={() => { setAdding(false); setNewLabel('') }}
            className={`text-[10px] px-1.5 py-0.5 rounded-full ${dark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400'}`}>취소</button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className={`flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full border border-dashed transition-colors
            ${dark
              ? 'border-[#2A2E42] text-slate-500 hover:text-indigo-400 hover:border-indigo-500/50'
              : 'border-slate-200 text-slate-400 hover:text-indigo-500 hover:border-indigo-300'}`}
        >
          <Plus size={8}/> 하위탭
        </button>
      )}

      {tabs.length === 0 && !adding && (
        <span className={`text-[10px] italic ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
          탭 없음
        </span>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────
   L3 서서브 관리 (새 레벨)
───────────────────────────────────────── */
function L3SubsManager({ sectionId, subId, getL3Subs, addL3Sub, removeL3Sub, renameL3Sub, getL3Tabs, addL3Tab, removeL3Tab, renameL3Tab, dark, setL3SubIcon, config }) {
  const l3subs = getL3Subs(sectionId, subId)
  const [adding,    setAdding]    = useState(false)
  const [newLabel,  setNewLabel]  = useState('')

  const commitAdd = () => {
    if (!newLabel.trim()) { setAdding(false); return }
    addL3Sub(sectionId, subId, newLabel.trim())
    setNewLabel('')
    setAdding(false)
  }

  return (
    <div className={`ml-10 mr-3 mb-1 px-3 py-2 rounded-lg
      ${dark ? 'bg-[#13151C] border border-[#1E2130]' : 'bg-slate-50 border border-slate-100'}`}>

      {/* 헤더 */}
      <div className={`flex items-center gap-1.5 mb-2 text-[10px] font-bold uppercase tracking-widest
        ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
        <Layers size={10} className="text-emerald-400"/> 중위탭 서서브 (L3)
      </div>

      {/* L3 서서브 목록 — L4 탭은 항상 바로 노출 */}
      {l3subs.map(ls => (
        <div key={ls.id} className={`rounded-lg mb-2 border ${dark ? 'border-[#252836]' : 'border-slate-200'}`}>
          {/* 서서브 헤더 행 */}
          <div className="flex items-center gap-1.5 px-2 py-1.5 group/ls">
            {/* L3 아이콘 피커 */}
            <IconPicker
              value={config?.l3subIcons?.[`${sectionId}.${subId}.${ls.id}`] || null}
              onChange={icon => setL3SubIcon?.(sectionId, subId, ls.id, icon)}
              dark={dark}
              size={10}
            />
            <EditableLabel
              value={ls.label}
              placeholder={ls.label}
              dark={dark}
              size="sm"
              onSave={label => renameL3Sub(sectionId, subId, ls.id, label)}
            />
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => { if (confirm(`"${ls.label}" 서서브를 삭제할까요?\n해당 서서브의 탭과 대시보드가 모두 삭제됩니다.`)) removeL3Sub(sectionId, subId, ls.id) }}
                className="opacity-0 group-hover/ls:opacity-100 p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-opacity"
              >
                <Trash2 size={10}/>
              </button>
            </div>
          </div>

          {/* L4 탭 영역 — 항상 노출 */}
          <div className={`mx-2 mb-2 px-2 py-1.5 rounded-lg
            ${dark ? 'bg-[#0F1117] border border-[#1E2130]' : 'bg-white border border-slate-100'}`}>
            <div className={`flex items-center gap-1 mb-1 text-[9px] font-bold uppercase tracking-widest
              ${dark ? 'text-slate-700' : 'text-slate-300'}`}>
              <Layers size={9} className="text-violet-400"/> 하위탭 (L4)
            </div>
            <L3TabsRow
              sectionId={sectionId}
              subId={subId}
              l3subId={ls.id}
              getL3Tabs={getL3Tabs}
              addL3Tab={addL3Tab}
              removeL3Tab={removeL3Tab}
              renameL3Tab={renameL3Tab}
              dark={dark}
            />
          </div>
        </div>
      ))}

      {/* 추가 버튼 */}
      {adding ? (
        <div className="flex items-center gap-1.5 mt-1">
          <input
            autoFocus
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  commitAdd()
              if (e.key === 'Escape') { setAdding(false); setNewLabel('') }
            }}
            placeholder="서서브 이름"
            className={`text-[10px] px-2 py-0.5 rounded-lg border outline-none w-28
              ${dark
                ? 'border-indigo-500 bg-transparent text-white placeholder:text-slate-600'
                : 'border-indigo-300 bg-white text-slate-800 placeholder:text-slate-300'}`}
          />
          <button onClick={commitAdd}
            className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">확인</button>
          <button onClick={() => { setAdding(false); setNewLabel('') }}
            className={`text-[10px] px-1.5 py-0.5 rounded ${dark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400'}`}>취소</button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg border border-dashed transition-colors mt-1
            ${dark
              ? 'border-[#2A2E42] text-slate-500 hover:text-emerald-400 hover:border-emerald-500/50'
              : 'border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-300'}`}
        >
          <Plus size={8}/> 서서브 추가
        </button>
      )}

      {l3subs.length === 0 && !adding && (
        <p className={`text-[10px] italic mt-0.5 ${dark ? 'text-slate-700' : 'text-slate-300'}`}>
          서서브 없음
        </p>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────
   L2 서브탭 행 (빌트인 + 커스텀 공통)
───────────────────────────────────────── */
function SubRow({
  sectionId, sub, isCustom, isHidden,
  config, dark,
  onUpdateSub, onRemoveSub, onHideBuiltinSub, onShowBuiltinSub,
  getL3Subs, addL3Sub, removeL3Sub, renameL3Sub,
  getL3Tabs, addL3Tab, removeL3Tab, renameL3Tab,
  getSubDataSource, setSubDataSource,
  setSubIcon, setL3SubIcon,
  getSubType, setSubType,
}) {
  const [open,    setOpen]    = useState(false)
  const [showDS,  setShowDS]  = useState(false)

  const key         = `${sectionId}.${sub.id}`
  const label       = config.subLabels[key] || sub.label
  const l3SubsCount = getL3Subs(sectionId, sub.id).length
  const l3Count     = getL3Tabs(sectionId, sub.id).length
  const ds          = getSubDataSource(sectionId, sub.id)
  const hasCustomDS = ds.table !== 'marketing_data' || Object.keys(ds.fieldMap || {}).length > 0
  const subType     = getSubType?.(sectionId, sub.id) || DEFAULT_SUB_TYPE
  const typeInfo    = SUB_TYPES[subType]

  if (isHidden) {
    /* 숨겨진 빌트인: 흐릿하게 표시 + 복원 버튼 */
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg opacity-50
        ${dark ? 'hover:opacity-70' : 'hover:opacity-70'}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${dark ? 'bg-slate-700' : 'bg-slate-200'}`}/>
        <span className={`text-[11px] line-through ${dark ? 'text-slate-600' : 'text-slate-400'}`}>{label}</span>
        <span className={`text-[9px] px-1.5 py-0.5 rounded ml-1 ${dark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-500'}`}>숨김</span>
        <button
          onClick={() => onShowBuiltinSub(sectionId, sub.id)}
          className={`ml-auto flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg transition-colors
            ${dark ? 'text-indigo-400 hover:bg-indigo-500/10' : 'text-indigo-600 hover:bg-indigo-50'}`}
        >
          <Eye size={10}/> 복원
        </button>
      </div>
    )
  }

  return (
    <div className={`rounded-lg transition-colors ${dark ? 'hover:bg-[#13151C]/60' : 'hover:bg-slate-50'}`}>
      {/* 서브탭 헤더 행 */}
      <div className="flex items-center gap-2 px-3 py-2 group/sub">
        {/* L3 확장 토글 */}
        <button
          onClick={() => setOpen(o => !o)}
          className={`shrink-0 transition-colors ${dark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'}`}
        >
          {open ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
        </button>

        {/* L2 아이콘 피커 */}
        <IconPicker
          value={config.subIcons?.[`${sectionId}.${sub.id}`] || sub.icon || null}
          onChange={icon => setSubIcon?.(sectionId, sub.id, icon)}
          dark={dark}
          size={11}
        />

        {/* 이름 편집 */}
        <EditableLabel
          value={label}
          placeholder={sub.label}
          dark={dark}
          size="sm"
          onSave={newLabel => onUpdateSub(sectionId, sub.id, newLabel)}
        />

        <div className="flex items-center gap-1.5 ml-auto">
          {/* 탭 타입 뱃지 */}
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${dark ? typeInfo.colorClasses.badge : typeInfo.colorClasses.badgeLight}`}>
            {typeInfo.icon} {typeInfo.label}
          </span>

          {/* 데이터 소스 설정 버튼 */}
          <button
            onClick={() => setShowDS(d => !d)}
            title="데이터 소스 설정"
            className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded border transition-colors
              ${showDS || hasCustomDS
                ? dark ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-400' : 'border-indigo-300 bg-indigo-50 text-indigo-600'
                : dark ? 'border-[#252836] text-slate-500 hover:text-indigo-400 hover:border-indigo-500/40'
                       : 'border-slate-200 text-slate-400 hover:text-indigo-500 hover:border-indigo-300'}`}
          >
            <Database size={9}/> {hasCustomDS ? '소스 설정됨' : '소스'}
          </button>

          {/* L3 서서브 수 배지 */}
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full
            ${l3SubsCount > 0
              ? dark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
              : dark ? 'bg-[#252836] text-slate-600' : 'bg-slate-100 text-slate-400'}`}>
            L3 · {l3SubsCount}
          </span>

          {/* L4 탭 수 배지 (직접 탭) */}
          {l3Count > 0 && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full
              ${dark ? 'bg-indigo-500/15 text-indigo-400' : 'bg-indigo-50 text-indigo-500'}`}>
              L4 · {l3Count}
            </span>
          )}

          {/* 삭제 / 숨기기 */}
          {isCustom ? (
            <button
              onClick={() => { if (confirm(`"${label}" 하위탭을 삭제할까요?`)) onRemoveSub(sectionId, sub.id) }}
              className="opacity-0 group-hover/sub:opacity-100 p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-opacity"
            >
              <Trash2 size={11}/>
            </button>
          ) : (
            <button
              onClick={() => { if (confirm(`"${label}" 탭을 사이드바에서 숨길까요?\n탭 설정에서 복원할 수 있어요.`)) onHideBuiltinSub(sectionId, sub.id) }}
              className="opacity-0 group-hover/sub:opacity-100 p-1 rounded text-slate-400 hover:text-orange-400 hover:bg-orange-400/10 transition-opacity"
              title="사이드바에서 숨기기"
            >
              <EyeOff size={11}/>
            </button>
          )}
        </div>
      </div>

      {/* 데이터 소스 패널 */}
      {showDS && (
        <DataSourcePanel
          sectionId={sectionId}
          subId={sub.id}
          getSubDataSource={getSubDataSource}
          setSubDataSource={setSubDataSource}
          dark={dark}
        />
      )}

      {/* L3 서서브 + L4 탭 영역 */}
      {open && (
        <>
          {/* 탭 타입 선택 */}
          <div className={`ml-10 mr-3 mb-1 px-3 py-2 rounded-lg
            ${dark ? 'bg-[#13151C] border border-[#1E2130]' : 'bg-slate-50 border border-slate-100'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5
              ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
              탭 타입
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {Object.values(SUB_TYPES).map(st => (
                <button key={st.id}
                  onClick={() => setSubType?.(sectionId, sub.id, st.id)}
                  className={`flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg border transition-colors
                    ${subType === st.id
                      ? st.colorClasses.btnActive + ' border-transparent'
                      : dark
                        ? 'border-[#252836] ' + st.colorClasses.btnIdle
                        : 'border-slate-200 ' + st.colorClasses.btnIdleLight}`}
                >
                  <span>{st.icon}</span>
                  <span className="font-medium">{st.label}</span>
                </button>
              ))}
            </div>
            <p className={`text-[9px] mt-1 ${dark ? 'text-slate-600' : 'text-slate-400'}`}>
              {typeInfo.desc}
            </p>
          </div>

          {/* L3 서서브 관리 */}
          <L3SubsManager
            sectionId={sectionId}
            subId={sub.id}
            getL3Subs={getL3Subs}
            addL3Sub={addL3Sub}
            removeL3Sub={removeL3Sub}
            renameL3Sub={renameL3Sub}
            getL3Tabs={getL3Tabs}
            addL3Tab={addL3Tab}
            removeL3Tab={removeL3Tab}
            renameL3Tab={renameL3Tab}
            dark={dark}
            setL3SubIcon={setL3SubIcon}
            config={config}
          />

          {/* 기본 직접 하위탭 (L3 없이 직접 연결된 L4) */}
          <div className={`ml-10 mr-3 mb-2 px-3 py-2 rounded-lg
            ${dark ? 'bg-[#13151C] border border-[#1E2130]' : 'bg-slate-50 border border-slate-100'}`}>
            <div className={`flex items-center gap-1.5 mb-1.5 text-[10px] font-bold uppercase tracking-widest
              ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
              <Layers size={10} className="text-violet-400"/> 기본 하위탭 (L4, 서서브 없을 때)
            </div>
            <L3TabsRow
              sectionId={sectionId}
              subId={sub.id}
              l3subId={null}
              getL3Tabs={getL3Tabs}
              addL3Tab={addL3Tab}
              removeL3Tab={removeL3Tab}
              renameL3Tab={renameL3Tab}
              dark={dark}
            />
          </div>
        </>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────
   새 L2 서브탭 추가 행
───────────────────────────────────────── */
function AddSubRow({ onAdd, dark }) {
  const [show,  setShow]  = useState(false)
  const [label, setLabel] = useState('')
  const [subType, setSubType] = useState('report')

  const submit = () => {
    if (!label.trim()) return
    onAdd(label.trim(), subType)
    setLabel('')
    setSubType('report')
    setShow(false)
  }

  if (!show) return (
    <button
      onClick={() => setShow(true)}
      className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg transition-colors mt-0.5
        ${dark ? 'text-indigo-400 hover:bg-indigo-500/10' : 'text-indigo-500 hover:bg-indigo-50'}`}
    >
      <Plus size={11}/> 하위탭 추가
    </button>
  )

  return (
    <div className="flex flex-col gap-2 mt-0.5 px-3">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') { setShow(false); setSubType('report') } }}
          placeholder="탭 이름 입력..."
          className={`px-2.5 py-1.5 rounded-lg border text-xs outline-none w-40
            ${dark ? 'bg-[#13151C] border-indigo-500 text-white placeholder:text-slate-600' : 'bg-white border-indigo-400 text-slate-700 placeholder:text-slate-300'}`}
        />
        <button onClick={submit}
          className="px-2.5 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700">추가</button>
        <button onClick={() => { setShow(false); setSubType('report') }}
          className={`px-2 py-1.5 text-xs rounded-lg ${dark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>취소</button>
      </div>
      <div className="flex gap-1.5">
        {Object.values(SUB_TYPES).map(st => (
          <button key={st.id}
            onClick={() => setSubType(st.id)}
            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition-colors
              ${subType === st.id
                ? st.colorClasses.btnActive + ' border-transparent'
                : dark
                  ? 'border-[#252836] ' + st.colorClasses.btnIdle
                  : 'border-slate-200 ' + st.colorClasses.btnIdleLight}`}
          >
            <span>{st.icon}</span>
            <span>{st.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   메인 컴포넌트
───────────────────────────────────────── */
export default function TabSettings({
  dark, config,
  onUpdateSection, onUpdateSub,
  onAddSub, onRemoveSub,
  onHideBuiltinSub, onShowBuiltinSub,
  getL3Subs, addL3Sub, removeL3Sub, renameL3Sub,
  getL3Tabs, addL3Tab, removeL3Tab, renameL3Tab,
  getSubDataSource, setSubDataSource,
  getSubType, setSubType,
  customSections = [], addCustomSection, removeCustomSection,
  setSectionIcon, setSubIcon, setL3SubIcon,
}) {
  const [openSections,   setOpenSections]   = useState(() => {
    const init = {}
    DEFAULT_SECTIONS.forEach(s => { init[s.id] = true })
    ;(customSections || []).forEach(cs => { init[cs.id] = true })
    return init
  })
  const [addingSection,  setAddingSection]  = useState(false)
  const [newSecLabel,    setNewSecLabel]    = useState('')

  /* ── 사이드바 순서와 동기화된 섹션 목록 ── */
  const [orderedSections, setOrderedSections] = useState(() => buildOrderedSections(customSections))

  const customSectionsKey = (customSections || []).map(s => s.id).join(',')
  useEffect(() => {
    const defaultDefs = DEFAULT_SECTIONS.map(s => ({ ...s, isCustom: false }))
    const customDefs  = (customSections || []).map(cs => ({
      id: cs.id, label: cs.label, isCustom: true, subs: [],
    }))
    setOrderedSections(prev => {
      const allDefs = [...defaultDefs, ...customDefs]
      const filtered = prev.filter(s => allDefs.some(d => d.id === s.id))
      const existingIds = filtered.map(s => s.id)
      const toAdd = allDefs.filter(d => !existingIds.includes(d.id))
      return [...filtered, ...toAdd]
    })
    setOpenSections(prev => {
      const next = { ...prev }
      ;(customSections || []).forEach(cs => { if (!(cs.id in next)) next[cs.id] = true })
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customSectionsKey])

  /* 순서 변경 시 localStorage 저장 (사이드바와 공유) */
  useEffect(() => {
    localStorage.setItem(SIDEBAR_ORDER_KEY, JSON.stringify(orderedSections.map(s => s.id)))
  }, [orderedSections])

  /* ── 드래그 핸들러 ── */
  const dragIdx = useRef(null)
  const overIdx = useRef(null)
  const [dragId, setDragId] = useState(null)

  const onDragStart = (e, idx) => {
    dragIdx.current = idx; setDragId(orderedSections[idx].id)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDragEnter = (e, idx) => { overIdx.current = idx; e.preventDefault() }
  const onDragOver  = e => e.preventDefault()
  const onDragEnd   = () => {
    const from = dragIdx.current, to = overIdx.current
    if (from !== null && to !== null && from !== to) {
      const next = [...orderedSections]; const [m] = next.splice(from, 1); next.splice(to, 0, m)
      setOrderedSections(next)
    }
    dragIdx.current = null; overIdx.current = null; setDragId(null)
  }

  const toggleSection = (id) =>
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }))

  const commitAddSection = () => {
    if (!newSecLabel.trim()) { setAddingSection(false); return }
    addCustomSection?.(newSecLabel.trim())
    setNewSecLabel('')
    setAddingSection(false)
  }

  return (
    <div className="p-6 flex flex-col gap-4 max-w-2xl">
      {/* 헤더 */}
      <div>
        <h2 className={`text-base font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>탭 설정</h2>
        <p className={`text-xs mt-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          L1(메인탭) → L2(상위탭) → L3(중위탭/서서브) → L4(하위탭) 4단계 구조를 관리합니다.
          빌트인 탭은 <EyeOff size={10} className="inline"/> 숨기기 / <Eye size={10} className="inline"/> 복원 가능하고,
          커스텀 탭은 <Trash2 size={10} className="inline"/> 으로 완전 삭제할 수 있어요.
        </p>
      </div>

      {/* 범례 */}
      <div className={`flex flex-wrap items-center gap-4 px-4 py-2.5 rounded-xl text-[10px]
        ${dark ? 'bg-[#1A1D27] border border-[#252836]' : 'bg-slate-50 border border-slate-100'}`}>
        <div className="flex items-center gap-1.5">
          <GripVertical size={10} className={dark ? 'text-slate-500' : 'text-slate-400'}/>
          <span className={dark ? 'text-slate-500' : 'text-slate-400'}>드래그로 L1 순서 변경 (사이드바 연동)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <LayoutDashboard size={10} className="text-indigo-400"/>
          <span className={dark ? 'text-slate-500' : 'text-slate-400'}>L1 · 메인탭 (사이드바 섹션)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <LayoutTemplate size={10} className="text-sky-400"/>
          <span className={dark ? 'text-slate-500' : 'text-slate-400'}>L2 · 상위탭 (사이드바 서브)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Layers size={10} className="text-emerald-400"/>
          <span className={dark ? 'text-slate-500' : 'text-slate-400'}>L3 · 중위탭 (사이드바 서서브)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Layers size={10} className="text-violet-400"/>
          <span className={dark ? 'text-slate-500' : 'text-slate-400'}>L4 · 하위탭 (페이지 내 탭)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Database size={10} className="text-amber-400"/>
          <span className={dark ? 'text-slate-500' : 'text-slate-400'}>소스 · 테이블 + 필드 매핑</span>
        </div>
      </div>

      {/* ── 섹션 목록 (사이드바 순서와 동일 · 드래그로 순서 변경 가능) ── */}
      {orderedSections.map((section, idx) => {
        const isCustomSection = section.isCustom
        const isOpen          = !!openSections[section.id]
        const sectionLabel    = config.sectionLabels[section.id] || section.label
        const customSubs      = config.customSubs[section.id] || []
        const hiddenBuiltins  = isCustomSection ? [] : (config.deletedBuiltinSubs?.[section.id] || [])
        const isDragging      = dragId === section.id

        const allSubs = [
          ...(isCustomSection ? [] : (section.subs || []).map(s => ({
            ...s, isCustom: false, isHidden: hiddenBuiltins.includes(s.id),
          }))),
          ...customSubs.map(cs => ({
            id: cs.id, label: cs.label, isCustom: true, isHidden: false,
          })),
        ]

        const visibleCount = allSubs.filter(s => !s.isHidden).length
        const hiddenCount  = allSubs.filter(s =>  s.isHidden).length

        return (
          <div key={section.id}
            draggable
            onDragStart={e => onDragStart(e, idx)}
            onDragEnter={e => onDragEnter(e, idx)}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            className={`rounded-xl border overflow-hidden transition-all
              ${isDragging ? 'opacity-30 scale-[0.99]' : ''}
              ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>

            {/* ── L1 섹션 헤더 ── */}
            <div
              className={`flex items-center gap-3 px-4 py-3 border-b cursor-pointer group/sec
                ${dark ? 'border-[#252836] bg-[#13151C] hover:bg-[#0F1117]' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}
              onClick={() => toggleSection(section.id)}
            >
              {/* 드래그 핸들 */}
              <GripVertical size={13}
                className={`shrink-0 cursor-grab active:cursor-grabbing
                  ${dark ? 'text-slate-700 group-hover/sec:text-slate-500' : 'text-slate-300 group-hover/sec:text-slate-400'}`}
                onClick={e => e.stopPropagation()}
              />

              <span className={`shrink-0 transition-transform duration-200
                ${dark ? 'text-slate-600' : 'text-slate-300'}
                ${isOpen ? 'rotate-90' : ''}`}>
                <ChevronRight size={14}/>
              </span>

              <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0
                ${dark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-500'}`}>
                L1
              </span>

              {/* L1 아이콘 피커 */}
              <div onClick={e => e.stopPropagation()}>
                <IconPicker
                  value={config.sectionIcons?.[section.id] || section.icon || null}
                  onChange={icon => setSectionIcon?.(section.id, icon)}
                  dark={dark}
                  size={13}
                />
              </div>

              <div onClick={e => e.stopPropagation()}>
                <EditableLabel
                  value={sectionLabel}
                  placeholder={section.label}
                  dark={dark}
                  onSave={label => onUpdateSection(section.id, label)}
                />
              </div>

              {config.sectionLabels[section.id] && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded ml-1
                  ${dark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                  변경됨
                </span>
              )}

              <div className={`ml-auto flex items-center gap-2 text-[10px] ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
                <span>L2 · {visibleCount}개</span>
                {hiddenCount > 0 && (
                  <span className={`px-1.5 py-0.5 rounded text-[9px]
                    ${dark ? 'bg-orange-500/10 text-orange-400' : 'bg-orange-50 text-orange-500'}`}>
                    숨김 {hiddenCount}
                  </span>
                )}
                {isCustomSection && (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      if (confirm(`"${sectionLabel}" 메인탭을 삭제할까요?\n하위 모든 탭과 대시보드 데이터가 삭제됩니다.`))
                        removeCustomSection?.(section.id)
                    }}
                    className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    title="메인탭 삭제"
                  >
                    <Trash2 size={12}/>
                  </button>
                )}
              </div>
            </div>

            {/* ── L2 서브탭 목록 ── */}
            {isOpen && (
              <div className="px-2 py-2 flex flex-col gap-0.5">
                <p className={`flex items-center gap-1.5 px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest
                  ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
                  <LayoutTemplate size={10} className="text-sky-400"/> 상위탭 (L2)
                </p>
                {allSubs.map(sub => (
                  <SubRow
                    key={sub.id}
                    sectionId={section.id}
                    sub={sub}
                    isCustom={sub.isCustom}
                    isHidden={sub.isHidden}
                    config={config}
                    dark={dark}
                    onUpdateSub={onUpdateSub}
                    onRemoveSub={onRemoveSub}
                    onHideBuiltinSub={onHideBuiltinSub}
                    onShowBuiltinSub={onShowBuiltinSub}
                    getL3Subs={getL3Subs}
                    addL3Sub={addL3Sub}
                    removeL3Sub={removeL3Sub}
                    renameL3Sub={renameL3Sub}
                    getL3Tabs={getL3Tabs}
                    addL3Tab={addL3Tab}
                    removeL3Tab={removeL3Tab}
                    renameL3Tab={renameL3Tab}
                    getSubDataSource={getSubDataSource}
                    setSubDataSource={setSubDataSource}
                    setSubIcon={setSubIcon}
                    setL3SubIcon={setL3SubIcon}
                    getSubType={getSubType}
                    setSubType={setSubType}
                  />
                ))}
                <AddSubRow dark={dark} onAdd={(label, subType) => onAddSub(section.id, label, subType)} />
              </div>
            )}
          </div>
        )
      })}

      {/* ── 메인탭 추가 버튼 ── */}
      <div className={`rounded-xl border border-dashed p-4
        ${dark ? 'border-[#252836]' : 'border-slate-200'}`}>
        {addingSection ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={newSecLabel}
              onChange={e => setNewSecLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitAddSection(); if (e.key === 'Escape') { setAddingSection(false); setNewSecLabel('') } }}
              placeholder="메인탭 이름 입력..."
              className={`flex-1 px-3 py-2 rounded-lg border text-sm outline-none
                ${dark ? 'bg-[#13151C] border-indigo-500 text-white placeholder:text-slate-600' : 'bg-white border-indigo-400 text-slate-700 placeholder:text-slate-300'}`}
            />
            <button onClick={commitAddSection}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700">추가</button>
            <button onClick={() => { setAddingSection(false); setNewSecLabel('') }}
              className={`px-3 py-2 text-sm rounded-lg ${dark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>취소</button>
          </div>
        ) : (
          <button
            onClick={() => setAddingSection(true)}
            className={`w-full flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors
              ${dark ? 'text-slate-500 hover:text-indigo-400' : 'text-slate-400 hover:text-indigo-600'}`}
          >
            <Plus size={15}/> 메인탭 추가 (L1)
          </button>
        )}
      </div>
    </div>
  )
}
