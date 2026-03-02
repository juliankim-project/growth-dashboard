import { useState, useMemo, useEffect, useCallback } from 'react'
import { Settings2, Check, X, Plus, Database, GripVertical } from 'lucide-react'
import {
  TEMPLATES, WIDGET_TYPES, METRICS, GROUP_BY,
  makeDashboard, DEFAULT_WIDGET_CONFIG,
} from '../store/useConfig'
import { useTableData }    from '../hooks/useTableData'
import Spinner             from '../components/UI/Spinner'
import KPIWidget           from '../components/widgets/KPIWidget'
import TimeSeriesWidget    from '../components/widgets/TimeSeriesWidget'
import BarWidget           from '../components/widgets/BarWidget'
import DonutWidget         from '../components/widgets/DonutWidget'
import TableWidget         from '../components/widgets/TableWidget'
import {
  DndContext, closestCenter,
  PointerSensor, KeyboardSensor,
  useSensor, useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable,
  rectSortingStrategy, arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/* ── fieldMap 적용: 커스텀 컬럼명 → 표준 필드명으로 복사 ── */
function applyFieldMap(rows, fieldMap) {
  if (!fieldMap || Object.keys(fieldMap).length === 0) return rows
  return rows.map(row => {
    const mapped = { ...row }
    Object.entries(fieldMap).forEach(([metricId, customCol]) => {
      const m = METRICS.find(x => x.id === metricId)
      if (m && m.field && customCol && customCol !== m.field) {
        mapped[m.field] = row[customCol] ?? row[m.field]
      }
    })
    return mapped
  })
}

const WIDGET_MAP = {
  kpi: KPIWidget, timeseries: TimeSeriesWidget,
  bar: BarWidget, donut: DonutWidget, table: TableWidget,
}
const renderWidget = (type, data, cfg, dark) => {
  const C = WIDGET_MAP[type]
  return C ? <C data={data} config={cfg} dark={dark}/> : null
}

/* ══════════════════════════════════════════
   데이터 소스 셀렉터 (편집모드에서 테이블 선택)
══════════════════════════════════════════ */
function DataSourceSelector({ tableName, onChange, dark }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(tableName)

  // 일반적으로 사용되는 테이블 예시 (초기값)
  const KNOWN_TABLES = ['marketing_data']

  const commit = () => {
    const t = draft.trim()
    if (t) onChange(t)
    setEditing(false)
  }

  if (!editing) return (
    <button
      onClick={() => { setDraft(tableName); setEditing(true) }}
      title="데이터 소스 테이블 변경"
      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors
        ${dark
          ? 'border-[#252836] text-slate-400 hover:text-indigo-400 hover:border-indigo-500/40'
          : 'border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300'}`}
    >
      <Database size={11}/>
      <span className="font-mono">{tableName}</span>
    </button>
  )

  return (
    <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-0.5
      ${dark ? 'border-indigo-500 bg-[#0F1117]' : 'border-indigo-400 bg-white shadow'}`}>
      <Database size={11} className="text-indigo-400 shrink-0"/>
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        list="known-tables"
        placeholder="테이블명 입력"
        className={`text-xs outline-none w-36 font-mono bg-transparent
          ${dark ? 'text-white placeholder:text-slate-600' : 'text-slate-800 placeholder:text-slate-300'}`}
      />
      <datalist id="known-tables">
        {KNOWN_TABLES.map(t => <option key={t} value={t}/>)}
      </datalist>
      <button onClick={commit}
        className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded hover:bg-indigo-700">
        확인
      </button>
      <button onClick={() => setEditing(false)}
        className={`text-[10px] px-1.5 py-0.5 rounded ${dark ? 'text-slate-400 hover:text-white' : 'text-slate-500'}`}>
        취소
      </button>
    </div>
  )
}

