import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
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

/* ── 카드별 필터 적용: channel → campaign → ad_group 캐스케이딩 ── */
function applyWidgetFilters(data, filters) {
  if (!filters) return data
  let result = data
  if (filters.channel?.length)  result = result.filter(r => filters.channel.includes(r.channel))
  if (filters.campaign?.length) result = result.filter(r => filters.campaign.includes(r.campaign))
  if (filters.ad_group?.length) result = result.filter(r => filters.ad_group.includes(r.ad_group))
  if (filters.content?.length)  result = result.filter(r => filters.content.includes(r.content))
  if (filters.term?.length)     result = result.filter(r => filters.term.includes(r.term))
  return result
}

/* ── 테이블 목록 (나중에 product / crm 등 추가 가능) ── */
const KNOWN_TABLES = [
  { id: 'marketing_data', label: '마케팅' },
  { id: 'product_data',   label: '프로덕트' },
  { id: 'crm_data',       label: 'CRM' },
]

/* ─────────────────────────────────────────────────────────────────
   FilterSection  —  테이블→채널→캠페인→광고그룹→콘텐츠→검색어
   가로 컬럼 레이아웃 · 단계별 출현 · 컬럼별 "그룹바이" 토글
───────────────────────────────────────────────────────────────── */
function FilterSection({ filters = {}, groupBy, data, dark, onChange, onGroupByChange, initialOpen = false }) {
  const [open, setOpen] = useState(initialOpen)

  const selTable   = filters.table    || ''
  const selCh      = filters.channel  || []
  const selCp      = filters.campaign || []
  const selAg      = filters.ad_group || []
  const selContent = filters.content  || []
  const selTerm    = filters.term     || []

  /* 캐스케이딩 데이터 */
  const byChannel  = selCh.length      ? data.filter(r => selCh.includes(r.channel))           : data
  const byCampaign = selCp.length      ? byChannel.filter(r => selCp.includes(r.campaign))     : byChannel
  const byAdGroup  = selAg.length      ? byCampaign.filter(r => selAg.includes(r.ad_group))    : byCampaign
  const byContent  = selContent.length ? byAdGroup.filter(r => selContent.includes(r.content)) : byAdGroup

  const channels  = [...new Set(data.map(r => r.channel).filter(Boolean))].sort()
  const campaigns = [...new Set(byChannel.map(r => r.campaign).filter(Boolean))].sort()
  const adGroups  = [...new Set(byCampaign.map(r => r.ad_group).filter(Boolean))].sort()
  const contents  = [...new Set(byAdGroup.map(r => r.content).filter(Boolean))].sort()
  const terms     = [...new Set(byContent.map(r => r.term).filter(Boolean))].sort()

  /* 단계별 컬럼 정의 */
  const COLS = [
    { key: 'table',    label: '테이블',   isTable: true,
      opts: KNOWN_TABLES.map(t => t.id),
      labelOf: Object.fromEntries(KNOWN_TABLES.map(t => [t.id, t.label])),
      sel: selTable ? [selTable] : [], show: true },
    { key: 'channel',  label: '채널',     opts: channels,  sel: selCh,      show: true },
    { key: 'campaign', label: '캠페인',   opts: campaigns, sel: selCp,      show: selCh.length > 0 && campaigns.length > 0 },
    { key: 'ad_group', label: '광고그룹', opts: adGroups,  sel: selAg,      show: selCp.length > 0 && adGroups.length > 0 },
    { key: 'content',  label: '콘텐츠',   opts: contents,  sel: selContent, show: selAg.length > 0 && contents.length > 0 },
    { key: 'term',     label: '검색어',   opts: terms,     sel: selTerm,    show: selContent.length > 0 && terms.length > 0 },
  ].filter(c => c.show)

  /* 이벤트 핸들러 */
  const selectTable = (id) => {
    const next = selTable === id ? '' : id
    onChange({ ...filters, table: next, channel: [], campaign: [], ad_group: [], content: [], term: [] })
  }
  const toggle = (dim, val) => {
    const cur  = filters[dim] || []
    const next = cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val]
    if      (dim === 'channel')  onChange({ ...filters, channel: next,  campaign: [], ad_group: [], content: [], term: [] })
    else if (dim === 'campaign') onChange({ ...filters, campaign: next, ad_group: [], content: [], term: [] })
    else if (dim === 'ad_group') onChange({ ...filters, ad_group: next, content: [], term: [] })
    else if (dim === 'content')  onChange({ ...filters, content: next,  term: [] })
    else                         onChange({ ...filters, [dim]: next })
  }
  const clearDim = (dim) => {
    if      (dim === 'table')    onChange({ ...filters, table: '',    channel: [], campaign: [], ad_group: [], content: [], term: [] })
    else if (dim === 'channel')  onChange({ ...filters, channel: [],  campaign: [], ad_group: [], content: [], term: [] })
    else if (dim === 'campaign') onChange({ ...filters, campaign: [], ad_group: [], content: [], term: [] })
    else if (dim === 'ad_group') onChange({ ...filters, ad_group: [], content: [], term: [] })
    else if (dim === 'content')  onChange({ ...filters, content: [],  term: [] })
    else                         onChange({ ...filters, [dim]: [] })
  }

  const activeCount = (selTable ? 1 : 0) + selCh.length + selCp.length + selAg.length + selContent.length + selTerm.length

  /* 그룹바이 라벨 */
  const groupByLabel = COLS.find(c => c.key === groupBy)?.label ?? groupBy

  return (
    <div className={`rounded-xl border ${dark ? 'border-[#252836]' : 'border-slate-200'}`}>

      {/* 헤더 토글 */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left transition-colors rounded-xl
          ${dark ? 'hover:bg-[#1A1D27]' : 'hover:bg-slate-50'}`}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-xs font-bold ${dark ? 'text-slate-300' : 'text-slate-700'}`}>데이터 필터</span>
          {activeCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500 text-white font-bold">{activeCount}</span>
          )}
          {groupBy && onGroupByChange && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full
              ${dark ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-50 text-violet-600'}`}>
              그룹바이: {groupByLabel}
            </span>
          )}
        </div>
        <span className={`text-[10px] shrink-0 ml-2 ${dark ? 'text-slate-600' : 'text-slate-400'}`}>{open ? '▲' : '▼'}</span>
      </button>

      {/* 가로 컬럼 패널 */}
      {open && (
        <div className={`border-t overflow-x-auto ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
          <div className="flex min-w-max">
            {COLS.map((col, ci) => {
              const isGroupByDim = !col.isTable && groupBy === col.key
              const bdrR = ci < COLS.length - 1
                ? dark ? 'border-r border-[#252836]' : 'border-r border-slate-200'
                : ''

              return (
                <div key={col.key} className={`w-36 flex flex-col shrink-0 ${bdrR}`}>

                  {/* 컬럼 헤더 */}
                  <div className={`flex items-center justify-between px-2.5 py-1.5 border-b shrink-0
                    ${dark ? 'bg-[#0D0F18] border-[#252836]' : 'bg-slate-50 border-slate-200'}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-wide truncate
                      ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{col.label}</span>
                    {col.sel.length > 0 && !isGroupByDim && (
                      <button onClick={() => clearDim(col.key)}
                        className="text-[9px] text-indigo-400 hover:text-indigo-300 ml-1 shrink-0">해제</button>
                    )}
                  </div>

                  {/* 그룹바이 토글 (테이블 열 제외, 지원 위젯만) */}
                  {!col.isTable && onGroupByChange && (
                    <button
                      onClick={() => onGroupByChange(isGroupByDim ? null : col.key)}
                      className={`text-[10px] px-2.5 py-1 text-center border-b w-full transition-colors
                        ${dark ? 'border-[#252836]' : 'border-slate-200'}
                        ${isGroupByDim
                          ? 'bg-violet-500/15 text-violet-400 font-semibold'
                          : dark
                            ? 'text-slate-600 hover:text-slate-400 hover:bg-[#1A1D27]'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    >
                      {isGroupByDim ? '✓ 그룹바이' : '그룹바이'}
                    </button>
                  )}

                  {/* 옵션 목록 */}
                  <div className="overflow-y-auto flex flex-col" style={{ maxHeight: 164 }}>
                    {col.opts.length === 0
                      ? <p className={`text-[10px] px-2.5 py-2 ${dark ? 'text-slate-700' : 'text-slate-300'}`}>없음</p>
                      : col.opts.map(v => {
                          const lbl    = col.labelOf?.[v] ?? v
                          const isOn   = col.isTable ? selTable === v : col.sel.includes(v)
                          const dimmed = !col.isTable && isGroupByDim
                          return (
                            <button
                              key={v}
                              onClick={() => !dimmed && (col.isTable ? selectTable(v) : toggle(col.key, v))}
                              title={v}
                              className={`text-[11px] px-2.5 py-[5px] text-left truncate w-full transition-colors
                                ${dimmed
                                  ? dark ? 'text-slate-700 cursor-default' : 'text-slate-300 cursor-default'
                                  : isOn
                                    ? dark ? 'bg-indigo-500/15 text-indigo-400 font-semibold'
                                           : 'bg-indigo-50 text-indigo-600 font-semibold'
                                    : dark ? 'text-slate-400 hover:bg-[#1A1D27] hover:text-slate-200'
                                           : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                              {!dimmed && isOn ? '✓ ' : ''}{lbl}
                            </button>
                          )
                        })
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
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
   위젯 에디터 모달 — 3스텝 퍼널
   Step 1: 타입  Step 2: 설정  Step 3: 데이터 필터
══════════════════════════════════════════ */
function WidgetEditor({ slotId, widget, dark, data = [], onSave, onClose }) {
  const [step,    setStep]    = useState(1)
  const [type,    setType]    = useState(widget.type)
  const [config,  setConfig]  = useState({ ...widget.config })
  const [filters, setFilters] = useState(widget.config.filters || {})

  const upd = (k, v) => setConfig(c => ({ ...c, [k]: v }))
  const toggleMetric = mid => {
    const cur = config.metrics || []
    setConfig(c => ({ ...c, metrics: cur.includes(mid) ? cur.filter(x => x !== mid) : [...cur, mid] }))
  }
  const changeType = t => { setType(t); setConfig({ ...DEFAULT_WIDGET_CONFIG[t] }) }
  const handleSave = () => onSave(slotId, { type, config: { ...config, filters } })

  const S = {
    sel: `px-2.5 py-1.5 rounded-lg border text-xs outline-none w-full
      ${dark ? 'bg-[#0F1117] border-[#252836] text-white' : 'bg-white border-slate-200 text-slate-700'}`,
    inp: `px-2.5 py-1.5 rounded-lg border text-xs outline-none w-full
      ${dark ? 'bg-[#0F1117] border-[#252836] text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-700'}`,
    lab: `text-[10px] font-bold uppercase tracking-wide ${dark ? 'text-slate-500' : 'text-slate-400'}`,
    btn: (on) => `text-xs px-2.5 py-2 rounded-lg border text-left transition-colors
      ${on ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
           : dark ? 'border-[#252836] text-slate-400 hover:border-indigo-500/40' : 'border-slate-200 text-slate-500 hover:border-indigo-300'}`,
    typeCard: (on) => `flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all
      ${on ? 'border-indigo-500 bg-indigo-500/10'
           : dark ? 'border-[#252836] hover:border-indigo-500/40 hover:bg-[#252836]/60'
                  : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'}`,
  }

  const STEPS = ['타입', '설정', '데이터 필터']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`rounded-2xl border w-full max-w-3xl flex flex-col max-h-[90vh]
        ${dark ? 'bg-[#13151F] border-[#252836]' : 'bg-white border-slate-200 shadow-2xl'}`}>

        {/* 헤더 — 스텝 인디케이터 */}
        <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0
          ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
          <div>
            <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>위젯 설정</p>
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
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 min-h-0">

          {/* Step 1: 타입 선택 */}
          {step === 1 && (
            <div className="grid grid-cols-5 gap-3">
              {Object.entries(WIDGET_META).map(([id, m]) => (
                <button key={id} onClick={() => changeType(id)} className={S.typeCard(type === id)}>
                  <span className="text-2xl">{m.icon}</span>
                  <span className={`text-[10px] font-semibold leading-tight ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {m.label}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: 위젯별 설정 */}
          {step === 2 && (
            <>
              {type !== 'kpi' && (
                <div>
                  <p className={`${S.lab} mb-1.5`}>제목</p>
                  <input className={S.inp} value={config.title || ''}
                    onChange={e => upd('title', e.target.value)} placeholder="위젯 제목"/>
                </div>
              )}

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
            </>
          )}

          {/* Step 3: 데이터 필터 — 전체 너비, 초기 펼침 */}
          {step === 3 && (
            <FilterSection
              filters={filters}
              groupBy={config.groupBy}
              data={data}
              dark={dark}
              onChange={setFilters}
              initialOpen={true}
              onGroupByChange={['bar','donut','table'].includes(type)
                ? (dim) => upd('groupBy', dim ?? 'channel')
                : undefined}
            />
          )}
        </div>

        {/* 푸터 — 이전 / 다음 / 저장 */}
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
            <button onClick={handleSave}
              className="flex items-center gap-1.5 text-xs px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold">
              <Check size={12}/> 저장
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   드래그 가능한 카드 (dnd-kit)
══════════════════════════════════════════ */
/* 1px 행 기반 masonry: rowSpan = ceil((height + gap) / (1 + gap)) */
const MGAP = 12  // gap-3
const COLS  = 6  // grid-cols-6

function SortableCard({ slot, editMode, onEdit, onDelete, onSpanChange, onRowsChange, data, dark, gridRef }) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: slot.id, disabled: !editMode })

  /* ── refs: dnd-kit + outerRef 동시 연결 ── */
  const innerRef = useRef(null)
  const outerRef = useRef(null)
  const setRefs  = useCallback((el) => { outerRef.current = el; setNodeRef(el) }, [setNodeRef])

  /* ── masonry 높이 자동 측정 (rowsOverride 없을 때만) ── */
  const [rowSpan,  setRowSpan]  = useState(20)
  const [resizing, setResizing] = useState(false)

  useEffect(() => {
    const el = innerRef.current
    if (!el || slot.rowsOverride) return
    const calc = () => {
      const h = el.getBoundingClientRect().height
      if (h > 0) setRowSpan(Math.ceil((h + MGAP) / (1 + MGAP)))
    }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [slot.type, slot.config, data, slot.rowsOverride])

  /* 수동 높이 설정 시 rowsOverride 우선 사용 */
  const effectiveRows = slot.rowsOverride ?? rowSpan

  /* ── 스냅용: 이웃 카드의 row/col 스팬 수집 ── */
  const neighborRowSpans = useCallback(() => {
    const grid = gridRef?.current
    if (!grid) return []
    return [...grid.children]
      .filter(c => c !== outerRef.current)
      .map(c => parseInt(c.style.gridRow?.replace('span ', '') || '0'))
      .filter(r => r > 0)
  }, [gridRef])

  const neighborColSpans = useCallback(() => {
    const grid = gridRef?.current
    if (!grid) return []
    return [...grid.children]
      .filter(c => c !== outerRef.current)
      .map(c => {
        const cls = [...c.classList].find(x => x.startsWith('col-span-'))
        return cls ? parseInt(cls.replace('col-span-', '')) : 0
      })
      .filter(c => c > 0)
  }, [gridRef])

  /* ── 오른쪽 드래그 리사이즈 (가로 + 이웃 스냅) ── */
  const handleResizeStart = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const grid = gridRef?.current
    if (!grid) return

    const startX    = e.clientX
    const startCols = parseInt(slot.span.replace('col-span-', '')) || 1
    const colUnit   = (grid.getBoundingClientRect().width + MGAP) / COLS
    setResizing(true)

    const onMove = (ev) => {
      const rawCols = Math.max(1, Math.min(COLS, startCols + Math.round((ev.clientX - startX) / colUnit)))
      // 이웃 카드 너비에 자석 스냅 (같은 열 수면 즉시 흡착)
      const snap = neighborColSpans().find(n => n === rawCols)
      onSpanChange(slot.id, `col-span-${snap ?? rawCols}`)
    }
    const onUp = () => {
      setResizing(false)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup',   onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup',   onUp)
  }

  /* ── 아래쪽 드래그 리사이즈 (세로 + 이웃 스냅) ── */
  const handleBottomResizeStart = (e) => {
    e.preventDefault()
    e.stopPropagation()

    const startY    = e.clientY
    const startRows = effectiveRows
    setResizing(true)

    const onMove = (ev) => {
      const rawRows = Math.max(10, startRows + Math.round((ev.clientY - startY) / (1 + MGAP)))
      // 이웃 카드 높이에 자석 스냅 (±12 row 이내면 흡착)
      const SNAP_DIST = 12
      const snap = neighborRowSpans().find(n => Math.abs(rawRows - n) <= SNAP_DIST)
      onRowsChange(slot.id, snap ?? rawRows)
    }
    const onUp = () => {
      setResizing(false)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup',   onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup',   onUp)
  }

  const dndStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    gridRow: `span ${effectiveRows}`,
  }

  /* rowsOverride 있으면 내부 div에 고정 높이 적용 */
  const innerStyle = slot.rowsOverride
    ? { height: `${slot.rowsOverride * (1 + MGAP) - MGAP}px`, overflow: 'hidden' }
    : undefined

  return (
    <div ref={setRefs} style={dndStyle} className={`${slot.span} relative`}>
      <div ref={innerRef} style={innerStyle}>
        {editMode && (
          <>
            {/* 드래그 이동 핸들 (상단 중앙) */}
            <div
              {...attributes}
              {...listeners}
              className={`absolute top-1.5 left-1/2 -translate-x-1/2 z-20
                flex items-center px-2 py-0.5 rounded-full cursor-grab active:cursor-grabbing
                ${dark
                  ? 'bg-[#0F1117]/90 text-slate-500 hover:text-slate-300 border border-[#252836]'
                  : 'bg-white/90 text-slate-400 hover:text-slate-600 border border-slate-200 shadow-sm'}`}
            >
              <GripVertical size={11}/>
            </div>

            {/* 삭제 버튼 */}
            <button
              onClick={() => onDelete(slot.id)}
              className="absolute -top-2 -right-2 z-20 w-5 h-5 rounded-full
                bg-red-500 hover:bg-red-600 text-white shadow-lg
                flex items-center justify-center text-xs leading-none font-bold
                transition-transform hover:scale-110">
              ×
            </button>

            {/* 오른쪽 리사이즈 핸들 (가로) */}
            <div
              onPointerDown={handleResizeStart}
              title="드래그해서 너비 조절"
              className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-[5px] z-20
                w-2.5 h-10 rounded-full cursor-col-resize select-none transition-colors
                ${resizing
                  ? 'bg-indigo-500 shadow-lg shadow-indigo-500/40'
                  : dark
                    ? 'bg-[#252836] hover:bg-indigo-500'
                    : 'bg-slate-200 hover:bg-indigo-500'}`}
            />

            {/* 아래쪽 리사이즈 핸들 (세로) — 더블클릭으로 자동 높이 초기화 */}
            <div
              onPointerDown={handleBottomResizeStart}
              onDoubleClick={(e) => { e.stopPropagation(); onRowsChange(slot.id, null) }}
              title="드래그해서 높이 조절 · 더블클릭으로 자동"
              className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[5px] z-20
                h-2.5 w-10 rounded-full cursor-row-resize select-none transition-colors
                ${resizing
                  ? 'bg-indigo-500 shadow-lg shadow-indigo-500/40'
                  : dark
                    ? 'bg-[#252836] hover:bg-indigo-500'
                    : 'bg-slate-200 hover:bg-indigo-500'}`}
            />

            {/* 편집 버튼 */}
            <button
              onClick={() => onEdit(slot.id)}
              className="absolute bottom-1.5 right-1.5 z-20 flex items-center gap-1
                px-2 py-0.5 bg-indigo-600 text-white text-[10px] rounded-lg hover:bg-indigo-700">
              <Settings2 size={9}/> 편집
            </button>
          </>
        )}
        {renderWidget(slot.type, applyWidgetFilters(data, slot.config.filters), slot.config, dark)}
      </div>
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
function L3TabBar({ tabs, activeId, onSelect, onAdd, onRemove, onRename, onReorder, dark, rightSlot }) {
  const [addingTab, setAddingTab] = useState(false)
  const [newLabel,  setNewLabel]  = useState('')
  const [renaming,  setRenaming]  = useState(null) // { id, value }

  /* ── 탭 가로 드래그 순서 변경 ── */
  const tabDragFrom = useRef(null)
  const tabDragTo   = useRef(null)
  const [draggingTabId, setDraggingTabId] = useState(null)

  const onTabDragStart = (e, idx, tabId) => {
    tabDragFrom.current = idx; setDraggingTabId(tabId)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onTabDragEnter = (e, idx) => { tabDragTo.current = idx; e.preventDefault() }
  const onTabDragOver  = e => e.preventDefault()
  const onTabDragEnd   = () => {
    const from = tabDragFrom.current, to = tabDragTo.current
    if (from !== null && to !== null && from !== to) {
      onReorder?.(from, to)
    }
    tabDragFrom.current = null; tabDragTo.current = null; setDraggingTabId(null)
  }

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
    <div className={`flex items-stretch border-b shrink-0
      ${dark ? 'border-[#252836]' : 'border-slate-200'}`}>

      {/* 탭 목록 (스크롤 가능) */}
      <div className="flex items-center gap-0.5 px-5 pt-3 overflow-x-auto flex-1 min-w-0">

      {tabs.map((tab, tabIdx) => (
        <div key={tab.id}
          draggable
          onDragStart={e => onTabDragStart(e, tabIdx, tab.id)}
          onDragEnter={e => onTabDragEnter(e, tabIdx)}
          onDragOver={onTabDragOver}
          onDragEnd={onTabDragEnd}
          className={`relative group shrink-0 transition-opacity ${draggingTabId === tab.id ? 'opacity-30' : ''}`}
        >
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
              title="더블클릭으로 이름 변경 · 드래그로 순서 변경"
              className={`text-xs px-4 py-2.5 rounded-t-lg border-b-2 font-medium
                transition-colors whitespace-nowrap cursor-grab active:cursor-grabbing
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

      </div>{/* end 탭 스크롤 영역 */}

      {/* 우측 슬롯 — 대시보드 편집 툴바 */}
      {rightSlot && (
        <div className={`flex items-center gap-2 px-4 shrink-0 border-l
          ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
          {rightSlot}
        </div>
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
function AddWidgetModal({ dark, data = [], onAdd, onClose }) {
  const [step,    setStep]    = useState(1)   // 1:타입 선택  2:설정
  const [type,    setType]    = useState('kpi')
  const [config,  setConfig]  = useState({ ...DEFAULT_WIDGET_CONFIG.kpi })
  const [filters, setFilters] = useState({})

  const upd = (k, v) => setConfig(c => ({ ...c, [k]: v }))

  const changeType = t => { setType(t); setConfig({ ...DEFAULT_WIDGET_CONFIG[t] }); setStep(2) }

  const toggleMetric = mid => {
    const cur = config.metrics || []
    setConfig(c => ({ ...c, metrics: cur.includes(mid) ? cur.filter(x => x !== mid) : [...cur, mid] }))
  }

  const handleAdd = () => {
    onAdd({ id: `w_${Date.now()}`, span: 'col-span-2', type, config: { ...config, filters } })
    onClose()
  }

  const S = {
    card: (on) => `flex flex-col items-center gap-2 p-4 rounded-xl border text-center cursor-pointer transition-all
      ${on ? 'border-indigo-500 bg-indigo-500/10'
           : dark ? 'border-[#252836] hover:border-indigo-500/40 hover:bg-[#252836]/60'
                  : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'}`,
    sel: `px-2.5 py-1.5 rounded-lg border text-xs outline-none w-full
      ${dark ? 'bg-[#0F1117] border-[#252836] text-white' : 'bg-white border-slate-200 text-slate-700'}`,
    inp: `px-2.5 py-1.5 rounded-lg border text-xs outline-none w-full
      ${dark ? 'bg-[#0F1117] border-[#252836] text-white placeholder:text-slate-600' : 'bg-white border-slate-200 text-slate-700'}`,
    lab: `text-[10px] font-bold uppercase tracking-wide ${dark ? 'text-slate-500' : 'text-slate-400'}`,
    btn: (on) => `text-xs px-2 py-1.5 rounded-lg border text-left transition-colors
      ${on ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
           : dark ? 'border-[#252836] text-slate-400 hover:border-indigo-500/40' : 'border-slate-200 text-slate-500 hover:border-indigo-300'}`,
  }

  const STEPS = ['타입 선택', '설정']

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className={`rounded-t-2xl sm:rounded-2xl border w-full sm:max-w-3xl flex flex-col max-h-[90vh]
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
                  {i < 1 && <span className={`text-[10px] mx-0.5 ${dark ? 'text-slate-700' : 'text-slate-300'}`}>›</span>}
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
        <div className="flex-1 overflow-y-auto p-5 min-h-0">

          {/* Step 1: 타입 */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(WIDGET_META).map(([id, meta]) => (
                <button key={id} onClick={() => changeType(id)}
                  className={S.card(type === id)}>
                  <span className="text-3xl">{meta.icon}</span>
                  <span className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-700'}`}>{meta.label}</span>
                  <span className={`text-[10px] leading-tight ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{meta.desc}</span>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: 설정 */}
          {step === 2 && (
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

              {/* 데이터 필터 — 모든 카드 타입 공통 */}
              <FilterSection
                filters={filters}
                groupBy={config.groupBy}
                data={data}
                dark={dark}
                onChange={setFilters}
                onGroupByChange={['bar','donut','table'].includes(type)
                  ? (dim) => upd('groupBy', dim ?? 'channel')
                  : undefined}
              />
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
          {step < 2 ? (
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
function DashboardGrid({ tabId, dashboard, setDashboard, data, dark, editMode, showAdd, onOpenAdd, onCloseAdd }) {
  const [editSlot,   setEditSlot]   = useState(null)   // 편집 모달 대상 slotId
  const [activeId,   setActiveId]   = useState(null)   // 드래그 중인 slotId
  const gridRef = useRef(null)                         // 그리드 컨테이너 ref (리사이즈용)

  // 탭 전환 시 에디터 초기화
  useEffect(() => {
    setEditSlot(null)
  }, [tabId])

  // editMode 해제 시 에디터 닫기
  useEffect(() => {
    if (!editMode) setEditSlot(null)
  }, [editMode])

  // 정규화된 슬롯 배열
  const norm  = useMemo(() => normalizeDashboard(dashboard), [dashboard])
  const slots = norm.slots || []

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

  const handleRowsChange = (id, rows) => {
    setDashboard({ ...norm, slots: slots.map(s => s.id === id ? { ...s, rowsOverride: rows ?? undefined } : s) })
  }

  const handleWidgetSave = (slotId, widget) => {
    setDashboard({ ...norm, slots: slots.map(s => s.id === slotId ? { ...s, ...widget } : s) })
    setEditSlot(null)
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
          <button onClick={onOpenAdd}
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
            <div ref={gridRef} className="grid grid-cols-6 gap-3" style={{ gridAutoRows: '1px' }}>
              {slots.map(slot => (
                <SortableCard
                  key={slot.id}
                  slot={slot}
                  editMode={editMode}
                  onEdit={setEditSlot}
                  onDelete={handleDeleteSlot}
                  onSpanChange={handleSpanChange}
                  onRowsChange={handleRowsChange}
                  data={data}
                  dark={dark}
                  gridRef={gridRef}
                />
              ))}
              {/* 편집모드: 인라인 추가 버튼 */}
              {editMode && (
                <div onClick={onOpenAdd}
                  style={{ gridRow: 'span 8' }}
                  className={`col-span-1 rounded-xl border-2 border-dashed cursor-pointer
                    flex flex-col items-center justify-center gap-1.5 transition-colors select-none
                    ${dark
                      ? 'border-[#252836] text-slate-600 hover:border-indigo-500/50 hover:text-indigo-400 hover:bg-indigo-500/5'
                      : 'border-slate-200 text-slate-300 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50'}`}>
                  <Plus size={16}/>
                  <span className="text-[10px] font-semibold">카드 추가</span>
                </div>
              )}
            </div>
          </SortableContext>

          {/* 드래그 중 고스트 카드 */}
          <DragOverlay>
            {activeSlot && (
              <div className={`${activeSlot.span} rounded-xl border-2 border-indigo-500 opacity-90 shadow-2xl`}
                style={{ ...(activeSlot.type !== 'kpi' && { minHeight: 210 }) }}>
                {renderWidget(activeSlot.type, applyWidgetFilters(data, activeSlot.config.filters), activeSlot.config, dark)}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* 카드 추가 모달 */}
      {showAdd && (
        <AddWidgetModal dark={dark} data={data} onAdd={handleAddSlot} onClose={onCloseAdd}/>
      )}

      {/* 위젯 편집 모달 (카드 밖 전체화면) */}
      {editingSlot && (
        <WidgetEditor
          slotId={editingSlot.id}
          widget={{ type: editingSlot.type, config: editingSlot.config }}
          data={data}
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
  const [saved,    setSaved]    = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [showAdd,  setShowAdd]  = useState(false)

  const currentTable = dashboard.dataSource?.table || 'marketing_data'

  const handleTableChange = (tableName) => {
    const n = normalizeDashboard(dashboard)
    setDashboard({ ...n, dataSource: { ...(n.dataSource || {}), table: tableName } })
  }

  /* 탭 전환 → 대시보드 로드 + 편집 상태 초기화 */
  useEffect(() => {
    if (!activeTab) return
    const d = tabsConfig?.getDashboard(activeTab.id) ?? makeDashboard()
    setDashboard(d)
    setSaved(false)
    setEditMode(false)
    setShowAdd(false)
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
        onReorder={(from, to) => tabsConfig?.reorderTabs?.(from, to)}
        dark={dark}
        rightSlot={activeTab ? (
          editMode ? (
            <>
              <button onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                  bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                <Plus size={12}/> 카드 추가
              </button>
              <DataSourceSelector tableName={currentTable} onChange={handleTableChange} dark={dark}/>
              <button onClick={() => { setEditMode(false); setShowAdd(false) }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors
                  ${dark ? 'border-[#252836] text-slate-400 hover:text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                취소
              </button>
              <button onClick={() => { handleSave(); setEditMode(false) }}
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
          )
        ) : null}
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
            editMode={editMode}
            showAdd={showAdd}
            onOpenAdd={() => setShowAdd(true)}
            onCloseAdd={() => setShowAdd(false)}
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
