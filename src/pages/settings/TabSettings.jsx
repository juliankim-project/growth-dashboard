import { useState } from 'react'
import { DEFAULT_SECTIONS } from '../../components/Layout/Sidebar'
import {
  Pencil, Plus, Trash2, Check, X, ChevronRight, ChevronDown,
  LayoutDashboard, LayoutTemplate, Layers
} from 'lucide-react'

/* ─────────────────────────────────────────
   인라인 이름 편집 (hover → 연필 아이콘)
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
   L3 탭 칩 목록 (인라인 추가/삭제/이름변경)
───────────────────────────────────────── */
function L3TabsRow({ sectionId, subId, getL3Tabs, addL3Tab, removeL3Tab, renameL3Tab, dark }) {
  const tabs = getL3Tabs(sectionId, subId)
  const [adding,   setAdding]   = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [renaming, setRenaming] = useState(null) // { id, value }

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
      {/* 기존 L3 탭 칩 */}
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
          {tabs.length > 0 && (
            <button
              onClick={() => {
                if (confirm(`"${tab.label}" 탭을 삭제할까요?`)) removeL3Tab(sectionId, subId, tab.id)
              }}
              className="opacity-0 group-hover/chip:opacity-100 ml-0.5 text-[9px]
                leading-none hover:text-red-400 transition-opacity"
              title="탭 삭제"
            >×</button>
          )}
        </div>
      ))}

      {/* 탭 추가 인풋 또는 버튼 */}
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
   L2 서브탭 행
───────────────────────────────────────── */
function SubRow({
  sectionId, sub, isCustom, config, dark,
  onUpdateSub, onRemoveSub,
  getL3Tabs, addL3Tab, removeL3Tab, renameL3Tab,
}) {
  const [open, setOpen] = useState(false)
  const key   = `${sectionId}.${sub.id}`
  const label = config.subLabels[key] || sub.label
  const l3Count = getL3Tabs(sectionId, sub.id).length

  return (
    <div className={`rounded-lg transition-colors
      ${dark ? 'hover:bg-[#13151C]/60' : 'hover:bg-slate-50'}`}>
      {/* 서브탭 헤더 행 */}
      <div className="flex items-center gap-2 px-3 py-2 group/sub">
        {/* 확장 토글 */}
        <button
          onClick={() => setOpen(o => !o)}
          className={`shrink-0 transition-colors ${dark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'}`}
        >
          {open
            ? <ChevronDown size={12}/>
            : <ChevronRight size={12}/>
          }
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

        <div className="flex items-center gap-2 ml-auto">
          {/* L3 탭 수 배지 */}
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full
            ${l3Count > 0
              ? dark ? 'bg-indigo-500/15 text-indigo-400' : 'bg-indigo-50 text-indigo-500'
              : dark ? 'bg-[#252836] text-slate-600' : 'bg-slate-100 text-slate-400'}`}>
            L3 · {l3Count}개
          </span>

          {/* 커스텀 배지 */}
          {isCustom && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded ${dark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-500'}`}>
              커스텀
            </span>
          )}

          {/* 삭제 (커스텀만) */}
          {isCustom && (
            <button
              onClick={() => { if (confirm(`"${label}" 하위탭을 삭제할까요?`)) onRemoveSub(sectionId, sub.id) }}
              className="opacity-0 group-hover/sub:opacity-100 p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-opacity"
            >
              <Trash2 size={11}/>
            </button>
          )}
        </div>
      </div>

      {/* L3 탭 영역 (확장 시) */}
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
  getL3Tabs, addL3Tab, removeL3Tab, renameL3Tab,
}) {
  const [openSections, setOpenSections] = useState(() => {
    const init = {}
    DEFAULT_SECTIONS.forEach(s => { init[s.id] = true })
    return init
  })

  const toggleSection = (id) =>
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className="p-6 flex flex-col gap-4 max-w-2xl">
      {/* 헤더 */}
      <div>
        <h2 className={`text-base font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>탭 설정</h2>
        <p className={`text-xs mt-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          상위탭(L1) → 중위탭(L2) → 하위탭(L3) 3단계 구조를 관리합니다.
          이름에 마우스를 올리면 ✏️ 아이콘이 나타나요. L3 탭은 화살표(▶)를 클릭해 펼쳐서 관리하세요.
        </p>
      </div>

      {/* 범례 */}
      <div className={`flex items-center gap-4 px-4 py-2.5 rounded-xl text-[10px]
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
      </div>

      {/* 섹션 목록 */}
      {DEFAULT_SECTIONS.map(section => {
        const isOpen       = !!openSections[section.id]
        const customSubs   = config.customSubs[section.id] || []
        const sectionLabel = config.sectionLabels[section.id] || section.label
        const allSubs      = [
          ...section.subs.map(s => ({ ...s, isCustom: false })),
          ...customSubs.map(cs => ({
            id: cs.id,
            label: config.subLabels[`${section.id}.${cs.id}`] || cs.label,
            isCustom: true,
          })),
        ]

        return (
          <div key={section.id}
            className={`rounded-xl border overflow-hidden
              ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}>

            {/* ── L1 섹션 헤더 ── */}
            <div className={`flex items-center gap-3 px-4 py-3 border-b cursor-pointer group/sec
              ${dark ? 'border-[#252836] bg-[#13151C] hover:bg-[#0F1117]' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}
              onClick={() => toggleSection(section.id)}
            >
              {/* 확장 아이콘 */}
              <span className={`shrink-0 transition-transform duration-200
                ${dark ? 'text-slate-600' : 'text-slate-300'}
                ${isOpen ? 'rotate-90' : ''}`}>
                <ChevronRight size={14}/>
              </span>

              {/* L1 배지 */}
              <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0
                ${dark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-500'}`}>
                L1
              </span>

              {/* 이름 (클릭 이벤트 막기) */}
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

              {/* 서브탭 수 */}
              <span className={`ml-auto text-[10px] ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
                L2 · {allSubs.length}개
              </span>
            </div>

            {/* ── L2 서브탭 목록 (확장 시) ── */}
            {isOpen && (
              <div className="px-2 py-2 flex flex-col gap-0.5">
                {/* L2 헤더 레이블 */}
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
                    config={config}
                    dark={dark}
                    onUpdateSub={onUpdateSub}
                    onRemoveSub={onRemoveSub}
                    getL3Tabs={getL3Tabs}
                    addL3Tab={addL3Tab}
                    removeL3Tab={removeL3Tab}
                    renameL3Tab={renameL3Tab}
                  />
                ))}

                {/* L2 추가 버튼 */}
                <AddSubRow dark={dark} onAdd={label => onAddSub(section.id, label)} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