/* ══════════════════════════════════════════
   위젯 에디터 모달 (카드 밖 전체화면 모달)
══════════════════════════════════════════ */
function WidgetEditor({ slotId, widget, dark, onSave, onClose }) {
  const [type,   setType]   = useState(widget.type)
  const [config, setConfig] = useState({ ...widget.config })

  const upd = (k, v) => setConfig(c => ({ ...c, [k]: v }))
  const toggleMetric = mid => {
    const cur = config.metrics || []
    setConfig(c => ({ ...c, metrics: cur.includes(mid) ? cur.filter(x => x !== mid) : [...cur, mid] }))
  }
  const changeType = t => { setType(t); setConfig({ ...DEFAULT_WIDGET_CONFIG[t] }) }

  const S = {
    sel: `px-2.5 py-1.5 rounded-lg border text-xs outline-none w-full
      ${dark ? 'bg-[#0F1117] border-[#252836] text-white' : 'bg-white border-slate-200 text-slate-700'}`,
    inp: `px-2.5 py-1.5 rounded-lg border text-xs outline-none w-full
      ${dark ? 'bg-[#0F1117] border-[#252836] text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-700'}`,
    lab: `text-[10px] font-bold uppercase tracking-wide ${dark ? 'text-slate-500' : 'text-slate-400'}`,
    btn: (on) => `text-xs px-2.5 py-2 rounded-lg border text-left transition-colors
      ${on ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
           : dark ? 'border-[#252836] text-slate-400 hover:border-indigo-500/40' : 'border-slate-200 text-slate-500 hover:border-indigo-300'}`,
  }

  const meta = WIDGET_META[type] || {}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`rounded-2xl border w-full max-w-lg flex flex-col max-h-[90vh]
        ${dark ? 'bg-[#13151F] border-[#252836]' : 'bg-white border-slate-200 shadow-2xl'}`}>

        {/* 헤더 */}
        <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0
          ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{meta.icon}</span>
            <div>
              <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
                위젯 설정
              </p>
              <p className={`text-[10px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                {meta.label}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onSave(slotId, { type, config })}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 text-white text-xs rounded-xl hover:bg-indigo-700 font-semibold">
              <Check size={12}/> 저장
            </button>
            <button onClick={onClose}
              className={`p-2 rounded-xl ${dark ? 'text-slate-400 hover:bg-[#252836] hover:text-white' : 'text-slate-400 hover:bg-slate-100'}`}>
              <X size={16}/>
            </button>
          </div>
        </div>

        {/* 바디 */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">

          {/* 위젯 타입 */}
          <div>
            <p className={`${S.lab} mb-2`}>위젯 타입</p>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(WIDGET_META).map(([id, m]) => (
                <button key={id} onClick={() => changeType(id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all
                    ${type === id
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : dark ? 'border-[#252836] hover:border-indigo-500/40 hover:bg-[#252836]/60'
                             : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'}`}>
                  <span className="text-xl">{m.icon}</span>
                  <span className={`text-[10px] font-semibold leading-tight ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {m.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 제목 (kpi 제외) */}
          {type !== 'kpi' && (
            <div>
              <p className={`${S.lab} mb-1.5`}>제목</p>
              <input className={S.inp} value={config.title || ''}
                onChange={e => upd('title', e.target.value)} placeholder="위젯 제목"/>
            </div>
          )}

          {/* KPI */}
          {type === 'kpi' && (
            <>
              <div>
                <p className={`${S.lab} mb-2`}>지표</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {METRICS.map(m => (
                    <button key={m.id} onClick={() => upd('metric', m.id)} className={S.btn(config.metric === m.id)}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className={`${S.lab} mb-1.5`}>커스텀 라벨 (선택)</p>
                <input className={S.inp} value={config.label || ''}
                  onChange={e => upd('label', e.target.value)} placeholder="기본: 지표명 사용"/>
              </div>
            </>
          )}

          {/* 시계열 */}
          {type === 'timeseries' && (
            <div>
              <p className={`${S.lab} mb-2`}>지표 (복수 선택)</p>
              <div className="grid grid-cols-3 gap-1.5">
                {METRICS.map(m => {
                  const on = (config.metrics || []).includes(m.id)
                  return (
                    <button key={m.id} onClick={() => toggleMetric(m.id)} className={S.btn(on)}>
                      {on ? '✓ ' : ''}{m.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 바 / 도넛 */}
          {(type === 'bar' || type === 'donut') && (
            <>
              <div>
                <p className={`${S.lab} mb-2`}>지표</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {METRICS.map(m => (
                    <button key={m.id} onClick={() => upd('metric', m.id)} className={S.btn(config.metric === m.id)}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className={`${S.lab} mb-1.5`}>그룹 기준</p>
                <select className={S.sel} value={config.groupBy || 'channel'}
                  onChange={e => upd('groupBy', e.target.value)}>
                  {GROUP_BY.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
              </div>
            </>
          )}

          {/* 테이블 */}
          {type === 'table' && (
            <>
              <div>
                <p className={`${S.lab} mb-2`}>표시 지표 (복수 선택)</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {METRICS.map(m => {
                    const on = (config.metrics || []).includes(m.id)
                    return (
                      <button key={m.id} onClick={() => {
                        const cur = config.metrics || []
                        upd('metrics', on ? cur.filter(x => x !== m.id) : [...cur, m.id])
                      }} className={S.btn(on)}>
                        {on ? '✓ ' : ''}{m.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <p className={`${S.lab} mb-1.5`}>그룹 기준</p>
                <select className={S.sel} value={config.groupBy || 'channel'}
                  onChange={e => upd('groupBy', e.target.value)}>
                  {GROUP_BY.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   드래그 가능한 카드 (dnd-kit)
══════════════════════════════════════════ */
function SortableCard({ slot, editMode, onEdit, onDelete, onSpanChange, data, dark }) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: slot.id, disabled: !editMode })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    zIndex:  isDragging ? 50 : 'auto',
  }

  const meta = WIDGET_META[slot.type] || WIDGET_META.kpi

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, minHeight: slot.type === 'kpi' ? 88 : 210 }}
      className={`${slot.span} relative`}
    >
      {editMode && (
        <>
          {/* 드래그 핸들 */}
          <div
            {...attributes}
            {...listeners}
            className={`absolute top-2 left-1/2 -translate-x-1/2 z-20
              flex items-center gap-1 px-2 py-0.5 rounded-full cursor-grab active:cursor-grabbing
              ${dark
                ? 'bg-[#0F1117]/90 text-slate-500 hover:text-slate-300 border border-[#252836]'
                : 'bg-white/90 text-slate-400 hover:text-slate-600 border border-slate-200 shadow-sm'}`}
          >
            <GripVertical size={12}/>
          </div>

          {/* 삭제 버튼 */}
          <button
            onClick={() => onDelete(slot.id)}
            className="absolute -top-2.5 -right-2.5 z-20 w-6 h-6 rounded-full
              bg-red-500 hover:bg-red-600 text-white shadow-lg
              flex items-center justify-center text-sm leading-none font-bold
              transition-transform hover:scale-110">
            ×
          </button>

          {/* 크기 버튼 */}
          <div className="absolute top-2 left-2 z-20 flex gap-0.5">
            {SPAN_OPTS.map(opt => (
              <button key={opt.value} onClick={() => onSpanChange(slot.id, opt.value)}
                title={opt.label}
                className={`w-5 h-5 rounded text-[9px] font-bold transition-colors
                  ${slot.span === opt.value
                    ? 'bg-indigo-500 text-white'
                    : dark
                      ? 'bg-[#0F1117]/80 text-slate-400 hover:bg-indigo-500/20 hover:text-indigo-300'
                      : 'bg-white/90 text-slate-400 hover:bg-indigo-100 hover:text-indigo-600 shadow'}`}>
                {opt.cols}
              </button>
            ))}
          </div>

          {/* 편집 버튼 */}
          <button
            onClick={() => onEdit(slot.id)}
            className="absolute bottom-2 right-2 z-20 flex items-center gap-1
              px-2.5 py-1 bg-indigo-600 text-white text-[10px] rounded-lg shadow-lg hover:bg-indigo-700">
            <Settings2 size={10}/> {meta.icon} 편집
          </button>
        </>
      )}
      {renderWidget(slot.type, data, slot.config, dark)}
    </div>
  )
}

/* ══════════════════════════════════════════
   템플릿 셀렉터
══════════════════════════════════════════ */
function TemplateSelector({ current, onSelect, dark, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={`rounded-2xl border w-full max-w-lg p-6
        ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className="flex items-center justify-between mb-5">
          <p className={`font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>템플릿 선택</p>
          <button onClick={onClose}
            className={`p-1.5 rounded-lg ${dark ? 'text-slate-400 hover:bg-[#252836]' : 'text-slate-400 hover:bg-slate-100'}`}>
            <X size={16}/>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Object.values(TEMPLATES).map(tpl => (
            <button key={tpl.id} onClick={() => { onSelect(tpl.id); onClose() }}
              className={`p-4 rounded-xl border text-left transition-all
                ${current === tpl.id
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : dark ? 'border-[#252836] hover:border-indigo-500/40' : 'border-slate-200 hover:border-indigo-300'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{tpl.name}</span>
                {current === tpl.id && <span className="text-xs text-indigo-500">현재</span>}
              </div>
              <p className={`text-xs mb-3 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{tpl.desc}</p>
              <p className={`text-[10px] font-mono ${dark ? 'text-slate-600' : 'text-slate-300'}`}>{tpl.preview}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   L3 탭 바
   - 클릭: 탭 전환
   - 더블클릭: 이름 변경 (인라인 입력)
   - 호버 ×: 탭 삭제
   - + 탭 추가 버튼 (추가 후 자동 이동 없음)
══════════════════════════════════════════ */
function L3TabBar({ tabs, activeId, onSelect, onAdd, onRemove, onRename, dark }) {
  const [addingTab, setAddingTab] = useState(false)
  const [newLabel,  setNewLabel]  = useState('')
  const [renaming,  setRenaming]  = useState(null) // { id, value }

  const commitAdd = () => {
    if (!newLabel.trim()) { setAddingTab(false); return }
    onAdd(newLabel.trim())
    setAddingTab(false)
    setNewLabel('')
  }

  const commitRename = () => {
    if (!renaming) return
    onRename(renaming.id, renaming.value.trim() || '탭')
    setRenaming(null)
  }

  return (
    <div className={`flex items-center gap-0.5 px-5 pt-3 border-b overflow-x-auto shrink-0
      ${dark ? 'border-[#252836]' : 'border-slate-200'}`}>

      {tabs.map(tab => (
        <div key={tab.id} className="relative group shrink-0">
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
              className={`text-xs px-3 py-2 rounded-t-lg outline-none w-24
                border-b-2 border-indigo-500
                ${dark ? 'bg-transparent text-white' : 'bg-transparent text-slate-800'}`}
            />
          ) : (
            <button
              onClick={() => onSelect(tab.id)}
              onDoubleClick={() => setRenaming({ id: tab.id, value: tab.label })}
              title="더블클릭으로 이름 변경"
              className={`text-xs px-4 py-2.5 rounded-t-lg border-b-2 font-medium
                transition-colors whitespace-nowrap
                ${activeId === tab.id
                  ? dark
                    ? 'border-indigo-500 text-white bg-[#1A1D27]'
                    : 'border-indigo-500 text-indigo-600 bg-white'
                  : dark
                    ? 'border-transparent text-slate-400 hover:text-white hover:bg-[#1A1D27]/50'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
              {tab.label}
            </button>
          )}

          {tabs.length > 1 && (
            <button
              onClick={() => onRemove(tab.id)}
              title="탭 삭제"
              className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full
                bg-red-500/80 hover:bg-red-600 text-white
                opacity-0 group-hover:opacity-100 transition-opacity
                flex items-center justify-center text-[8px] leading-none"
            >×</button>
          )}
        </div>
      ))}

      {addingTab ? (
        <div className="flex items-center gap-1 pb-px ml-1 shrink-0">
          <input
            autoFocus
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter')  commitAdd()
              if (e.key === 'Escape') { setAddingTab(false); setNewLabel('') }
            }}
            placeholder="탭 이름"
            className={`text-xs px-2.5 py-1.5 rounded-lg border outline-none w-24
              ${dark
                ? 'border-indigo-500 bg-transparent text-white placeholder:text-slate-600'
                : 'border-indigo-400 bg-transparent text-slate-800 placeholder:text-slate-300'}`}
          />
          <button onClick={commitAdd}
            className="text-xs px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            확인
          </button>
          <button onClick={() => { setAddingTab(false); setNewLabel('') }}
            className={`text-xs px-2 py-1.5 rounded-lg
              ${dark ? 'text-slate-400 hover:text-white' : 'text-slate-500'}`}>
            취소
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAddingTab(true)}
          className={`shrink-0 flex items-center gap-1 text-xs px-3 py-2 ml-1
            rounded-t-lg border border-dashed mb-px transition-colors
            ${dark
              ? 'border-[#2E3450] text-slate-500 hover:text-slate-300 hover:border-slate-500'
              : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'}`}
        >
          <Plus size={10}/> 탭 추가
        </button>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════
   상수 & 유틸
