import { useState } from 'react'
import { DEFAULT_SECTIONS } from '../../components/Layout/Sidebar'
import { Pencil, Plus, Trash2, Check, X, GripVertical } from 'lucide-react'

/* 인라인 편집 인풋 */
function EditableLabel({ value, onSave, dark, placeholder }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value)

  const commit = () => { onSave(draft.trim() || value); setEditing(false) }
  const cancel = () => { setDraft(value); setEditing(false) }

  if (editing) return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
        placeholder={placeholder}
        className={`px-2 py-1 rounded-lg border text-xs outline-none w-36
          ${dark ? 'bg-[#13151C] border-indigo-500 text-white' : 'bg-white border-indigo-400 text-slate-700'}`}
      />
      <button onClick={commit}  className="p-1 text-emerald-400 hover:bg-emerald-400/10 rounded"><Check size={12}/></button>
      <button onClick={cancel}  className="p-1 text-slate-400   hover:bg-slate-400/10   rounded"><X     size={12}/></button>
    </div>
  )

  return (
    <div className="flex items-center gap-1.5 group">
      <span className={`text-xs font-medium ${dark ? 'text-white' : 'text-slate-700'}`}>{value}</span>
      <button
        onClick={() => { setDraft(value); setEditing(true) }}
        className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity
          ${dark ? 'text-slate-500 hover:text-indigo-400' : 'text-slate-300 hover:text-indigo-500'}`}
      >
        <Pencil size={11}/>
      </button>
    </div>
  )
}

/* 새 서브탭 추가 */
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
      className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors mt-1
        ${dark ? 'text-indigo-400 hover:bg-indigo-500/10' : 'text-indigo-500 hover:bg-indigo-50'}`}
    >
      <Plus size={12}/> 하위탭 추가
    </button>
  )

  return (
    <div className="flex items-center gap-2 mt-1">
      <input
        autoFocus
        value={label}
        onChange={e => setLabel(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setShow(false) }}
        placeholder="탭 이름 입력..."
        className={`px-2.5 py-1.5 rounded-lg border text-xs outline-none w-40
          ${dark ? 'bg-[#13151C] border-indigo-500 text-white placeholder:text-slate-600' : 'bg-white border-indigo-400 text-slate-700 placeholder:text-slate-300'}`}
      />
      <button onClick={submit}    className="px-2.5 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700">추가</button>
      <button onClick={() => setShow(false)} className={`px-2 py-1.5 text-xs rounded-lg ${dark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}>취소</button>
    </div>
  )
}

/* ─────────── 메인 ─────────── */
export default function TabSettings({ dark, config, onUpdateSection, onUpdateSub, onAddSub, onRemoveSub }) {

  return (
    <div className="p-6 flex flex-col gap-5 max-w-2xl">
      <div>
        <h2 className={`text-base font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>탭 설정</h2>
        <p className={`text-xs mt-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          메인 탭 및 하위 탭 이름을 변경하거나 새로운 탭을 추가할 수 있어요.
          탭 이름에 마우스를 올리면 ✏️ 아이콘이 나타나요.
        </p>
      </div>

      {DEFAULT_SECTIONS.map(section => {
        const customSubs  = config.customSubs[section.id] || []
        const sectionLabel = config.sectionLabels[section.id] || section.label

        return (
          <div key={section.id}
            className={`rounded-xl border overflow-hidden ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'}`}
          >
            {/* 섹션 헤더 */}
            <div className={`flex items-center gap-3 px-5 py-4 border-b ${dark ? 'border-[#252836] bg-[#13151C]' : 'border-slate-100 bg-slate-50'}`}>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                메인탭
              </span>
              <EditableLabel
                value={sectionLabel}
                placeholder={section.label}
                dark={dark}
                onSave={label => onUpdateSection(section.id, label)}
              />
              {config.sectionLabels[section.id] && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${dark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-500'}`}>
                  변경됨
                </span>
              )}
            </div>

            {/* 기본 서브탭 */}
            <div className="px-5 py-3 flex flex-col gap-1">
              <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
                기본 하위탭
              </p>
              {section.subs.map(sub => {
                const key   = `${section.id}.${sub.id}`
                const label = config.subLabels[key] || sub.label
                return (
                  <div key={sub.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg ${dark ? 'hover:bg-[#13151C]' : 'hover:bg-slate-50'}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${dark ? 'bg-slate-600' : 'bg-slate-300'}`}/>
                    <EditableLabel
                      value={label}
                      placeholder={sub.label}
                      dark={dark}
                      onSave={newLabel => onUpdateSub(section.id, sub.id, newLabel)}
                    />
                    {config.subLabels[key] && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ml-auto ${dark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                        변경됨
                      </span>
                    )}
                  </div>
                )
              })}

              {/* 커스텀 서브탭 */}
              {customSubs.length > 0 && (
                <>
                  <p className={`text-[10px] font-semibold uppercase tracking-wider mt-3 mb-2 ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
                    커스텀 하위탭
                  </p>
                  {customSubs.map(sub => {
                    const key   = `${section.id}.${sub.id}`
                    const label = config.subLabels[key] || sub.label
                    return (
                      <div key={sub.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg group ${dark ? 'hover:bg-[#13151C]' : 'hover:bg-slate-50'}`}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"/>
                        <EditableLabel
                          value={label}
                          placeholder={sub.label}
                          dark={dark}
                          onSave={newLabel => onUpdateSub(section.id, sub.id, newLabel)}
                        />
                        <span className={`text-[9px] ml-auto mr-1 px-1.5 py-0.5 rounded ${dark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-500'}`}>
                          커스텀
                        </span>
                        <button
                          onClick={() => { if (confirm(`"${label}" 탭을 삭제할까요?`)) onRemoveSub(section.id, sub.id) }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-opacity"
                        >
                          <Trash2 size={11}/>
                        </button>
                      </div>
                    )
                  })}
                </>
              )}

              <AddSubRow dark={dark} onAdd={label => onAddSub(section.id, label)} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
