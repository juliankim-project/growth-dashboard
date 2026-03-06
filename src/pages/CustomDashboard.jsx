import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Settings2, Check, X, Plus, Database, GripVertical } from 'lucide-react'
import {
  TEMPLATES, WIDGET_TYPES, METRICS, GROUP_BY,
  makeDashboard, DEFAULT_WIDGET_CONFIG,
  SUB_TYPES, DEFAULT_SUB_TYPE, TYPE_TEMPLATES,
  useConfig,
} from '../store/useConfig'
import { applyComputedColumns, buildTableMetrics, buildTableGroupBy } from '../store/columnUtils'
import KanbanBoard from '../components/pages/KanbanBoard'
import FunnelPage from '../components/pages/FunnelPage'
import SimulationPage from '../components/pages/SimulationPage'
import CohortPage from '../components/pages/CohortPage'
import { useTableData } from '../hooks/useTableData'
import Spinner from '../components/UI/Spinner'
import ErrorBoundary from '../components/UI/ErrorBoundary'
import KPIWidget from '../components/widgets/KPIWidget'
import TimeSeriesWidget from '../components/widgets/TimeSeriesWidget'
import BarWidget from '../components/widgets/BarWidget'
import DonutWidget from '../components/widgets/DonutWidget'
import TableWidget from '../components/widgets/TableWidget'
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
  if (filters.channel?.length) result = result.filter(r => filters.channel.includes(r.channel))
  if (filters.campaign?.length) result = result.filter(r => filters.campaign.includes(r.campaign))
  if (filters.ad_group?.length) result = result.filter(r => filters.ad_group.includes(r.ad_group))
  if (filters.ad_creative?.length) result = result.filter(r => filters.ad_creative.includes(r.ad_creative))
  if (filters.content?.length) result = result.filter(r => filters.content.includes(r.content))
  if (filters.term?.length) result = result.filter(r => filters.term.includes(r.term))
  return result
}

/* ── 테이블 목록 (나중에 product / crm 등 추가 가능) ── */
const KNOWN_TABLES = [
  { id: 'marketing_data', label: '마케팅' },
  { id: 'product_data', label: '프로덕트' },
  { id: 'crm_data', label: 'CRM' },
]