══════════════════════════════════════════ */
const SPAN_OPTS = [
  { value: 'col-span-1', label: '1열',  cols: 1 },
  { value: 'col-span-2', label: '2열',  cols: 2 },
  { value: 'col-span-3', label: '3열',  cols: 3 },
  { value: 'col-span-4', label: '4열',  cols: 4 },
  { value: 'col-span-5', label: '5열',  cols: 5 },
  { value: 'col-span-6', label: '전체', cols: 6 },
]

const WIDGET_META = {
  kpi:        { icon: '💳', label: 'KPI 카드',      desc: '핵심 지표를 강조 표시' },
  timeseries: { icon: '📈', label: '시계열 차트',   desc: '날짜별 트렌드 시각화' },
  bar:        { icon: '📊', label: '바 차트',       desc: '채널 / 캠페인별 비교' },
  donut:      { icon: '🍩', label: '도넛 차트',     desc: '구성 비율 시각화' },
  table:      { icon: '📋', label: '데이터 테이블', desc: '상세 수치 비교' },
}

/* ── 구 포맷 → slots 배열로 정규화 ── */
function normalizeDashboard(d) {
  if (!d) return { slots: [] }
  if (Array.isArray(d.slots)) return d
  // 구 템플릿 포맷 마이그레이션
  const tpl = TEMPLATES[d.template]
  if (!tpl) return { dataSource: d.dataSource, slots: [] }
  return {
    dataSource: d.dataSource,
    slots: tpl.slots.map(s => {
      const w    = d.widgets?.[s.id]
      const type = w?.type || s.defaultType
      return {
        id:     s.id,
        span:   w?.config?.span || s.span,
        type,
        config: { ...(DEFAULT_WIDGET_CONFIG[type] || {}), ...(w?.config || {}) },
      }
    }),
  }
}

