import { useState } from 'react'
import { DEFAULT_SECTIONS } from '../../components/Layout/Sidebar'
import { METRICS } from '../../store/useConfig'
import {
  Pencil, Plus, Trash2, Check, X, ChevronRight, ChevronDown,
  LayoutDashboard, LayoutTemplate, Layers, Database, Eye, EyeOff,
  RefreshCw
} from 'lucide-react'

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
   L2 데이터 소스 설정 패널
   - 테이블명 입력
   - 지표별 컬럼명 매핑 (비워두면 기본값)
───────────────────────────────────────── */
function DataSourcePanel({ sectionId, subId, getSubDataSource, setSubDataSource, dark }) {
  const ds       = getSubDataSource(sectionId, subId)
  const table    = ds.table    || 'marketing_perf'
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
      table:    tableInput.trim() || 'marketing_perf',
      fieldMap: newFieldMap,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const reset = () => {
    setTableInput('marketing_perf')
    setMapInputs(() => {
      const init = {}
      METRICS.filter(m => !m.derived).forEach(m => { init[m.id] = '' })
      return init
    })
    setSubDataSource(sectionId, subId, { table: 'marketing_perf', fieldMap: {} })
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
          placeholder="marketing_perf"
          list="ds-known-tables"
        />
        <datalist id="ds-known-tables">
          <option value="marketing_perf"/>
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
   L3 탭 칩 목록
───────────────────────────────────────── */
function L3TabsRow({ sectionId, subId, getL3Tabs, addL3Tab, removeL3Tab, renameL3Tab, dark }) {
  const tabs = getL3Tabs(sectionId, subId)
  const [adding,   setAdding]   = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [renaming, setRenaming] = useState(null)

  const commitAdd = () => {
    if (!newLabel.trim()) { setAdding(false); return }
    addL3Tab(sectionId, subId, newLabel.trim())
    setNewLabel('')
    setAdding(false)
  }

  const commitRename = () => {
    if (!renaming) return
    renameL3Tab(sectionId, subId, renaming.id, renaming.value.trim() || renaming.prev)
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
            onClick={() => { if (confirm(`"${tab.label}" 탭을 삭제할까요?`)) removeL3Tab(sectionId, subId, tab.id) }}
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
   L2 서브탭 행 (빌트인 + 커스텀 공통)
───────────────────────────────────────── */
function SubRow({
  sectionId, sub, isCustom, isHidden,
  config, dark,
  onUpdateSub, onRemoveSub, onHideBuiltinSub, onShowBuiltinSub,
  getL3Tabs, addL3Tab, removeL3Tab, renameL3Tab,
  getSubDataSource, setSubDataSource,
}) {
  const [open,    setOpen]    = useState(false)
  const [showDS,  setShowDS]  = useState(false)

  const key       = `${sectionId}.${sub.id}`
  const label     = config.subLabels[key] || sub.label
  const l3Count   = getL3Tabs(sectionId, sub.id).length
  const ds        = getSubDataSource(sectionId, sub.id)
  const hasCustomDS = ds.table !== 'marketing_perf' || Object.keys(ds.fieldMap || {}).length > 0

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

        {/* 색상 dot */}
        <div className={`w-1.5 h-1.5 rounded-full shrink-0
          ${isCustom ? 'bg-indigo-500' : dark ? 'bg-slate-600' : 'bg-slate-300'}`}/>

        {/* 이름 편집 */}
        <EditableLabel
          value={label}
          placeholder={sub.label}
          dark={dark}
          size="sm"
          onSave={newLabel => onUpdateSub(sectionId, sub.id, newLabel)}
        />

        <div className="flex items-center gap-1.5 ml-auto">
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

          {/* L3 탭 수 배지 */}
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full
            ${l3Count > 0
              ? dark ? 'bg-indigo-500/15 text-indigo-400' : 'bg-indigo-50 text-indigo-500'
              : dark ? 'bg-[#252836] text-slate-600' : 'bg-slate-100 text-slate-400'}`}>
            L3 · {l3Count}
          </span>

          {/* 커스텀 배지 */}
          {isCustom && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded ${dark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-500'}`}>
              커스텀
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

      {/* L3 탭 영역 */}
      {open && (
        <div className={`ml-10 mr-3 mb-2 px-3 py-2 rounded-lg
          ${dark ? 'bg-[#13151C] border border-[#1E2130]' : 'bg-slate-50 border border-slate-100'}`}>
          <div className={`flex items-center gap-1.5 mb-1.5 text-[10px] font-bold uppercase tracking-widest
            ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
            <Layers size={10}/> 하위탭 (L3)
          </div>
          <L3TabsRow
            sectionId={sectionId}
            subId={sub.id}
            getL3Tabs={getL3Tabs}
            addL3Tab={addL3Tab}
            removeL3Tab={removeL3Tab}
            renameL3Tab={renameL3Tab}
            dark={dark}
          />
        </div>
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

  const submit = () => {
    if (!label.trim()) return
    onAdd(label.trim())
    setLabel('')
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
    <div className="flex items-center gap-2 mt-0.5 px-3">
      <input
        autoFocus
        value={label}
        onChange={e => setLabel(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setShow(false) }}
        placeholder="탭 이름 입력..."
        className={`px-2.5 py-1.5 rounded-lg border text-xs outline-none w-40
          ${dark ? 'bg-[#13151C] border-indigo-500 text-white placeholder:text-slate-600' : 'bg-white border-indigo-400 text-slate-700 placeholder:text-slate-300'}`}
      />
      <button onClick={submit}
        className="px-2.5 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700">추가</button>
      <button onClick={() => setShow(false)}
        className={`px-2 py-1.5 text-xs rounded-lg ${dark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>취소</button>
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
  getL3Tabs, addL3Tab, removeL3Tab, renameL3Tab,
  getSubDataSource, setSubDataSource,
}) {
  const [openSections, setOpenSections] = useState(() => {
    const init = {}
    DEFAULT_SECTIONS.forEach(s => { init[s.id] = true })
    return init
  })

  const toggleSection = (id) =>
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className="p-6 flex flex-col gap-4 max-w-2xl overflow-y-auto">
      {/* 헤더 */}
      <div>
        <h2 className={`text-base font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>탭 설정</h2>
        <p className={`text-xs mt-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          L1(메인탭) → L2(중위탭) → L3(하위탭) 3단계 구조를 관리합니다.
          빌트인 탭은 <EyeOff size={10} className="inline"/> 숨기기 / <Eye size={10} className="inline"/> 복원 가능하고,
          커스텀 탭은 <Trash2 size={10} className="inline"/> 으로 완전 삭제할 수 있어요.
        </p>
      </div>

      {/* 범례 */}
      <div className={`flex flex-wrap items-center gap-4 px-4 py-2.5 rounded-xl text-[10px]
        ${dark ? 'bg-[#1A1D27] border border-[#252836]' : 'bg-slate-50 border border-slate-100'}`}>
        <div className="flex items-center gap-1.5">
          <LayoutDashboard size={10} className="text-indigo-400"/>
          <span className={dark ? 'text-slate-500' : 'text-slate-400'}>L1 · 메인탭 (사이드바 섹션)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <LayoutTemplate size={10} className="text-emerald-400"/>
          <span className={dark ? 'text-slate-500' : 'text-slate-400'}>L2 · 중위탭 (사이드바 서브)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Layers size={10} className="text-violet-400"/>
          <span className={dark ? 'text-slate-500' : 'text-slate-400'}>L3 · 하위탭 (페이지 내 탭)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Database size={10} className="text-amber-400"/>
          <span className={dark ? 'text-slate-500' : 'text-slate-400'}>소스 · 테이블 + 필드 매핑</span>
        </div>
      </div>

      {/* 섹션 목록 */}
      {DEFAULT_SECTIONS.map(section => {
        const isOpen         = !!openSections[section.id]
        const customSubs     = config.customSubs[section.id] || []
        const hiddenBuiltins = config.deletedBuiltinSubs?.[section.id] || []
        const sectionLabel   = config.sectionLabels[section.id] || section.label

        const allSubs = [
          ...section.subs.map(s => ({
            ...s,
            isCustom: false,
            isHidden: hiddenBuiltins.includes(s.id),
          })),
          ...customSubs.map(cs => ({
            id: cs.id,
            label: cs.label,
            isCustom: true,
            isHidden: false,
          })),
        ]

        const visibleCount = allSubs.filter(s => !s.isHidden).length
        const hiddenCount  = allSubs.filter(s => s.isHidden).length

        return (
          <div key={section.id}
            className={`rounded-xl border overflow-hidden
              ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>

            {/* ── L1 섹션 헤더 ── */}
            <div
              className={`flex items-center gap-3 px-4 py-3 border-b cursor-pointer group/sec
                ${dark ? 'border-[#252836] bg-[#13151C] hover:bg-[#0F1117]' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}
              onClick={() => toggleSection(section.id)}
            >
              <span className={`shrink-0 transition-transform duration-200
                ${dark ? 'text-slate-600' : 'text-slate-300'}
                ${isOpen ? 'rotate-90' : ''}`}>
                <ChevronRight size={14}/>
              </span>

              <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0
                ${dark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-500'}`}>
                L1
              </span>

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
              </div>
            </div>

            {/* ── L2 서브탭 목록 ── */}
            {isOpen && (
              <div className="px-2 py-2 flex flex-col gap-0.5">
                <p className={`flex items-center gap-1.5 px-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest
                  ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
                  <LayoutTemplate size={10} className="text-emerald-400"/> 중위탭 (L2)
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
                    getL3Tabs={getL3Tabs}
                    addL3Tab={addL3Tab}
                    removeL3Tab={removeL3Tab}
                    renameL3Tab={renameL3Tab}
                    getSubDataSource={getSubDataSource}
                    setSubDataSource={setSubDataSource}
                  />
                ))}

                <AddSubRow dark={dark} onAdd={label => onAddSub(section.id, label)} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