/* ─────────────────────────────────────────────────────────────────
   FilterSection  —  테이블→채널→캠페인→광고그룹→콘텐츠→검색어
   가로 컬럼 레이아웃 · 단계별 출현 · 컬럼별 "그룹바이" 토글
───────────────────────────────────────────────────────────────── */
function FilterSection({ filters = {}, groupBy, data, dark, onChange, onGroupByChange, initialOpen = false }) {
  const [open, setOpen] = useState(initialOpen)

  const selTable = filters.table || ''
  const selCh = filters.channel || []
  const selCp = filters.campaign || []
  const selAg = filters.ad_group || []
  const selAc = filters.ad_creative || []
  const selContent = filters.content || []
  const selTerm = filters.term || []

  /* 캐스케이딩 데이터 */
  const byChannel = selCh.length ? data.filter(r => selCh.includes(r.channel)) : data
  const byCampaign = selCp.length ? byChannel.filter(r => selCp.includes(r.campaign)) : byChannel
  const byAdGroup = selAg.length ? byCampaign.filter(r => selAg.includes(r.ad_group)) : byCampaign
  const byAdCreative = selAc.length ? byAdGroup.filter(r => selAc.includes(r.ad_creative)) : byAdGroup
  const byContent = selContent.length ? byAdCreative.filter(r => selContent.includes(r.content)) : byAdCreative

  const channels = [...new Set(data.map(r => r.channel).filter(Boolean))].sort()
  const campaigns = [...new Set(byChannel.map(r => r.campaign).filter(Boolean))].sort()
  const adGroups = [...new Set(byCampaign.map(r => r.ad_group).filter(Boolean))].sort()
  const adCreatives = [...new Set(byAdGroup.map(r => r.ad_creative).filter(Boolean))].sort()
  const contents = [...new Set(byAdGroup.map(r => r.content).filter(Boolean))].sort()
  /* term: ad_group 선택 후 바로 출현 (Naver처럼 content 없는 경우 대응) */
  const terms = [...new Set(byContent.map(r => r.term).filter(Boolean))].sort()

  /* 단계별 컬럼 정의
     · ad_creative, content 는 ad_group 선택 후 데이터 있으면 동시 출현 (플랫폼별 차이)
     · term 은 ad_group 선택 후 바로 출현 (content/ad_creative 없어도) */
  const COLS = [
    {
      key: 'table', label: '테이블', isTable: true,
      opts: KNOWN_TABLES.map(t => t.id),
      labelOf: Object.fromEntries(KNOWN_TABLES.map(t => [t.id, t.label])),
      sel: selTable ? [selTable] : [], show: true
    },
    { key: 'channel', label: '채널', opts: channels, sel: selCh, show: true },
    { key: 'campaign', label: '캠페인', opts: campaigns, sel: selCp, show: selCh.length > 0 && campaigns.length > 0 },
    { key: 'ad_group', label: '광고그룹', opts: adGroups, sel: selAg, show: selCp.length > 0 && adGroups.length > 0 },
    { key: 'ad_creative', label: '크리에이티브', opts: adCreatives, sel: selAc, show: selAg.length > 0 && adCreatives.length > 0 },
    { key: 'content', label: '콘텐츠', opts: contents, sel: selContent, show: selAg.length > 0 && contents.length > 0 },
    { key: 'term', label: '검색어', opts: terms, sel: selTerm, show: selAg.length > 0 && terms.length > 0 },
  ].filter(c => c.show)

  /* 이벤트 핸들러 */
  const selectTable = (id) => {
    const next = selTable === id ? '' : id
    onChange({ ...filters, table: next, channel: [], campaign: [], ad_group: [], ad_creative: [], content: [], term: [] })
  }
  const toggle = (dim, val) => {
    const cur = filters[dim] || []
    const next = cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val]
    if (dim === 'channel') onChange({ ...filters, channel: next, campaign: [], ad_group: [], ad_creative: [], content: [], term: [] })
    else if (dim === 'campaign') onChange({ ...filters, campaign: next, ad_group: [], ad_creative: [], content: [], term: [] })
    else if (dim === 'ad_group') onChange({ ...filters, ad_group: next, ad_creative: [], content: [], term: [] })
    else if (dim === 'ad_creative') onChange({ ...filters, ad_creative: next, term: [] })
    else if (dim === 'content') onChange({ ...filters, content: next, term: [] })
    else onChange({ ...filters, [dim]: next })
  }
  const clearDim = (dim) => {
    if (dim === 'table') onChange({ ...filters, table: '', channel: [], campaign: [], ad_group: [], ad_creative: [], content: [], term: [] })
    else if (dim === 'channel') onChange({ ...filters, channel: [], campaign: [], ad_group: [], ad_creative: [], content: [], term: [] })
    else if (dim === 'campaign') onChange({ ...filters, campaign: [], ad_group: [], ad_creative: [], content: [], term: [] })
    else if (dim === 'ad_group') onChange({ ...filters, ad_group: [], ad_creative: [], content: [], term: [] })
    else if (dim === 'ad_creative') onChange({ ...filters, ad_creative: [], term: [] })
    else if (dim === 'content') onChange({ ...filters, content: [], term: [] })
    else onChange({ ...filters, [dim]: [] })
  }

  const activeCount = (selTable ? 1 : 0) + selCh.length + selCp.length + selAg.length + selAc.length + selContent.length + selTerm.length

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
        <span className={`text-[10px] shrink-0 ml-2 ${dark ? 'text-slate-600' : 'text-slate-600'}`}>{open ? '▲' : '▼'}</span>
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
                      ${dark ? 'text-slate-400' : 'text-slate-700'}`}>{col.label}</span>
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
                            : 'text-slate-600 hover:text-slate-600 hover:bg-slate-50'}`}
                    >
                      {isGroupByDim ? '✓ 그룹바이' : '그룹바이'}
                    </button>
                  )}

                  {/* 옵션 목록 */}
                  <div className="overflow-y-auto flex flex-col" style={{ maxHeight: 164 }}>
                    {col.opts.length === 0
                      ? <p className={`text-[10px] px-2.5 py-2 ${dark ? 'text-slate-600' : 'text-slate-600'}`}>없음</p>
                      : col.opts.map(v => {
                        const lbl = col.labelOf?.[v] ?? v
                        const isOn = col.isTable ? selTable === v : col.sel.includes(v)
                        const dimmed = !col.isTable && isGroupByDim
                        return (
                          <button
                            key={v}
                            onClick={() => !dimmed && (col.isTable ? selectTable(v) : toggle(col.key, v))}
                            title={v}
                            className={`text-[11px] px-2.5 py-[5px] text-left w-full transition-colors leading-snug break-words
                                ${dimmed
                                ? dark ? 'text-slate-700 cursor-default' : 'text-slate-700 cursor-default'
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
const renderWidget = (type, data, cfg, dark, metrics) => {
  const C = WIDGET_MAP[type]
  if (!C) return null
  return (
    <ErrorBoundary dark={dark} label={type}>
      <C data={data} config={cfg} dark={dark} metrics={metrics} />
    </ErrorBoundary>
  )
}

/* ══════════════════════════════════════════
   데이터 소스 셀렉터 (편집모드에서 테이블 선택)
══════════════════════════════════════════ */
function DataSourceSelector({ tableName, onChange, dark }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(tableName)

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
          : 'border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-300'}`}
    >
      <Database size={11} />
      <span className="font-mono">{tableName}</span>
    </button>
  )

  return (
    <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-0.5
      ${dark ? 'border-indigo-500 bg-[#0F1117]' : 'border-indigo-400 bg-white shadow'}`}>
      <Database size={11} className="text-indigo-400 shrink-0" />
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        list="known-tables"
        placeholder="테이블명 입력"
        className={`text-xs outline-none w-36 font-mono bg-transparent
          ${dark ? 'text-white placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-600'}`}
      />
      <datalist id="known-tables">
        {KNOWN_TABLES.map(t => <option key={t} value={t} />)}
      </datalist>
      <button onClick={commit}
        className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded hover:bg-indigo-700">
        확인
      </button>
      <button onClick={() => setEditing(false)}
        className={`text-[10px] px-1.5 py-0.5 rounded ${dark ? 'text-slate-400 hover:text-white' : 'text-slate-700'}`}>
        취소
      </button>
    </div>
  )
}

/* ══════════════════════════════════════════
   위젯 에디터 모달 — 3스텝 퍼널
   Step 1: 타입  Step 2: 설정  Step 3: 데이터 필터
══════════════════════════════════════════ */
function WidgetEditor({ slotId, widget, dark, data = [], onSave, onClose, subType = 'report', metrics: metricsProp, groupByOptions }) {
  const [step, setStep] = useState(1)
  const [type, setType] = useState(widget.type)
  const [config, setConfig] = useState({ ...widget.config })
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
      ${dark ? 'bg-[#0F1117] border-[#252836] text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-700'}`,
    lab: `text-[10px] font-bold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-slate-700'}`,
    btn: (on) => `text-xs px-2.5 py-2 rounded-lg border text-left transition-colors
      ${on ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
        : dark ? 'border-[#252836] text-slate-400 hover:border-indigo-500/40' : 'border-slate-200 text-slate-700 hover:border-indigo-300'}`,
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
                    ${step === i + 1 ? 'bg-indigo-500 text-white'
                      : step > i + 1 ? 'bg-emerald-500 text-white'
                        : dark ? 'bg-[#252836] text-slate-500' : 'bg-slate-100 text-slate-600'}`}>
                    {step > i + 1 ? '✓' : i + 1}
                  </div>
                  <span className={`text-[10px] font-medium
                    ${step === i + 1 ? (dark ? 'text-slate-200' : 'text-slate-700') : dark ? 'text-slate-600' : 'text-slate-600'}`}>
                    {s}
                  </span>
                  {i < 2 && <span className={`text-[10px] mx-0.5 ${dark ? 'text-slate-600' : 'text-slate-600'}`}>›</span>}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose}
            className={`p-2 rounded-xl ${dark ? 'text-slate-400 hover:bg-[#252836] hover:text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            <X size={16} />
          </button>
        </div>

        {/* 바디 */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 min-h-0">

          {/* Step 1: 타입 선택 */}
          {step === 1 && (() => {
            const filtered = getFilteredWidgetMeta(subType)
            const cols = Object.keys(filtered).length
            return (
              <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${Math.min(cols, 5)}, 1fr)` }}>
                {Object.entries(filtered).map(([id, m]) => (
                  <button key={id} onClick={() => changeType(id)} className={S.typeCard(type === id)}>
                    <span className="text-2xl">{m.icon}</span>
                    <span className={`text-[10px] font-semibold leading-tight ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
                      {m.label}
                    </span>
                  </button>
                ))}
              </div>
            )
          })()}

          {/* Step 2: 위젯별 설정 */}
          {step === 2 && (
            <>
              {type !== 'kpi' && (
                <div>
                  <p className={`${S.lab} mb-1.5`}>제목</p>
                  <input className={S.inp} value={config.title || ''}
                    onChange={e => upd('title', e.target.value)} placeholder="위젯 제목" />
                </div>
              )}

              {type === 'kpi' && (
                <>
                  <div>
                    <p className={`${S.lab} mb-2`}>지표</p>
                    <div className="flex flex-col gap-3">
                      {['metric', 'rate'].map(group => (
                        <div key={group}>
                          <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
                            {group === 'metric' ? '지표' : '단가'}
                          </p>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(metricsProp || METRICS).filter(m => m.group === group).map(m => (
                              <button key={m.id} onClick={() => upd('metric', m.id)} className={S.btn(config.metric === m.id)}>
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>커스텀 라벨 (선택)</p>
                    <input className={S.inp} value={config.label || ''}
                      onChange={e => upd('label', e.target.value)} placeholder="기본: 지표명 사용" />
                  </div>
                </>
              )}

              {type === 'timeseries' && (
                <div>
                  <p className={`${S.lab} mb-2`}>지표 (복수 선택)</p>
                  <div className="flex flex-col gap-3">
                    {['metric', 'rate'].map(group => (
                      <div key={group}>
                        <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
                          {group === 'metric' ? '지표' : '단가'}
                        </p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(metricsProp || METRICS).filter(m => m.group === group).map(m => {
                            const on = (config.metrics || []).includes(m.id)
                            return (
                              <button key={m.id} onClick={() => toggleMetric(m.id)} className={S.btn(on)}>
                                {on ? '✓ ' : ''}{m.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(type === 'bar' || type === 'donut') && (
                <>
                  <div>
                    <p className={`${S.lab} mb-2`}>지표</p>
                    <div className="flex flex-col gap-3">
                      {['metric', 'rate'].map(group => (
                        <div key={group}>
                          <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
                            {group === 'metric' ? '지표' : '단가'}
                          </p>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(metricsProp || METRICS).filter(m => m.group === group).map(m => (
                              <button key={m.id} onClick={() => upd('metric', m.id)} className={S.btn(config.metric === m.id)}>
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>그룹 기준</p>
                    <select className={S.sel} value={config.groupBy || 'channel'}
                      onChange={e => upd('groupBy', e.target.value)}>
                      {(groupByOptions || GROUP_BY).map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                  </div>
                </>
              )}

              {type === 'table' && (
                <>
                  <div>
                    <p className={`${S.lab} mb-2`}>표시 지표 (복수 선택)</p>
                    <div className="flex flex-col gap-3">
                      {['metric', 'rate'].map(group => (
                        <div key={group}>
                          <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
                            {group === 'metric' ? '지표' : '단가'}
                          </p>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(metricsProp || METRICS).filter(m => m.group === group).map(m => {
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
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>그룹 기준</p>
                    <select className={S.sel} value={config.groupBy || 'channel'}
                      onChange={e => upd('groupBy', e.target.value)}>
                      {(groupByOptions || GROUP_BY).map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
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
              onGroupByChange={['bar', 'donut', 'table'].includes(type)
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
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
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
              <Check size={12} /> 저장
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   드래그 가능한 카드 (dnd-kit) — 픽셀 기반 자유 리사이즈 + 자석 스냅
══════════════════════════════════════════ */
const MGAP = 12          // gap-3 (12px)
const MIN_W_PCT = 10     // 최소 너비 10%
const MIN_H_PX = 80      // 최소 높이 80px
const SNAP_RANGE = 15    // ±15px 스냅 허용 범위

/* widthPct → CSS width 변환: flex-wrap 갭 보정 */
function pctToWidth(pct) {
  const gapAdj = MGAP * (1 - pct / 100)
  return `calc(${pct}% - ${gapAdj}px)`
}

/* 스냅 헬퍼: 이웃 값 중 ±SNAP_RANGE 내에 있으면 해당 값 반환 */
function findSnap(value, neighbors, range = SNAP_RANGE) {
  for (const n of neighbors) {
    if (Math.abs(value - n) <= range) return n
  }
  return null
}

function SortableCard({ slot, editMode, onEdit, onDelete, onWidthChange, onHeightChange, data, dark, gridRef, tableMetrics }) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: slot.id, disabled: !editMode })

  const outerRef = useRef(null)
  const setRefs = useCallback((el) => { outerRef.current = el; setNodeRef(el) }, [setNodeRef])

  const [resizing, setResizing] = useState(false)
  const [sizeTooltip, setSizeTooltip] = useState(null)  // { w, h } 리사이즈 중 표시
  const [snapping, setSnapping] = useState(false)        // 스냅 시 핸들 색상 변경

  /* 이웃 카드 오른쪽 가장자리 x좌표 수집 (너비 스냅용) */
  const getNeighborRightEdges = useCallback(() => {
    const grid = gridRef?.current
    if (!grid) return []
    return [...grid.querySelectorAll('[data-slot-id]')]
      .filter(c => c.dataset.slotId !== slot.id)
      .map(c => c.getBoundingClientRect().right)
  }, [gridRef, slot.id])

  /* 이웃 카드 아래쪽 가장자리 y좌표 수집 (높이 스냅용) */
  const getNeighborBottomEdges = useCallback(() => {
    const grid = gridRef?.current
    if (!grid) return []
    return [...grid.querySelectorAll('[data-slot-id]')]
      .filter(c => c.dataset.slotId !== slot.id)
      .map(c => c.getBoundingClientRect().bottom)
  }, [gridRef, slot.id])

  /* ── 통합 리사이즈 핸들러 (right / bottom / corner) ── */
  const startResize = (e, direction) => {
    e.preventDefault()
    e.stopPropagation()
    const grid = gridRef?.current
    const el = outerRef.current
    if (!grid || !el) return

    const gridW = grid.getBoundingClientRect().width
    const startX = e.clientX
    const startY = e.clientY
    const elRect = el.getBoundingClientRect()
    const startW = elRect.width
    const startH = elRect.height
    const startLeft = elRect.left
    const startTop = elRect.top
    setResizing(true)

    const onMove = (ev) => {
      let newW = startW
      let newH = startH
      let snapped = false

      if (direction === 'right' || direction === 'corner') {
        newW = Math.max(gridW * MIN_W_PCT / 100, startW + (ev.clientX - startX))
        // 오른쪽 가장자리 위치 기반 스냅 (시각적 정렬)
        const myRight = startLeft + newW
        const snapRight = findSnap(myRight, getNeighborRightEdges())
        if (snapRight !== null) { newW = snapRight - startLeft; snapped = true }
        const pct = Math.min(100, Math.max(MIN_W_PCT, (newW + MGAP) / (gridW + MGAP) * 100))
        onWidthChange(slot.id, Math.round(pct * 100) / 100)
      }

      if (direction === 'bottom' || direction === 'corner') {
        newH = Math.max(MIN_H_PX, startH + (ev.clientY - startY))
        // 아래쪽 가장자리 위치 기반 스냅 (시각적 정렬)
        const myBottom = startTop + newH
        const snapBottom = findSnap(myBottom, getNeighborBottomEdges())
        if (snapBottom !== null) { newH = snapBottom - startTop; snapped = true }
        onHeightChange(slot.id, Math.round(newH))
      }

      setSnapping(snapped)
      setSizeTooltip({ w: Math.round(newW), h: Math.round(newH) })
    }

    const onUp = () => {
      setResizing(false)
      setSizeTooltip(null)
      setSnapping(false)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  const widthPct = slot.widthPct ?? 33.33
  const heightPx = slot.heightPx

  const cardStyle = {
    width: pctToWidth(widthPct),
    ...(heightPx ? { height: `${heightPx}px` } : {}),
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  }

  const handleColor = snapping
    ? 'bg-purple-500 shadow-lg shadow-purple-500/40'
    : resizing
      ? 'bg-indigo-500 shadow-lg shadow-indigo-500/40'
      : dark
        ? 'bg-[#252836] hover:bg-indigo-500'
        : 'bg-slate-200 hover:bg-indigo-500'

  return (
    <div ref={setRefs} style={cardStyle} data-slot-id={slot.id}
      className="relative shrink-0">
      {editMode && (
        <>
          {/* 드래그 이동 핸들 (상단 중앙) */}
          <div
            {...attributes}
            {...listeners}
            className={`absolute top-1.5 left-1/2 -translate-x-1/2 z-20
              flex items-center px-2 py-0.5 rounded-full cursor-grab active:cursor-grabbing
              ${dark
                ? 'bg-[#0F1117]/90 text-slate-400 hover:text-slate-200 border border-[#252836]'
                : 'bg-white/90 text-slate-600 hover:text-slate-600 border border-slate-200 shadow-sm'}`}
          >
            <GripVertical size={11} />
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
            onPointerDown={e => startResize(e, 'right')}
            title="드래그해서 너비 조절"
            className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-[5px] z-20
              w-2.5 h-10 rounded-full cursor-col-resize select-none transition-colors ${handleColor}`}
          />

          {/* 아래쪽 리사이즈 핸들 (세로) — 더블클릭으로 자동 높이 초기화 */}
          <div
            onPointerDown={e => startResize(e, 'bottom')}
            onDoubleClick={(e) => { e.stopPropagation(); onHeightChange(slot.id, null) }}
            title="드래그해서 높이 조절 · 더블클릭으로 자동"
            className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[5px] z-20
              h-2.5 w-10 rounded-full cursor-row-resize select-none transition-colors ${handleColor}`}
          />

          {/* 코너 리사이즈 핸들 (우하단) */}
          <div
            onPointerDown={e => startResize(e, 'corner')}
            title="드래그해서 크기 조절"
            className={`absolute bottom-0 right-0 translate-x-[4px] translate-y-[4px] z-20
              w-4 h-4 rounded-full cursor-nwse-resize select-none transition-colors ${handleColor}`}
          />

          {/* 편집 버튼 */}
          <button
            onClick={() => onEdit(slot.id)}
            className="absolute bottom-1.5 right-1.5 z-20 flex items-center gap-1
              px-2 py-0.5 bg-indigo-600 text-white text-[10px] rounded-lg hover:bg-indigo-700">
            <Settings2 size={9} /> 편집
          </button>

          {/* 리사이즈 사이즈 툴팁 */}
          {sizeTooltip && (
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30
              px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold pointer-events-none
              ${snapping ? 'bg-purple-600 text-white' : 'bg-black/70 text-white'}`}>
              {sizeTooltip.w} × {sizeTooltip.h}
            </div>
          )}
        </>
      )}
      <div className={heightPx ? 'h-full overflow-hidden rounded-xl' : ''}>
        {renderWidget(slot.type, applyWidgetFilters(data, slot.config.filters), slot.config, dark, tableMetrics)}
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
            className={`p-1.5 rounded-lg ${dark ? 'text-slate-400 hover:bg-[#252836]' : 'text-slate-600 hover:bg-slate-100'}`}>
            <X size={16} />
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
              <p className={`text-xs mb-3 ${dark ? 'text-slate-400' : 'text-slate-700'}`}>{tpl.desc}</p>
              <p className={`text-[10px] font-mono ${dark ? 'text-slate-400' : 'text-slate-700'}`}>{tpl.preview}</p>
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
function L3TabBar({ tabs, activeId, onSelect, onAdd, onRemove, onRename, onReorder, dark, rightSlot, addRef, subType = 'report' }) {
  const [addingTab, setAddingTab] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [showTemplates, setShowTemplates] = useState(false) // 템플릿 선택 단계
  const [pendingLabel, setPendingLabel] = useState('')       // 이름 확정 후 대기

  /* 외부(빈 상태 버튼 등)에서 탭 추가 폼 열기용 */
  useEffect(() => {
    if (addRef) addRef.current = () => { setAddingTab(true); setNewLabel('') }
  })
  const [renaming, setRenaming] = useState(null) // { id, value }

  /* ── 탭 가로 드래그 순서 변경 ── */
  const tabDragFrom = useRef(null)
  const tabDragTo = useRef(null)
  const [draggingTabId, setDraggingTabId] = useState(null)

  const onTabDragStart = (e, idx, tabId) => {
    tabDragFrom.current = idx; setDraggingTabId(tabId)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onTabDragEnter = (e, idx) => { tabDragTo.current = idx; e.preventDefault() }
  const onTabDragOver = e => e.preventDefault()
  const onTabDragEnd = () => {
    const from = tabDragFrom.current, to = tabDragTo.current
    if (from !== null && to !== null && from !== to) {
      onReorder?.(from, to)
    }
    tabDragFrom.current = null; tabDragTo.current = null; setDraggingTabId(null)
  }

  const commitAdd = () => {
    if (!newLabel.trim()) { setAddingTab(false); return }
    const templates = TYPE_TEMPLATES[subType]
    if (templates && templates.length > 0 && subType !== 'report') {
      // 비-report: 이름 확정 후 템플릿 선택
      setPendingLabel(newLabel.trim())
      setShowTemplates(true)
      setAddingTab(false)
      setNewLabel('')
    } else {
      onAdd(newLabel.trim())
      setAddingTab(false)
      setNewLabel('')
    }
  }

  const handleTemplateSelect = (templateId) => {
    onAdd(pendingLabel, templateId)
    setShowTemplates(false)
    setPendingLabel('')
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
                  if (e.key === 'Enter') commitRename()
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
                      : 'border-transparent text-slate-700 hover:text-slate-700'
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
                if (e.key === 'Enter') commitAdd()
                if (e.key === 'Escape') { setAddingTab(false); setNewLabel('') }
              }}
              placeholder="탭 이름"
              className={`text-xs px-2.5 py-1.5 rounded-lg border outline-none w-24
              ${dark
                  ? 'border-indigo-500 bg-transparent text-white placeholder:text-slate-500'
                  : 'border-indigo-400 bg-transparent text-slate-800 placeholder:text-slate-600'}`}
            />
            <button onClick={commitAdd}
              className="text-xs px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              확인
            </button>
            <button onClick={() => { setAddingTab(false); setNewLabel('') }}
              className={`text-xs px-2 py-1.5 rounded-lg
              ${dark ? 'text-slate-400 hover:text-white' : 'text-slate-700'}`}>
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingTab(true)}
            className={`shrink-0 flex items-center gap-1 text-xs px-3 py-2 ml-1
            rounded-t-lg border border-dashed mb-px transition-colors
            ${dark
                ? 'border-[#2E3450] text-slate-400 hover:text-slate-200 hover:border-slate-400'
                : 'border-slate-300 text-slate-700 hover:text-slate-700 hover:border-slate-400'}`}
          >
            <Plus size={10} /> 탭 추가
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

      {/* 템플릿 선택 팝오버 (비-report 타입) */}
      {showTemplates && (() => {
        const templates = TYPE_TEMPLATES[subType] || []
        const typeInfo = SUB_TYPES[subType]
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => { setShowTemplates(false); setPendingLabel('') }}>
            <div onClick={e => e.stopPropagation()}
              className={`rounded-2xl border w-full max-w-md p-5
              ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-xl'}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${typeInfo?.colorClasses?.badge || ''}`}>
                    {typeInfo?.icon} {typeInfo?.label}
                  </span>
                  <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
                    "{pendingLabel}" 템플릿 선택
                  </p>
                </div>
                <button onClick={() => { setShowTemplates(false); setPendingLabel('') }}
                  className={`p-1.5 rounded-lg ${dark ? 'text-slate-400 hover:bg-[#252836]' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {templates.map(tpl => (
                  <button key={tpl.id} onClick={() => handleTemplateSelect(tpl.id)}
                    className={`p-3.5 rounded-xl border text-left transition-all
                    ${dark ? 'border-[#252836] hover:border-indigo-500/40 hover:bg-[#252836]/50'
                          : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-semibold ${dark ? 'text-white' : 'text-slate-800'}`}>{tpl.name}</span>
                    </div>
                    <p className={`text-xs ${dark ? 'text-slate-400' : 'text-slate-700'}`}>{tpl.desc}</p>
                    <p className={`text-[10px] mt-1.5 font-mono ${dark ? 'text-slate-400' : 'text-slate-700'}`}>{tpl.preview}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

/* ══════════════════════════════════════════
   상수 & 유틸
══════════════════════════════════════════ */
/* col-span-N → widthPct 변환 (하위호환) */
function spanToWidthPct(span) {
  const cols = parseInt((span || '').replace('col-span-', '')) || 2
  return Math.round((cols / 6) * 10000) / 100  // 33.33, 50, 66.67 등
}

const WIDGET_META = {
  kpi: { icon: '💳', label: 'KPI 카드', desc: '핵심 지표를 강조 표시' },
  timeseries: { icon: '📈', label: '시계열 차트', desc: '날짜별 트렌드 시각화' },
  bar: { icon: '📊', label: '바 차트', desc: '채널 / 캠페인별 비교' },
  donut: { icon: '🍩', label: '도넛 차트', desc: '구성 비율 시각화' },
  table: { icon: '📋', label: '데이터 테이블', desc: '상세 수치 비교' },
}

/** subType에 허용된 위젯만 필터 */
function getFilteredWidgetMeta(subType) {
  const allowed = SUB_TYPES[subType]?.widgetTypes || SUB_TYPES[DEFAULT_SUB_TYPE].widgetTypes
  return Object.fromEntries(
    Object.entries(WIDGET_META).filter(([id]) => allowed.includes(id))
  )
}

/* ── 구 포맷 → slots 배열로 정규화 + span→widthPct 마이그레이션 ── */
function migrateSlot(s) {
  // 이미 widthPct가 있으면 그대로
  if (s.widthPct != null) return s
  // span → widthPct 변환 (하위호환)
  const widthPct = s.span ? spanToWidthPct(s.span) : 33.33
  const result = { ...s, widthPct }
  delete result.span
  // rowsOverride → heightPx 변환
  if (s.rowsOverride && !s.heightPx) {
    result.heightPx = s.rowsOverride * (1 + MGAP) - MGAP
    delete result.rowsOverride
  }
  return result
}

function normalizeDashboard(d) {
  if (!d) return { slots: [] }
  if (d.type && d.type !== 'report') return d   // 비-report 타입은 그대로 반환
  if (Array.isArray(d.slots)) return { ...d, slots: d.slots.map(migrateSlot) }
  // 구 템플릿 포맷 마이그레이션
  const tpl = TEMPLATES[d.template]
  if (!tpl) return { dataSource: d.dataSource, slots: [] }
  return {
    dataSource: d.dataSource,
    slots: tpl.slots.map(s => {
      const w = d.widgets?.[s.id]
      const type = w?.type || s.defaultType
      return migrateSlot({
        id: s.id,
        span: w?.config?.span || s.span,
        type,
        config: { ...(DEFAULT_WIDGET_CONFIG[type] || {}), ...(w?.config || {}) },
      })
    }),
  }
}

/* ══════════════════════════════════════════
   카드 추가 모달
══════════════════════════════════════════ */
function AddWidgetModal({ dark, data = [], onAdd, onClose, subType = 'report', metrics: metricsProp, groupByOptions }) {
  const [step, setStep] = useState(1)   // 1:타입 선택  2:설정
  const [type, setType] = useState('kpi')
  const [config, setConfig] = useState({ ...DEFAULT_WIDGET_CONFIG.kpi })
  const [filters, setFilters] = useState({})

  const upd = (k, v) => setConfig(c => ({ ...c, [k]: v }))

  const changeType = t => { setType(t); setConfig({ ...DEFAULT_WIDGET_CONFIG[t] }); setStep(2) }

  const toggleMetric = mid => {
    const cur = config.metrics || []
    setConfig(c => ({ ...c, metrics: cur.includes(mid) ? cur.filter(x => x !== mid) : [...cur, mid] }))
  }

  const handleAdd = () => {
    onAdd({ id: `w_${Date.now()}`, widthPct: 33.33, type, config: { ...config, filters } })
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
      ${dark ? 'bg-[#0F1117] border-[#252836] text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-700'}`,
    lab: `text-[10px] font-bold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-slate-700'}`,
    btn: (on) => `text-xs px-2 py-1.5 rounded-lg border text-left transition-colors
      ${on ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
        : dark ? 'border-[#252836] text-slate-400 hover:border-indigo-500/40' : 'border-slate-200 text-slate-700 hover:border-indigo-300'}`,
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
                    ${step === i + 1 ? 'bg-indigo-500 text-white'
                      : step > i + 1 ? 'bg-emerald-500 text-white'
                        : dark ? 'bg-[#252836] text-slate-500' : 'bg-slate-100 text-slate-600'}`}>
                    {step > i + 1 ? '✓' : i + 1}
                  </div>
                  <span className={`text-[10px] font-medium
                    ${step === i + 1 ? (dark ? 'text-slate-200' : 'text-slate-700') : dark ? 'text-slate-600' : 'text-slate-600'}`}>
                    {s}
                  </span>
                  {i < 1 && <span className={`text-[10px] mx-0.5 ${dark ? 'text-slate-600' : 'text-slate-600'}`}>›</span>}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose}
            className={`p-2 rounded-xl ${dark ? 'text-slate-400 hover:bg-[#252836] hover:text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            <X size={16} />
          </button>
        </div>

        {/* 바디 */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0">

          {/* Step 1: 타입 */}
          {step === 1 && (() => {
            const filtered = getFilteredWidgetMeta(subType)
            return (
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(filtered).map(([id, meta]) => (
                  <button key={id} onClick={() => changeType(id)}
                    className={S.card(type === id)}>
                    <span className="text-3xl">{meta.icon}</span>
                    <span className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-700'}`}>{meta.label}</span>
                    <span className={`text-[10px] leading-tight ${dark ? 'text-slate-400' : 'text-slate-700'}`}>{meta.desc}</span>
                  </button>
                ))}
              </div>
            )
          })()}

          {/* Step 2: 설정 */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              {type === 'kpi' && (
                <>
                  <div>
                    <p className={`${S.lab} mb-2`}>지표</p>
                    <div className="flex flex-col gap-3">
                      {['metric', 'rate'].map(group => (
                        <div key={group}>
                          <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
                            {group === 'metric' ? '지표' : '단가'}
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(metricsProp || METRICS).filter(m => m.group === group).map(m => (
                              <button key={m.id} onClick={() => upd('metric', m.id)} className={S.btn(config.metric === m.id)}>
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>커스텀 라벨 (선택)</p>
                    <input className={S.inp} value={config.label || ''}
                      onChange={e => upd('label', e.target.value)} placeholder="기본: 지표명 사용" />
                  </div>
                </>
              )}

              {type === 'timeseries' && (
                <>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>제목</p>
                    <input className={S.inp} value={config.title || ''}
                      onChange={e => upd('title', e.target.value)} placeholder="위젯 제목" />
                  </div>
                  <div>
                    <p className={`${S.lab} mb-2`}>지표 (복수 선택)</p>
                    <div className="flex flex-col gap-3">
                      {['metric', 'rate'].map(group => (
                        <div key={group}>
                          <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
                            {group === 'metric' ? '지표' : '단가'}
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(metricsProp || METRICS).filter(m => m.group === group).map(m => {
                              const on = (config.metrics || []).includes(m.id)
                              return (
                                <button key={m.id} onClick={() => toggleMetric(m.id)} className={S.btn(on)}>
                                  {on ? '✓ ' : ''}{m.label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {(type === 'bar' || type === 'donut') && (
                <>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>제목</p>
                    <input className={S.inp} value={config.title || ''}
                      onChange={e => upd('title', e.target.value)} placeholder="위젯 제목" />
                  </div>
                  <div>
                    <p className={`${S.lab} mb-2`}>지표</p>
                    <div className="flex flex-col gap-3">
                      {['metric', 'rate'].map(group => (
                        <div key={group}>
                          <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
                            {group === 'metric' ? '지표' : '단가'}
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(metricsProp || METRICS).filter(m => m.group === group).map(m => (
                              <button key={m.id} onClick={() => upd('metric', m.id)} className={S.btn(config.metric === m.id)}>
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>그룹 기준</p>
                    <select className={S.sel} value={config.groupBy || 'channel'}
                      onChange={e => upd('groupBy', e.target.value)}>
                      {(groupByOptions || GROUP_BY).map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                  </div>
                </>
              )}

              {type === 'table' && (
                <>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>제목</p>
                    <input className={S.inp} value={config.title || ''}
                      onChange={e => upd('title', e.target.value)} placeholder="위젯 제목" />
                  </div>
                  <div>
                    <p className={`${S.lab} mb-2`}>표시 지표 (복수 선택)</p>
                    <div className="flex flex-col gap-3">
                      {['metric', 'rate'].map(group => (
                        <div key={group}>
                          <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${dark ? 'text-slate-400' : 'text-slate-700'}`}>
                            {group === 'metric' ? '지표' : '단가'}
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {(metricsProp || METRICS).filter(m => m.group === group).map(m => {
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
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>그룹 기준</p>
                    <select className={S.sel} value={config.groupBy || 'channel'}
                      onChange={e => upd('groupBy', e.target.value)}>
                      {(groupByOptions || GROUP_BY).map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
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
                onGroupByChange={['bar', 'donut', 'table'].includes(type)
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
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
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
              <Plus size={12} /> 카드 추가
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
function DashboardGrid({ tabId, dashboard, setDashboard, data, dark, editMode, showAdd, onOpenAdd, onCloseAdd, subType = 'report', tableMetrics, tableGroupBy }) {
  const [editSlot, setEditSlot] = useState(null)   // 편집 모달 대상 slotId
  const [activeId, setActiveId] = useState(null)   // 드래그 중인 slotId
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
  const norm = useMemo(() => normalizeDashboard(dashboard), [dashboard])
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

  const handleWidthChange = (id, widthPct) => {
    setDashboard({ ...norm, slots: slots.map(s => s.id === id ? { ...s, widthPct } : s) })
  }

  const handleHeightChange = (id, heightPx) => {
    setDashboard({ ...norm, slots: slots.map(s => s.id === id ? { ...s, heightPx: heightPx ?? undefined } : s) })
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
          ${dark ? 'border-[#252836] text-slate-500' : 'border-slate-200 text-slate-600'}`}>
          <span className="text-5xl">📊</span>
          <div className="text-center">
            <p className={`text-sm font-semibold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
              아직 카드가 없습니다
            </p>
            <p className="text-xs mt-1.5">카드를 추가해 원하는 지표를 시각화해보세요</p>
          </div>
          <button onClick={onOpenAdd}
            className="flex items-center gap-2 text-xs px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold">
            <Plus size={13} /> 첫 번째 카드 추가
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
            <div ref={gridRef} className="flex flex-wrap gap-3 items-start">
              {slots.map(slot => (
                <SortableCard
                  key={slot.id}
                  slot={slot}
                  editMode={editMode}
                  onEdit={setEditSlot}
                  onDelete={handleDeleteSlot}
                  onWidthChange={handleWidthChange}
                  onHeightChange={handleHeightChange}
                  data={data}
                  tableMetrics={tableMetrics}
                  dark={dark}
                  gridRef={gridRef}
                />
              ))}
              {/* 편집모드: 인라인 추가 버튼 */}
              {editMode && (
                <div onClick={onOpenAdd}
                  style={{ width: pctToWidth(16.67), minHeight: 100 }}
                  className={`rounded-xl border-2 border-dashed cursor-pointer shrink-0
                    flex flex-col items-center justify-center gap-1.5 transition-colors select-none
                    ${dark
                      ? 'border-[#252836] text-slate-400 hover:border-indigo-500/50 hover:text-indigo-400 hover:bg-indigo-500/5'
                      : 'border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50'}`}>
                  <Plus size={16} />
                  <span className="text-[10px] font-semibold">카드 추가</span>
                </div>
              )}
            </div>
          </SortableContext>

          {/* 드래그 중 고스트 카드 */}
          <DragOverlay>
            {activeSlot && (
              <div className="rounded-xl border-2 border-indigo-500 opacity-90 shadow-2xl"
                style={{
                  width: pctToWidth(activeSlot.widthPct ?? 33.33),
                  ...(activeSlot.type !== 'kpi' && { minHeight: 210 }),
                }}>
                {renderWidget(activeSlot.type, applyWidgetFilters(data, activeSlot.config.filters), activeSlot.config, dark, tableMetrics)}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* 카드 추가 모달 */}
      {showAdd && (
        <AddWidgetModal dark={dark} data={data} onAdd={handleAddSlot} onClose={onCloseAdd} subType={subType} metrics={tableMetrics} groupByOptions={tableGroupBy} />
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
          subType={subType}
          metrics={tableMetrics}
          groupByOptions={tableGroupBy}
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
export default function CustomDashboard({ dark, filterByDate, tabsConfig, subDataSource, subType = 'report' }) {
  const { config } = useConfig()
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
  const [editMode, setEditMode] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const tabBarAddRef = useRef(null)

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
  const fieldMap = subDataSource?.fieldMap || {}

  const { data: rawData, loading, error } = useTableData(tableName)
  const data = useMemo(() => {
    const filtered = filterByDate ? filterByDate(rawData) : rawData
    const mapped = applyFieldMap(filtered, fieldMap)
    return applyComputedColumns(mapped, tableName, config.columnConfig)
  }, [rawData, filterByDate, fieldMap, tableName, config.columnConfig])

  const tableMetrics = useMemo(
    () => buildTableMetrics(tableName, config.columnConfig),
    [tableName, config.columnConfig]
  )
  const tableGroupBy = useMemo(
    () => buildTableGroupBy(tableName, config.columnConfig),
    [tableName, config.columnConfig]
  )

  /* 탭 추가 — 자동 이동 없음 */
  const handleAddTab = (label, templateId = null) => {
    tabsConfig?.addTab(label, templateId)
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

  if (loading) return <Spinner dark={dark} />

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
        addRef={tabBarAddRef}
        subType={subType}
        rightSlot={activeTab ? (
          subType === 'kanban' ? (
            /* 칸반: 항상 인터랙티브, 저장 버튼만 */
            <button onClick={handleSave}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors
                ${saved ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
              <Check size={12} /> {saved ? '저장됨' : '저장'}
            </button>
          ) : subType !== 'report' ? (
            /* 시뮬레이션/퍼널/코호트: 편집 + 저장 */
            editMode ? (
              <>
                <button onClick={() => { setEditMode(false) }}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors
                    ${dark ? 'border-[#252836] text-slate-400 hover:text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                  닫기
                </button>
                <button onClick={() => { handleSave(); setEditMode(false) }}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors
                    ${saved ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                  <Check size={12} /> {saved ? '저장됨' : '저장'}
                </button>
              </>
            ) : (
              <button onClick={() => setEditMode(true)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors
                  ${dark ? 'border-[#252836] text-slate-400 hover:text-white hover:bg-[#1A1D27]' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                <Settings2 size={12} /> 설정
              </button>
            )
          ) : editMode ? (
            <>
              <button onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg
                  bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                <Plus size={12} /> 카드 추가
              </button>
              <DataSourceSelector tableName={currentTable} onChange={handleTableChange} dark={dark} />
              <button onClick={() => { setEditMode(false); setShowAdd(false) }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors
                  ${dark ? 'border-[#252836] text-slate-400 hover:text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                취소
              </button>
              <button onClick={() => { handleSave(); setEditMode(false) }}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors
                  ${saved ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                <Check size={12} /> {saved ? '저장됨' : '저장'}
              </button>
            </>
          ) : (
            <button onClick={() => setEditMode(true)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors
                ${dark ? 'border-[#252836] text-slate-400 hover:text-white hover:bg-[#1A1D27]' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
              <Settings2 size={12} /> 대시보드 편집
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
          {subType === 'kanban' ? (
            <KanbanBoard
              key={activeTab.id}
              dashboard={dashboard}
              setDashboard={setDashboard}
              dark={dark}
            />
          ) : subType === 'funnel' ? (
            <FunnelPage
              key={activeTab.id}
              dashboard={dashboard}
              setDashboard={setDashboard}
              data={data}
              dark={dark}
              editMode={editMode}
            />
          ) : subType === 'simulation' ? (
            <SimulationPage
              key={activeTab.id}
              dashboard={dashboard}
              setDashboard={setDashboard}
              data={data}
              dark={dark}
              editMode={editMode}
            />
          ) : subType === 'cohort' ? (
            <CohortPage
              key={activeTab.id}
              dashboard={dashboard}
              setDashboard={setDashboard}
              data={data}
              dark={dark}
              editMode={editMode}
            />
          ) : (
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
              subType={subType}
              tableMetrics={tableMetrics}
              tableGroupBy={tableGroupBy}
            />
          )}
        </div>
      ) : (
        /* 빈 상태 — 클릭하면 탭 추가 폼 오픈 */
        <button
          onClick={() => tabBarAddRef.current?.()}
          className={`flex flex-col items-center justify-center flex-1 gap-5 w-full
            transition-colors group
            ${dark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-700 hover:text-slate-700'}`}
        >
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-colors
            ${dark
              ? 'bg-[#1A1D27] group-hover:bg-indigo-600/20'
              : 'bg-slate-50 group-hover:bg-indigo-50'}`}>
            <Plus size={32} className="text-indigo-400 group-hover:text-indigo-500" />
          </div>
          <div className="text-center">
            <p className={`text-sm font-semibold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
              탭이 없습니다
            </p>
            <p className="text-xs mt-1.5 text-indigo-400 group-hover:text-indigo-300 font-medium">
              + 여기를 클릭해서 첫 번째 탭을 만들어보세요
            </p>
          </div>
        </button>
      )}
    </div>
  )
}