/* ══════════════════════════════════════════
   카드 추가 모달
══════════════════════════════════════════ */
function AddWidgetModal({ dark, onAdd, onClose }) {
  const [step,   setStep]   = useState(1)   // 1:타입 2:크기 3:설정
  const [type,   setType]   = useState('kpi')
  const [span,   setSpan]   = useState('col-span-1')
  const [config, setConfig] = useState({ ...DEFAULT_WIDGET_CONFIG.kpi })

  const upd = (k, v) => setConfig(c => ({ ...c, [k]: v }))

  const changeType = t => { setType(t); setConfig({ ...DEFAULT_WIDGET_CONFIG[t] }) }

  const toggleMetric = mid => {
    const cur = config.metrics || []
    setConfig(c => ({ ...c, metrics: cur.includes(mid) ? cur.filter(x => x !== mid) : [...cur, mid] }))
  }

  const handleAdd = () => {
    onAdd({ id: `w_${Date.now()}`, span, type, config })
    onClose()
  }

  const S = {
    card: (on) => `flex flex-col items-center gap-2 p-4 rounded-xl border text-center cursor-pointer transition-all
      ${on ? 'border-indigo-500 bg-indigo-500/10'
           : dark ? 'border-[#252836] hover:border-indigo-500/40 hover:bg-[#252836]/60'
                  : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'}`,
    spanCard: (on) => `flex flex-col items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all
      ${on ? 'border-indigo-500 bg-indigo-500/10'
           : dark ? 'border-[#252836] hover:border-indigo-500/40' : 'border-slate-200 hover:border-indigo-300'}`,
    sel: `px-2.5 py-1.5 rounded-lg border text-xs outline-none w-full
      ${dark ? 'bg-[#0F1117] border-[#252836] text-white' : 'bg-white border-slate-200 text-slate-700'}`,
    inp: `px-2.5 py-1.5 rounded-lg border text-xs outline-none w-full
      ${dark ? 'bg-[#0F1117] border-[#252836] text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-700'}`,
    lab: `text-[10px] font-bold uppercase tracking-wide ${dark ? 'text-slate-500' : 'text-slate-400'}`,
    btn: (on) => `text-xs px-2 py-1.5 rounded-lg border text-left transition-colors
      ${on ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
           : dark ? 'border-[#252836] text-slate-400 hover:border-indigo-500/40' : 'border-slate-200 text-slate-500 hover:border-indigo-300'}`,
  }

  const STEPS = ['타입 선택', '크기 선택', '설정']

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className={`rounded-t-2xl sm:rounded-2xl border w-full sm:max-w-md flex flex-col max-h-[88vh]
        ${dark ? 'bg-[#13151F] border-[#252836]' : 'bg-white border-slate-200 shadow-2xl'}`}>

        {/* 헤더 */}
        <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0
          ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
          <div>
            <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>카드 추가</p>
            <div className="flex items-center gap-1.5 mt-2">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors
                    ${step === i+1 ? 'bg-indigo-500 text-white'
                      : step > i+1 ? 'bg-emerald-500 text-white'
                      : dark ? 'bg-[#252836] text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                    {step > i+1 ? '✓' : i+1}
                  </div>
                  <span className={`text-[10px] font-medium
                    ${step === i+1 ? (dark ? 'text-slate-200' : 'text-slate-700') : dark ? 'text-slate-600' : 'text-slate-400'}`}>
                    {s}
                  </span>
                  {i < 2 && <span className={`text-[10px] mx-0.5 ${dark ? 'text-slate-700' : 'text-slate-300'}`}>›</span>}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose}
            className={`p-2 rounded-xl ${dark ? 'text-slate-400 hover:bg-[#252836] hover:text-white' : 'text-slate-400 hover:bg-slate-100'}`}>
            <X size={16}/>
          </button>
        </div>

        {/* 바디 */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* Step 1: 타입 */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(WIDGET_META).map(([id, meta]) => (
                <button key={id} onClick={() => { changeType(id); setStep(2) }}
                  className={S.card(type === id)}>
                  <span className="text-3xl">{meta.icon}</span>
                  <span className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-700'}`}>{meta.label}</span>
                  <span className={`text-[10px] leading-tight ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{meta.desc}</span>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: 크기 */}
          {step === 2 && (
            <div className="flex flex-col gap-3">
              <p className={`text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                대시보드 4열 그리드 기준으로 카드의 너비를 선택하세요
              </p>
              <div className="grid grid-cols-2 gap-3">
                {SPAN_OPTS.map(opt => (
                  <button key={opt.value} onClick={() => { setSpan(opt.value); setStep(3) }}
                    className={S.spanCard(span === opt.value)}>
                    <div className="w-full grid grid-cols-6 gap-0.5 mb-1">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className={`h-2.5 rounded-sm transition-colors ${
                          i < opt.cols
                            ? 'bg-indigo-500'
                            : dark ? 'bg-[#252836]' : 'bg-slate-100'}`}/>
                      ))}
                    </div>
                    <span className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-700'}`}>{opt.label}</span>
                    <span className={`text-[10px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{opt.cols} / 4열</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: 설정 */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              {type === 'kpi' && (
                <>
                  <div>
                    <p className={`${S.lab} mb-2`}>지표</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {METRICS.map(m => (
                        <button key={m.id} onClick={() => upd('metric', m.id)} className={S.btn(config.metric === m.id)}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>커스텀 라벨 (선택)</p>
                    <input className={S.inp} value={config.label || ''}
                      onChange={e => upd('label', e.target.value)} placeholder="기본: 지표명 사용"/>
                  </div>
                </>
              )}

              {type === 'timeseries' && (
                <>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>제목</p>
                    <input className={S.inp} value={config.title || ''}
                      onChange={e => upd('title', e.target.value)} placeholder="위젯 제목"/>
                  </div>
                  <div>
                    <p className={`${S.lab} mb-2`}>지표 (복수 선택)</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {METRICS.map(m => {
                        const on = (config.metrics || []).includes(m.id)
                        return (
                          <button key={m.id} onClick={() => toggleMetric(m.id)} className={S.btn(on)}>
                            {on ? '✓ ' : ''}{m.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}

              {(type === 'bar' || type === 'donut') && (
                <>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>제목</p>
                    <input className={S.inp} value={config.title || ''}
                      onChange={e => upd('title', e.target.value)} placeholder="위젯 제목"/>
                  </div>
                  <div>
                    <p className={`${S.lab} mb-2`}>지표</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {METRICS.map(m => (
                        <button key={m.id} onClick={() => upd('metric', m.id)} className={S.btn(config.metric === m.id)}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>그룹 기준</p>
                    <select className={S.sel} value={config.groupBy || 'channel'}
                      onChange={e => upd('groupBy', e.target.value)}>
                      {GROUP_BY.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                  </div>
                </>
              )}

              {type === 'table' && (
                <>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>제목</p>
                    <input className={S.inp} value={config.title || ''}
                      onChange={e => upd('title', e.target.value)} placeholder="위젯 제목"/>
                  </div>
                  <div>
                    <p className={`${S.lab} mb-2`}>표시 지표 (복수 선택)</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {METRICS.map(m => {
                        const on = (config.metrics || []).includes(m.id)
                        return (
                          <button key={m.id} onClick={() => {
                            const cur = config.metrics || []
                            upd('metrics', on ? cur.filter(x => x !== m.id) : [...cur, m.id])
                          }} className={S.btn(on)}>
                            {on ? '✓ ' : ''}{m.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>그룹 기준</p>
                    <select className={S.sel} value={config.groupBy || 'channel'}
                      onChange={e => upd('groupBy', e.target.value)}>
                      {GROUP_BY.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className={`flex items-center justify-between px-5 py-4 border-t shrink-0
          ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className={`text-xs px-4 py-2 rounded-xl border transition-colors
              ${dark ? 'border-[#252836] text-slate-400 hover:text-white hover:border-slate-600'
                     : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            {step > 1 ? '← 이전' : '취소'}
          </button>
          {step < 3 ? (
            <button onClick={() => setStep(s => s + 1)}
              className="text-xs px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold">
              다음 →
            </button>
          ) : (
            <button onClick={handleAdd}
              className="flex items-center gap-1.5 text-xs px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold">
              <Plus size={12}/> 카드 추가
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   위젯 그리드 (탭별 분리 렌더 + dnd-kit)
══════════════════════════════════════════ */
function DashboardGrid({ tabId, dashboard, setDashboard, data, dark, onSave, saved }) {
  const [editMode,   setEditMode]   = useState(false)
  const [editSlot,   setEditSlot]   = useState(null)   // 편집 모달 대상 slotId
  const [showAdd,    setShowAdd]    = useState(false)
  const [activeId,   setActiveId]   = useState(null)   // 드래그 중인 slotId

  // 탭 전환 시 초기화
  useEffect(() => {
    setEditMode(false)
    setEditSlot(null)
    setShowAdd(false)
  }, [tabId])

  // 정규화된 슬롯 배열
  const norm  = useMemo(() => normalizeDashboard(dashboard), [dashboard])
  const slots = norm.slots || []

  const currentTable = dashboard.dataSource?.table || 'marketing_data'

  // dnd-kit sensors — 5px 이상 움직여야 드래그 시작 (클릭과 구분)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  /* ── 슬롯 조작 ── */
  const handleAddSlot = (widget) => {
    setDashboard({ ...norm, slots: [...slots, widget] })
  }

  const handleDeleteSlot = (id) => {
    setDashboard({ ...norm, slots: slots.filter(s => s.id !== id) })
  }

  const handleSpanChange = (id, span) => {
    setDashboard({ ...norm, slots: slots.map(s => s.id === id ? { ...s, span } : s) })
  }

  const handleWidgetSave = (slotId, widget) => {
    setDashboard({ ...norm, slots: slots.map(s => s.id === slotId ? { ...s, ...widget } : s) })
    setEditSlot(null)
  }

  const handleTableChange = (tableName) => {
    const n = normalizeDashboard(dashboard)
    setDashboard({ ...n, dataSource: { ...(n.dataSource || {}), table: tableName } })
  }

  /* ── 드래그 앤 드롭 ── */
  const handleDragStart = ({ active }) => setActiveId(active.id)

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIdx = slots.findIndex(s => s.id === active.id)
    const newIdx = slots.findIndex(s => s.id === over.id)
    setDashboard({ ...norm, slots: arrayMove(slots, oldIdx, newIdx) })
  }

  const activeSlot = activeId ? slots.find(s => s.id === activeId) : null

  // 편집 모달 대상 슬롯
  const editingSlot = editSlot ? slots.find(s => s.id === editSlot) : null

  return (
    <div className="flex flex-col gap-3">
      {/* 툴바 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <button onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                  bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                <Plus size={12}/> 카드 추가
              </button>
              <DataSourceSelector tableName={currentTable} onChange={handleTableChange} dark={dark}/>
            </>
          ) : (
            <span className={`flex items-center gap-1.5 text-[10px]
              ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
              <Database size={10}/>
              <span className="font-mono">{currentTable}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <button onClick={() => { setEditMode(false); setEditSlot(null) }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors
                  ${dark ? 'border-[#252836] text-slate-400 hover:text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                취소
              </button>
              <button onClick={() => { onSave(); setEditMode(false); setEditSlot(null) }}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors
                  ${saved ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                <Check size={12}/> {saved ? '저장됨' : '저장'}
              </button>
            </>
          ) : (
            <button onClick={() => setEditMode(true)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors
                ${dark ? 'border-[#252836] text-slate-400 hover:text-white hover:bg-[#1A1D27]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
              <Settings2 size={12}/> 대시보드 편집
            </button>
          )}
        </div>
      </div>

      {/* 위젯 그리드 */}
      {slots.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-20 gap-5 rounded-2xl border-2 border-dashed
          ${dark ? 'border-[#252836] text-slate-500' : 'border-slate-200 text-slate-400'}`}>
          <span className="text-5xl">📊</span>
          <div className="text-center">
            <p className={`text-sm font-semibold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
              아직 카드가 없습니다
            </p>
            <p className="text-xs mt-1.5">카드를 추가해 원하는 지표를 시각화해보세요</p>
          </div>
          <button onClick={() => { setEditMode(true); setShowAdd(true) }}
            className="flex items-center gap-2 text-xs px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold">
            <Plus size={13}/> 첫 번째 카드 추가
          </button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={slots.map(s => s.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-6 gap-3">
              {slots.map(slot => (
                <SortableCard
                  key={slot.id}
                  slot={slot}
                  editMode={editMode}
                  onEdit={setEditSlot}
                  onDelete={handleDeleteSlot}
                  onSpanChange={handleSpanChange}
                  data={data}
                  dark={dark}
                />
              ))}
              {/* 편집모드: 인라인 추가 버튼 */}
              {editMode && (
                <div onClick={() => setShowAdd(true)}
                  className={`col-span-1 min-h-[88px] rounded-xl border-2 border-dashed cursor-pointer
                    flex flex-col items-center justify-center gap-2 transition-colors select-none
                    ${dark
                      ? 'border-[#252836] text-slate-600 hover:border-indigo-500/50 hover:text-indigo-400 hover:bg-indigo-500/5'
                      : 'border-slate-200 text-slate-300 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50'}`}>
                  <Plus size={20}/>
                  <span className="text-xs font-semibold">카드 추가</span>
                </div>
              )}
            </div>
          </SortableContext>

          {/* 드래그 중 고스트 카드 */}
          <DragOverlay>
            {activeSlot && (
              <div className={`${activeSlot.span} rounded-xl border-2 border-indigo-500 opacity-90 shadow-2xl`}
                style={{ minHeight: activeSlot.type === 'kpi' ? 88 : 210 }}>
                {renderWidget(activeSlot.type, data, activeSlot.config, dark)}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* 카드 추가 모달 */}
      {showAdd && (
        <AddWidgetModal dark={dark} onAdd={handleAddSlot} onClose={() => setShowAdd(false)}/>
      )}

      {/* 위젯 편집 모달 (카드 밖 전체화면) */}
      {editingSlot && (
        <WidgetEditor
          slotId={editingSlot.id}
          widget={{ type: editingSlot.type, config: editingSlot.config }}
          dark={dark}
          onSave={handleWidgetSave}
          onClose={() => setEditSlot(null)}
        />
      )}
    </div>
  )
}

/* ══════════════════════════════════════════
   메인 컴포넌트

   tabsConfig: {
     tabs:         [{id, label}],
     addTab:       (label) => id,
     removeTab:    (tabId) => void,
     renameTab:    (tabId, label) => void,
     getDashboard: (tabId) => dashboard | null,
     saveDashboard:(dashboard, tabId) => void,
   }
══════════════════════════════════════════ */
export default function CustomDashboard({ dark, filterByDate, tabsConfig, subDataSource }) {
  const tabs = tabsConfig?.tabs || []

  /* 활성 탭 */
  const [activeTabId, setActiveTabId] = useState(() => tabs[0]?.id ?? null)
  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0] ?? null

  /* 활성 탭의 대시보드 (로컬 편집 상태) */
  const [dashboard, setDashboard] = useState(() => {
    if (!activeTab) return makeDashboard()
    return tabsConfig?.getDashboard(activeTab.id) ?? makeDashboard()
  })
  const [saved, setSaved] = useState(false)

  /* 탭 전환 → 대시보드 로드 */
  useEffect(() => {
    if (!activeTab) return
    const d = tabsConfig?.getDashboard(activeTab.id) ?? makeDashboard()
    setDashboard(d)
    setSaved(false)
  }, [activeTab?.id])

  /* 데이터 소스: L2 subDataSource.table 우선, 없으면 dashboard.dataSource, 기본값 marketing_data */
  const tableName = subDataSource?.table
    || dashboard.dataSource?.table
    || 'marketing_data'
  const fieldMap  = subDataSource?.fieldMap || {}

  const { data: rawData, loading, error } = useTableData(tableName)
  const data = useMemo(() => {
    const filtered  = filterByDate ? filterByDate(rawData) : rawData
    return applyFieldMap(filtered, fieldMap)
  }, [rawData, filterByDate, fieldMap])

  /* 탭 추가 — 자동 이동 없음 */
  const handleAddTab = (label) => {
    tabsConfig?.addTab(label)
    // setActiveTabId 호출하지 않음 — 탭설정 페이지에서 확인
  }

  /* 탭 삭제 */
  const handleRemoveTab = (tabId) => {
    tabsConfig?.removeTab(tabId)
    if (activeTabId === tabId) {
      const remaining = tabs.filter(t => t.id !== tabId)
      setActiveTabId(remaining[0]?.id ?? null)
    }
  }

  /* 저장 — 구 포맷이라면 정규화 후 저장 */
  const handleSave = () => {
    if (activeTab) tabsConfig?.saveDashboard(normalizeDashboard(dashboard), activeTab.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <Spinner dark={dark}/>

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

      {/* ── L3 탭 바 ── */}
      <L3TabBar
        tabs={tabs}
        activeId={activeTab?.id}
        onSelect={setActiveTabId}
        onAdd={handleAddTab}
        onRemove={handleRemoveTab}
        onRename={(tabId, label) => tabsConfig?.renameTab(tabId, label)}
        dark={dark}
      />

      {/* ── 컨텐츠 ── */}
      {activeTab ? (
        <div className="p-5 overflow-y-auto flex-1">
          {error && (
            <div className={`mb-4 px-4 py-2.5 rounded-lg text-xs border
              ${dark ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
              ⚠️ 데이터 조회 오류 ({tableName}): {error}
            </div>
          )}
          <DashboardGrid
            key={activeTab.id}
            tabId={activeTab.id}
            dashboard={dashboard}
            setDashboard={setDashboard}
            data={data}
            dark={dark}
            onSave={handleSave}
            saved={saved}
          />
        </div>
      ) : (
        /* 빈 상태 */
        <div className={`flex flex-col items-center justify-center flex-1 gap-5
          ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center
            ${dark ? 'bg-[#1A1D27]' : 'bg-slate-50'}`}>
            <Plus size={32} className="text-indigo-400"/>
          </div>
          <div className="text-center">
            <p className={`text-sm font-semibold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
              탭이 없습니다
            </p>
            <p className="text-xs mt-1.5">
              위의 <span className="text-indigo-400 font-semibold">+ 탭 추가</span> 버튼으로 첫 번째 탭을 만들어보세요
            </p>
            <p className={`text-xs mt-1 ${dark ? 'text-slate-600' : 'text-slate-300'}`}>
              각 탭에 원하는 위젯과 지표를 자유롭게 배치할 수 있습니다
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
