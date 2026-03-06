import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Settings2, Check, X, Plus, Database, GripVertical } from 'lucide-react'
import {
  TEMPLATES, WIDGET_TYPES, METRICS, GROUP_BY,
  makeDashboard, DEFAULT_WIDGET_CONFIG,
  SUB_TYPES,
  useConfig,
} from '../store/useConfig'
import { applyComputedColumns, buildTableMetrics, buildTableGroupBy, getTableDisplayName } from '../store/columnUtils'
import { TABLES as DB_TABLES } from './datastudio/Tables'
import { useTableData } from '../hooks/useTableData'
import Spinner from '../components/UI/Spinner'
import ErrorBoundary from '../components/UI/ErrorBoundary'
import KPIWidget from '../components/widgets/KPIWidget'
import TimeSeriesWidget from '../components/widgets/TimeSeriesWidget'
import BarWidget from '../components/widgets/BarWidget'
import DonutWidget from '../components/widgets/DonutWidget'
import TableWidget from '../components/widgets/TableWidget'
import SimBudgetWidget from '../components/widgets/SimBudgetWidget'
import SimGoalWidget from '../components/widgets/SimGoalWidget'
import SimScenarioWidget from '../components/widgets/SimScenarioWidget'
import FunnelWidget from '../components/widgets/FunnelWidget'
import FunnelBreakdownWidget from '../components/widgets/FunnelBreakdownWidget'
import CohortHeatmapWidget from '../components/widgets/CohortHeatmapWidget'
import CohortTrendWidget from '../components/widgets/CohortTrendWidget'
import KanbanWidget from '../components/widgets/KanbanWidget'
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
  { id: 'product_revenue_raw', label: '상품 매출' },
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
  sim_budget: SimBudgetWidget, sim_goal: SimGoalWidget, sim_scenario: SimScenarioWidget,
  funnel_chart: FunnelWidget, funnel_breakdown: FunnelBreakdownWidget,
  cohort_heatmap: CohortHeatmapWidget, cohort_trend: CohortTrendWidget,
  kanban_board: KanbanWidget,
}
/* 상태형 위젯 (onConfigUpdate 필요) */
const STATEFUL_WIDGETS = new Set(['sim_budget', 'sim_goal', 'sim_scenario', 'kanban_board'])

const renderWidget = (type, data, cfg, dark, metrics, onConfigUpdate) => {
  const C = WIDGET_MAP[type]
  if (!C) return null
  return (
    <ErrorBoundary dark={dark} label={type}>
      <C data={data} config={cfg} dark={dark} metrics={metrics}
        {...(STATEFUL_WIDGETS.has(type) && onConfigUpdate ? { onConfigUpdate } : {})} />
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
function WidgetEditor({ slotId, widget, dark, data = [], onSave, onClose, metrics: metricsProp, groupByOptions, columnConfig }) {
  const [step, setStep] = useState(1)
  const selTable = widget.config?._table || 'marketing_data'
  const [type, setType] = useState(widget.type)
  const [config, setConfig] = useState({ ...widget.config })
  const [filters, setFilters] = useState(widget.config.filters || {})

  /* 테이블 기준 동적 메트릭/그룹바이 */
  const dynMetrics = useMemo(
    () => buildTableMetrics(selTable, columnConfig),
    [selTable, columnConfig]
  )
  const dynGroupBy = useMemo(
    () => buildTableGroupBy(selTable, columnConfig),
    [selTable, columnConfig]
  )

  const upd = (k, v) => setConfig(c => ({ ...c, [k]: v }))
  const toggleMetric = mid => {
    const cur = config.metrics || []
    setConfig(c => ({ ...c, metrics: cur.includes(mid) ? cur.filter(x => x !== mid) : [...cur, mid] }))
  }
  const changeType = t => { setType(t); setConfig(prev => ({ ...DEFAULT_WIDGET_CONFIG[t], _table: prev._table, filters: prev.filters })) }
  const handleSave = () => onSave(slotId, { type, config: { ...config, filters, _table: selTable } })

  /* 현재 위젯의 카테고리 자동 감지 → 같은 카테고리 위젯만 타입 변경 허용 */
  const detectedCategory = Object.entries(SUB_TYPES).find(
    ([, st]) => st.widgetTypes?.includes(type)
  )?.[0] || 'report'
  const allowedTypes = SUB_TYPES[detectedCategory]?.widgetTypes || SUB_TYPES.report.widgetTypes

  const S = {
    sel: `px-2.5 py-1.5 rounded-lg border text-xs outline-none w-full
      ${dark ? 'bg-[#0F1117] border-[#252836] text-white' : 'bg-white border-slate-200 text-slate-700'}`,
    inp: `px-2.5 py-1.5 rounded-lg border text-xs outline-none w-full
      ${dark ? 'bg-[#0F1117] border-[#252836] text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-700'}`,
    lab: `text-[10px] font-bold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-slate-700'}`,
    btn: (on, computed) => `text-xs px-2 py-1.5 rounded-lg border text-left transition-colors
      ${computed ? 'border-l-2 !border-l-violet-500' : ''}
      ${on ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
        : dark ? 'border-[#252836] text-slate-400 hover:border-indigo-500/40' : 'border-slate-200 text-slate-700 hover:border-indigo-300'}`,
  }

  const STEPS = ['위젯 타입', '설정', '데이터 필터']

  /* 메트릭 그룹 분류 */
  const metricGroups = useMemo(() => {
    const groups = {}
    dynMetrics.forEach(m => {
      const g = m._computed ? 'computed' : (m.group || 'metric')
      if (!groups[g]) groups[g] = []
      groups[g].push(m)
    })
    return groups
  }, [dynMetrics])

  const GROUP_LABELS = { metric: '지표', computed: '🧮 계산 컬럼', rate: '단가' }

  /* 메트릭 버튼 렌더 (단일 선택) */
  const renderMetricSingle = (selectedId, onSelect) => (
    <div className="flex flex-col gap-3">
      {Object.entries(metricGroups).map(([group, items]) => (
        <div key={group}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5
            ${group === 'computed' ? 'text-violet-400' : dark ? 'text-slate-400' : 'text-slate-700'}`}>
            {GROUP_LABELS[group] || group}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {items.map(m => (
              <button key={m.id} onClick={() => onSelect(m.id)} className={S.btn(selectedId === m.id, m._computed)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  /* 메트릭 버튼 렌더 (복수 선택) */
  const renderMetricMulti = (selectedIds, onToggle) => (
    <div className="flex flex-col gap-3">
      {Object.entries(metricGroups).map(([group, items]) => (
        <div key={group}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5
            ${group === 'computed' ? 'text-violet-400' : dark ? 'text-slate-400' : 'text-slate-700'}`}>
            {GROUP_LABELS[group] || group}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {items.map(m => {
              const on = selectedIds.includes(m.id)
              return (
                <button key={m.id} onClick={() => onToggle(m.id)} className={S.btn(on, m._computed)}>
                  {on ? '✓ ' : ''}{m.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className={`rounded-t-2xl sm:rounded-2xl border w-full sm:max-w-xl flex flex-col max-h-[90vh]
        ${dark ? 'bg-[#13151F] border-[#252836]' : 'bg-white border-slate-200 shadow-2xl'}`}>

        {/* 헤더 */}
        <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0
          ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
          <div>
            <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>위젯 편집</p>
            <div className="flex items-center gap-1 mt-2">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors
                    ${step === i + 1 ? 'bg-indigo-500 text-white'
                      : step > i + 1 ? 'bg-emerald-500 text-white'
                        : dark ? 'bg-[#252836] text-slate-500' : 'bg-slate-100 text-slate-600'}`}>
                    {step > i + 1 ? '✓' : i + 1}
                  </div>
                  <span className={`text-[10px] font-medium hidden sm:inline
                    ${step === i + 1 ? (dark ? 'text-slate-200' : 'text-slate-700') : dark ? 'text-slate-600' : 'text-slate-600'}`}>
                    {s}
                  </span>
                  {i < 2 && <span className={`text-[10px] mx-0.5 ${dark ? 'text-slate-600' : 'text-slate-600'}`}>›</span>}
                </div>
              ))}
            </div>
          </div>
          {/* 데이터소스 칩 */}
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2.5 py-1 rounded-md font-semibold ${dark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              📊 {selTable}
            </span>
            <button onClick={onClose}
              className={`p-2 rounded-xl ${dark ? 'text-slate-400 hover:bg-[#252836] hover:text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 바디 */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 min-h-0">

          {/* Step 1: 위젯 타입 선택 (미리보기 포함) */}
          {step === 1 && (
            <div className="flex flex-col gap-2">
              {allowedTypes.filter(wt => WTYPE_META[wt]).map(wt => {
                const meta = WTYPE_META[wt]
                const on = type === wt
                const Preview = MINI_PREVIEW[wt]
                return (
                  <button key={wt} onClick={() => changeType(wt)}
                    className={`flex items-center gap-4 p-3.5 rounded-xl border text-left transition-all
                      ${on ? 'border-indigo-500 bg-indigo-500/10'
                        : dark ? 'border-[#252836] hover:border-indigo-500/40' : 'border-slate-200 hover:border-indigo-300'}`}>
                    <div className={`w-16 h-12 rounded-lg flex items-center justify-center shrink-0 p-2
                      ${dark ? 'bg-[#0F1117]' : 'bg-slate-100'}`}>
                      {Preview ? <Preview dark={dark} /> : <span className="text-xl">{meta.icon}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{meta.icon} {meta.label}</p>
                      <p className={`text-[10px] mt-0.5 leading-relaxed ${dark ? 'text-slate-500' : 'text-slate-700'}`}>{meta.desc}</p>
                      <div className="flex gap-1.5 mt-1.5">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${dark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                          {meta.metricTag}
                        </span>
                        {meta.needsGroup && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${dark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
                            그룹바이 필요
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] transition-colors shrink-0
                      ${on ? 'border-indigo-500 bg-indigo-500 text-white' : dark ? 'border-[#252836]' : 'border-slate-200'}`}>
                      {on && '✓'}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

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
                    {renderMetricSingle(config.metric, mid => upd('metric', mid))}
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
                  {renderMetricMulti(config.metrics || [], toggleMetric)}
                </div>
              )}

              {(type === 'bar' || type === 'donut') && (
                <>
                  <div>
                    <p className={`${S.lab} mb-2`}>지표</p>
                    {renderMetricSingle(config.metric, mid => upd('metric', mid))}
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>그룹 기준</p>
                    <select className={S.sel} value={config.groupBy || 'channel'}
                      onChange={e => upd('groupBy', e.target.value)}>
                      {dynGroupBy.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                  </div>
                </>
              )}

              {type === 'table' && (
                <>
                  <div>
                    <p className={`${S.lab} mb-2`}>표시 지표 (복수 선택)</p>
                    {renderMetricMulti(config.metrics || [], mid => {
                      const cur = config.metrics || []
                      upd('metrics', cur.includes(mid) ? cur.filter(x => x !== mid) : [...cur, mid])
                    })}
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>그룹 기준</p>
                    <select className={S.sel} value={config.groupBy || 'channel'}
                      onChange={e => upd('groupBy', e.target.value)}>
                      {dynGroupBy.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* ── 시뮬레이션: 예산 배분 ── */}
              {type === 'sim_budget' && (
                <>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>총 예산</p>
                    <input type="number" className={S.inp} value={config.totalBudget || 1000000}
                      onChange={e => upd('totalBudget', Number(e.target.value))} />
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>목표 메트릭</p>
                    <select className={S.sel} value={config.targetMetric || 'revenue'}
                      onChange={e => upd('targetMetric', e.target.value)}>
                      {dynMetrics.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* ── 시뮬레이션: 목표 역산 ── */}
              {type === 'sim_goal' && (
                <>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>목표 메트릭</p>
                    <select className={S.sel} value={config.targetMetric || 'revenue'}
                      onChange={e => upd('targetMetric', e.target.value)}>
                      {dynMetrics.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>목표값</p>
                    <input type="number" className={S.inp} value={config.targetValue || 10000000}
                      onChange={e => upd('targetValue', Number(e.target.value))} />
                  </div>
                </>
              )}

              {/* ── 시뮬레이션: 시나리오 비교 ── */}
              {type === 'sim_scenario' && (
                <>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>총 예산</p>
                    <input type="number" className={S.inp} value={config.totalBudget || 1000000}
                      onChange={e => upd('totalBudget', Number(e.target.value))} />
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>비교 메트릭</p>
                    <select className={S.sel} value={config.targetMetric || 'revenue'}
                      onChange={e => upd('targetMetric', e.target.value)}>
                      {dynMetrics.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* ── 퍼널: 전환 퍼널 / 브레이크다운 ── */}
              {(type === 'funnel_chart' || type === 'funnel_breakdown') && (
                <>
                  <div>
                    <p className={`${S.lab} mb-2`}>퍼널 단계</p>
                    {(config.stages || []).map((stage, si) => (
                      <div key={stage.id} className="flex gap-1.5 mb-1.5">
                        <input className={`${S.inp} flex-1`} value={stage.label}
                          onChange={e => {
                            const next = [...config.stages]; next[si] = {...stage, label: e.target.value}; upd('stages', next)
                          }} placeholder={`단계 ${si+1}`} />
                        <select className={`${S.sel} w-32`} value={stage.metric}
                          onChange={e => {
                            const next = [...config.stages]; next[si] = {...stage, metric: e.target.value}; upd('stages', next)
                          }}>
                          {dynMetrics.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                        </select>
                        {(config.stages || []).length > 2 && (
                          <button onClick={() => upd('stages', config.stages.filter((_,j) => j !== si))}
                            className="text-red-400 hover:text-red-300 text-xs px-1">×</button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => upd('stages', [...(config.stages||[]), {id:`s${Date.now()}`, label:'', metric: dynMetrics[0]?.id || 'impr'}])}
                      className={`text-[10px] px-2 py-1 rounded-lg border border-dashed mt-1
                        ${dark ? 'border-[#252836] text-slate-400 hover:text-indigo-400' : 'border-slate-200 text-slate-700'}`}>
                      + 단계 추가
                    </button>
                  </div>
                  {type === 'funnel_breakdown' && (
                    <div>
                      <p className={`${S.lab} mb-1.5`}>그룹 기준</p>
                      <select className={S.sel} value={config.groupBy || 'channel'}
                        onChange={e => upd('groupBy', e.target.value)}>
                        {dynGroupBy.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}

              {/* ── 코호트: 히트맵 / 트렌드 ── */}
              {(type === 'cohort_heatmap' || type === 'cohort_trend') && (
                <>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>기간 단위</p>
                    <select className={S.sel} value={config.granularity || 'week'}
                      onChange={e => upd('granularity', e.target.value)}>
                      <option value="week">주간</option>
                      <option value="month">월간</option>
                    </select>
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>기간 수</p>
                    <input type="number" className={S.inp} value={config.periods || 8} min={2} max={24}
                      onChange={e => upd('periods', Number(e.target.value))} />
                  </div>
                </>
              )}

              {/* ── 칸반 보드 ── */}
              {type === 'kanban_board' && (
                <div>
                  <p className={`${S.lab} mb-2`}>칼럼 설정</p>
                  {(config.columns || []).map((col, ci) => (
                    <div key={col.id} className="flex gap-1.5 mb-1.5">
                      <input className={`${S.inp} flex-1`} value={col.title}
                        onChange={e => {
                          const next = [...config.columns]; next[ci] = {...col, title: e.target.value}; upd('columns', next)
                        }} placeholder={`칼럼 ${ci+1}`} />
                      {(config.columns || []).length > 1 && (
                        <button onClick={() => upd('columns', config.columns.filter((_,j) => j !== ci))}
                          className="text-red-400 hover:text-red-300 text-xs px-1">×</button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => upd('columns', [...(config.columns||[]), {id:`c${Date.now()}`, title:'', cards:[]}])}
                    className={`text-[10px] px-2 py-1 rounded-lg border border-dashed mt-1
                      ${dark ? 'border-[#252836] text-slate-400 hover:text-indigo-400' : 'border-slate-200 text-slate-700'}`}>
                    + 칼럼 추가
                  </button>
                </div>
              )}
            </>
          )}

          {/* Step 3: 데이터 필터 */}
          {step === 3 && (
            ['kpi','timeseries','bar','donut','table','funnel_chart','funnel_breakdown'].includes(type) ? (
              <FilterSection
                filters={filters}
                groupBy={config.groupBy}
                data={data}
                dark={dark}
                onChange={setFilters}
                initialOpen={true}
                onGroupByChange={['bar', 'donut', 'table', 'funnel_breakdown'].includes(type)
                  ? (dim) => upd('groupBy', dim ?? 'channel')
                  : undefined}
              />
            ) : (
              <div className={`text-center py-10 ${dark ? 'text-slate-500' : 'text-slate-600'}`}>
                <p className="text-xs">이 위젯 타입은 데이터 필터가 필요하지 않습니다</p>
                <p className={`text-[10px] mt-1 ${dark ? 'text-slate-600' : 'text-slate-600'}`}>바로 저장할 수 있습니다</p>
              </div>
            )
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

function SortableCard({ slot, editMode, onEdit, onDelete, onWidthChange, onHeightChange, onConfigUpdate, data, dark, gridRef, tableMetrics }) {
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
        {renderWidget(slot.type, applyWidgetFilters(data, slot.config.filters), slot.config, dark, tableMetrics,
          onConfigUpdate ? (newCfg) => onConfigUpdate(slot.id, newCfg) : undefined)}
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
function L3TabBar({ tabs, activeId, onSelect, onAdd, onRemove, onRename, onReorder, dark, rightSlot, addRef }) {
  const [addingTab, setAddingTab] = useState(false)
  const [newLabel, setNewLabel] = useState('')

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
  /* 구 비-report 대시보드 마이그레이션 → slots 배열로 변환 */
  if (d.type && d.type !== 'report' && !Array.isArray(d.slots)) {
    if (d.type === 'funnel') return { slots: [{ id: 'w_mig_1', widthPct: 100, type: 'funnel_chart', config: { ...(DEFAULT_WIDGET_CONFIG.funnel_chart || {}), stages: d.stages || DEFAULT_WIDGET_CONFIG.funnel_chart?.stages } }] }
    if (d.type === 'kanban') return { slots: [{ id: 'w_mig_1', widthPct: 100, type: 'kanban_board', config: { ...(DEFAULT_WIDGET_CONFIG.kanban_board || {}), columns: d.columns || DEFAULT_WIDGET_CONFIG.kanban_board?.columns } }] }
    if (d.type === 'simulation') return { slots: [{ id: 'w_mig_1', widthPct: 100, type: 'sim_budget', config: { ...DEFAULT_WIDGET_CONFIG.sim_budget } }] }
    if (d.type === 'cohort') return { slots: [{ id: 'w_mig_1', widthPct: 100, type: 'cohort_heatmap', config: { ...DEFAULT_WIDGET_CONFIG.cohort_heatmap } }] }
    return { slots: [] }
  }
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
/* ── 위젯 타입 메타 (Step 3 미리보기용) ── */
const WTYPE_META = {
  kpi:        { icon: '💳', label: 'KPI 카드',      desc: '핵심 지표 하나를 크게 표시하고 전일/전주 대비 변화율을 함께 보여줍니다', metricTag: '메트릭 1개', needsGroup: false },
  timeseries: { icon: '📈', label: '시계열 차트',   desc: '날짜별 추이를 라인 차트로 시각화, 여러 지표를 동시에 비교할 수 있습니다', metricTag: '메트릭 1~5개', needsGroup: false },
  bar:        { icon: '📊', label: '바 차트',       desc: '그룹별 지표를 막대로 비교, 채널·캠페인별 성과 비교에 적합합니다', metricTag: '메트릭 1~3개', needsGroup: true },
  donut:      { icon: '🍩', label: '도넛 차트',     desc: '그룹별 비중을 한눈에 파악, 채널 점유율·매출 비중 분석에 최적', metricTag: '메트릭 1개', needsGroup: true },
  table:      { icon: '📋', label: '데이터 테이블', desc: '상세 데이터를 표로 확인, 정렬·필터링으로 세부 분석이 가능합니다', metricTag: '메트릭 1~10개', needsGroup: true },
  /* 시뮬레이션 */
  sim_budget:   { icon: '💰', label: '예산 배분',     desc: '채널별 예산 슬라이더로 배분하고 예상 성과를 실시간으로 확인합니다', metricTag: '예산 입력', needsGroup: false },
  sim_goal:     { icon: '🎯', label: '목표 역산',     desc: '목표 매출/전환 수치를 입력하면 필요한 채널별 예산을 역산합니다', metricTag: '목표값 입력', needsGroup: false },
  sim_scenario: { icon: '⚖️', label: '시나리오 비교', desc: '여러 예산 시나리오를 만들어 바 차트로 비교 분석합니다', metricTag: '시나리오 관리', needsGroup: false },
  /* 퍼널 */
  funnel_chart:     { icon: '🔻', label: '전환 퍼널',       desc: '노출→클릭→전환 등 단계별 전환율을 퍼널 차트로 시각화합니다', metricTag: '단계 설정', needsGroup: false },
  funnel_breakdown: { icon: '📊', label: '퍼널 브레이크다운', desc: '채널별로 각 퍼널 단계의 수치와 전환율을 테이블로 비교합니다', metricTag: '단계+그룹', needsGroup: true },
  /* 코호트 */
  cohort_heatmap: { icon: '🟩', label: '리텐션 히트맵', desc: '코호트별 리텐션을 히트맵으로 표시, 색상으로 이탈 패턴을 파악합니다', metricTag: '기간 설정', needsGroup: false },
  cohort_trend:   { icon: '📉', label: '코호트 트렌드', desc: '평균 리텐션 추이를 면적 차트로 시각화, 개선 효과를 확인합니다', metricTag: '기간 설정', needsGroup: false },
  /* 칸반 */
  kanban_board: { icon: '📋', label: '칸반 보드', desc: '드래그 앤 드롭으로 작업을 관리하는 칸반 보드입니다', metricTag: '칼럼 관리', needsGroup: false },
}

/* ── Step 3 미니 프리뷰 SVG들 ── */
function MiniKpi({ dark }) {
  return (
    <div className="text-center w-full">
      <div className={`text-sm font-extrabold ${dark ? 'text-white' : 'text-slate-800'}`}>₩ 1.2M</div>
      <div className="text-[8px] text-emerald-400 mt-0.5">▲ 3.2%</div>
    </div>
  )
}
function MiniTimeseries() {
  return (
    <svg viewBox="0 0 64 40" fill="none" className="w-full h-10">
      <polyline points="2,32 12,28 22,18 32,22 42,10 52,14 62,6" stroke="#6366F1" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="2,34 12,30 22,26 32,28 42,20 52,24 62,16" stroke="#818CF8" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity=".4"/>
    </svg>
  )
}
function MiniBar() {
  return (
    <div className="flex items-end gap-[3px] h-10 w-full">
      {[65,100,45,80,55].map((h, i) => (
        <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: i % 2 ? '#818CF8' : '#6366F1' }} />
      ))}
    </div>
  )
}
function MiniDonut() {
  return (
    <svg viewBox="0 0 44 44" className="w-11 h-11">
      <circle cx="22" cy="22" r="16" fill="none" stroke="#252836" strokeWidth="6"/>
      <circle cx="22" cy="22" r="16" fill="none" stroke="#6366F1" strokeWidth="6" strokeDasharray="40 100" strokeDashoffset="0" transform="rotate(-90 22 22)"/>
      <circle cx="22" cy="22" r="16" fill="none" stroke="#818CF8" strokeWidth="6" strokeDasharray="28 100" strokeDashoffset="-40" transform="rotate(-90 22 22)"/>
      <circle cx="22" cy="22" r="16" fill="none" stroke="#A5B4FC" strokeWidth="6" strokeDasharray="18 100" strokeDashoffset="-68" transform="rotate(-90 22 22)"/>
    </svg>
  )
}
function MiniTable({ dark }) {
  return (
    <div className="w-full flex flex-col gap-[2px]">
      {[true, false, false, false].map((hdr, i) => (
        <div key={i} className="flex gap-[2px]">
          {[1,2,3].map(j => <div key={j} className={`flex-1 rounded-[1px] ${hdr ? 'h-[7px] bg-indigo-500/50' : 'h-[6px]'} ${!hdr ? (dark ? 'bg-[#252836]' : 'bg-slate-200') : ''}`} />)}
        </div>
      ))}
    </div>
  )
}

function MiniSimBudget() {
  return (
    <div className="w-full flex flex-col gap-[3px]">
      {[80,55,35].map((w,i) => (
        <div key={i} className="flex items-center gap-1">
          <div className="flex-1 h-[5px] rounded-full bg-[#252836]">
            <div className="h-full rounded-full" style={{width:`${w}%`, background: ['#6366F1','#818CF8','#A5B4FC'][i]}} />
          </div>
        </div>
      ))}
    </div>
  )
}
function MiniSimGoal() {
  return (
    <svg viewBox="0 0 44 44" className="w-10 h-10">
      <circle cx="22" cy="22" r="18" fill="none" stroke="#252836" strokeWidth="3"/>
      <circle cx="22" cy="22" r="12" fill="none" stroke="#6366F1" strokeWidth="2.5"/>
      <circle cx="22" cy="22" r="6" fill="#818CF8"/>
    </svg>
  )
}
function MiniSimScenario() {
  return (
    <div className="flex items-end gap-[2px] h-10 w-full">
      {[[60,80],[45,70],[75,50]].map(([a,b], i) => (
        <div key={i} className="flex-1 flex gap-[1px] items-end h-full">
          <div className="flex-1 rounded-t-sm" style={{height:`${a}%`, background:'#6366F1'}} />
          <div className="flex-1 rounded-t-sm" style={{height:`${b}%`, background:'#A5B4FC'}} />
        </div>
      ))}
    </div>
  )
}
function MiniFunnel({ dark }) {
  return (
    <svg viewBox="0 0 60 40" className="w-full h-10">
      <polygon points="2,2 58,2 48,14 12,14" fill="#6366F1" opacity=".9"/>
      <polygon points="12,16 48,16 42,28 18,28" fill="#818CF8" opacity=".8"/>
      <polygon points="18,30 42,30 38,38 22,38" fill="#A5B4FC" opacity=".7"/>
    </svg>
  )
}
function MiniFunnelBreakdown({ dark }) {
  return (
    <div className="w-full flex flex-col gap-[2px]">
      {[true, false, false].map((hdr, i) => (
        <div key={i} className="flex gap-[2px]">
          {[1,2,3,4].map(j => <div key={j} className={`flex-1 rounded-[1px] ${hdr ? 'h-[7px] bg-emerald-500/50' : 'h-[6px]'} ${!hdr ? (dark ? 'bg-[#252836]' : 'bg-slate-200') : ''}`} />)}
        </div>
      ))}
    </div>
  )
}
function MiniCohortHeatmap() {
  const colors = ['#22C55E','#16A34A','#EAB308','#F97316','#EF4444']
  return (
    <div className="grid grid-cols-4 gap-[2px] w-full">
      {Array.from({length:12}).map((_,i) => (
        <div key={i} className="h-[7px] rounded-[1px]" style={{background: colors[Math.min(4, Math.floor(i/2.5))], opacity: 0.5 + (i%3)*0.2}} />
      ))}
    </div>
  )
}
function MiniCohortTrend() {
  return (
    <svg viewBox="0 0 64 40" fill="none" className="w-full h-10">
      <path d="M2,36 L12,28 L22,24 L32,20 L42,16 L52,14 L62,12 L62,38 L2,38 Z" fill="#6366F1" opacity=".25"/>
      <polyline points="2,36 12,28 22,24 32,20 42,16 52,14 62,12" stroke="#6366F1" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  )
}
function MiniKanban({ dark }) {
  return (
    <div className="flex gap-[3px] w-full h-10">
      {[3,2,1].map((n,i) => (
        <div key={i} className={`flex-1 rounded-sm flex flex-col gap-[2px] p-[2px] ${dark ? 'bg-[#252836]' : 'bg-slate-200'}`}>
          {Array.from({length:n}).map((_,j) => (
            <div key={j} className="w-full h-[6px] rounded-[1px] bg-indigo-500/40" />
          ))}
        </div>
      ))}
    </div>
  )
}

const MINI_PREVIEW = {
  kpi: MiniKpi, timeseries: MiniTimeseries, bar: MiniBar, donut: MiniDonut, table: MiniTable,
  sim_budget: MiniSimBudget, sim_goal: MiniSimGoal, sim_scenario: MiniSimScenario,
  funnel_chart: MiniFunnel, funnel_breakdown: MiniFunnelBreakdown,
  cohort_heatmap: MiniCohortHeatmap, cohort_trend: MiniCohortTrend,
  kanban_board: MiniKanban,
}

/* ── 카테고리 메타 ── */
const CATEGORY_META = {
  report:     { icon: '📈', label: '리포트',      desc: 'KPI, 차트, 테이블 등 데이터 시각화 카드' },
  simulation: { icon: '🧪', label: '시뮬레이션',  desc: '예산 배분, ROAS 목표 시뮬레이터 카드' },
  funnel:     { icon: '🔻', label: '퍼널',        desc: '노출→클릭→전환 단계별 전환율 분석' },
  cohort:     { icon: '🟩', label: '코호트',      desc: '사용자 리텐션·이탈 패턴 분석' },
  kanban:     { icon: '📋', label: '칸반',        desc: '작업 관리 칸반 보드' },
}

function AddWidgetModal({ dark, data = [], onAdd, onClose, metrics: metricsProp, groupByOptions, columnConfig }) {
  const [step, setStep] = useState(1)   // 1:카테고리 2:데이터소스(조건부) 3:위젯타입 4:설정
  const [selCategory, setSelCategory] = useState('report')
  const [selTable, setSelTable] = useState('marketing_data')
  const [type, setType] = useState('kpi')
  const [wConfig, setWConfig] = useState({ ...DEFAULT_WIDGET_CONFIG.kpi })
  const [filters, setFilters] = useState({})

  /* 데이터소스가 필요 없는 카테고리 */
  const NEEDS_DATA = { report: true, funnel: true, cohort: true, simulation: false, kanban: false }

  const upd = (k, v) => setWConfig(c => ({ ...c, [k]: v }))

  /* 선택한 테이블 기준 메트릭/그룹바이 동적 생성 */
  const dynMetrics = useMemo(
    () => buildTableMetrics(selTable, columnConfig),
    [selTable, columnConfig]
  )
  const dynGroupBy = useMemo(
    () => buildTableGroupBy(selTable, columnConfig),
    [selTable, columnConfig]
  )

  /* 사용 가능한 테이블 목록: DB_TABLES + columnConfig에 등록된 테이블들 */
  const availableTables = useMemo(() => {
    const seen = new Set()
    const tables = []
    // DB_TABLES 기본 포함
    DB_TABLES.forEach(t => {
      seen.add(t)
      const tCfg = columnConfig?.[t]
      const colCount = tCfg?.columns ? Object.keys(tCfg.columns).length : 0
      const displayName = getTableDisplayName(t, columnConfig)
      tables.push({
        id: t,
        label: displayName + (colCount ? ` · ${colCount}컬럼` : ''),
        displayName,
        icon: t === 'marketing_data' ? '📊' : '🏨',
      })
    })
    // columnConfig에만 있는 추가 테이블
    if (columnConfig) {
      Object.keys(columnConfig).forEach(t => {
        if (seen.has(t)) return
        seen.add(t)
        const tCfg = columnConfig[t]
        const colCount = tCfg?.columns ? Object.keys(tCfg.columns).length : 0
        const displayName = getTableDisplayName(t, columnConfig)
        tables.push({ id: t, label: displayName + (colCount ? ` · ${colCount}컬럼` : ''), displayName, icon: '🏨' })
      })
    }
    return tables
  }, [columnConfig])

  /* 카테고리별 허용 위젯 */
  const allowedTypes = SUB_TYPES[selCategory]?.widgetTypes || SUB_TYPES.report.widgetTypes

  const toggleMetric = mid => {
    const cur = wConfig.metrics || []
    setWConfig(c => ({ ...c, metrics: cur.includes(mid) ? cur.filter(x => x !== mid) : [...cur, mid] }))
  }

  const handleAdd = () => {
    const cfg = { ...wConfig, filters }
    if (NEEDS_DATA[selCategory]) cfg._table = selTable
    onAdd({ id: `w_${Date.now()}`, widthPct: 33.33, type, config: cfg })
    onClose()
  }

  const S = {
    sel: `px-2.5 py-1.5 rounded-lg border text-xs outline-none w-full
      ${dark ? 'bg-[#0F1117] border-[#252836] text-white' : 'bg-white border-slate-200 text-slate-700'}`,
    inp: `px-2.5 py-1.5 rounded-lg border text-xs outline-none w-full
      ${dark ? 'bg-[#0F1117] border-[#252836] text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-700'}`,
    lab: `text-[10px] font-bold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-slate-700'}`,
    btn: (on) => `text-xs px-2 py-1.5 rounded-lg border text-left transition-colors
      ${on ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
        : dark ? 'border-[#252836] text-slate-400 hover:border-indigo-500/40' : 'border-slate-200 text-slate-700 hover:border-indigo-300'}`,
  }

  /* 카테고리에 따라 동적 스텝 구성 */
  const needsData = NEEDS_DATA[selCategory]
  const STEPS = needsData
    ? ['카드 유형', '데이터 소스', '위젯 선택', '설정']
    : ['카드 유형', '위젯 선택', '설정']
  const totalSteps = STEPS.length

  /* 논리 스텝 → 실제 내부 스텝 매핑 */
  const toInternal = (logical) => {
    if (!needsData && logical >= 2) return logical + 1 // 2→3, 3→4
    return logical
  }
  const toLogical = (internal) => {
    if (!needsData && internal >= 3) return internal - 1 // 3→2, 4→3
    return internal
  }
  const logicalStep = toLogical(step)

  const goNext = () => {
    if (step === 1 && !needsData) setStep(3) // 카테고리→위젯 (데이터소스 스킵)
    else setStep(s => s + 1)
  }
  const goPrev = () => {
    if (step === 3 && !needsData) setStep(1) // 위젯→카테고리 (데이터소스 스킵)
    else setStep(s => s - 1)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className={`rounded-t-2xl sm:rounded-2xl border w-full sm:max-w-xl flex flex-col max-h-[90vh]
        ${dark ? 'bg-[#13151F] border-[#252836]' : 'bg-white border-slate-200 shadow-2xl'}`}>

        {/* 헤더 */}
        <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0
          ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
          <div>
            <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>카드 추가</p>
            <div className="flex items-center gap-1 mt-2">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors
                    ${logicalStep === i + 1 ? 'bg-indigo-500 text-white'
                      : logicalStep > i + 1 ? 'bg-emerald-500 text-white'
                        : dark ? 'bg-[#252836] text-slate-500' : 'bg-slate-100 text-slate-600'}`}>
                    {logicalStep > i + 1 ? '✓' : i + 1}
                  </div>
                  <span className={`text-[10px] font-medium hidden sm:inline
                    ${logicalStep === i + 1 ? (dark ? 'text-slate-200' : 'text-slate-700') : dark ? 'text-slate-600' : 'text-slate-600'}`}>
                    {s}
                  </span>
                  {i < totalSteps - 1 && <span className={`text-[10px] mx-0.5 ${dark ? 'text-slate-600' : 'text-slate-600'}`}>›</span>}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose}
            className={`p-2 rounded-xl ${dark ? 'text-slate-400 hover:bg-[#252836] hover:text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            <X size={16} />
          </button>
        </div>

        {/* 선택 요약 칩 */}
        {step > 1 && (
          <div className="flex items-center gap-1.5 px-5 pt-3 flex-wrap">
            <span className={`text-[10px] px-2.5 py-1 rounded-md font-semibold ${dark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
              {CATEGORY_META[selCategory]?.icon} {CATEGORY_META[selCategory]?.label}
            </span>
            {needsData && step > 2 && (
              <span className={`text-[10px] px-2.5 py-1 rounded-md font-semibold ${dark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                {availableTables.find(t => t.id === selTable)?.icon} {availableTables.find(t => t.id === selTable)?.displayName || selTable}
              </span>
            )}
            {step > 3 && (
              <span className={`text-[10px] px-2.5 py-1 rounded-md font-semibold ${dark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
                {WTYPE_META[type]?.icon} {WTYPE_META[type]?.label}
              </span>
            )}
          </div>
        )}

        {/* 바디 */}
        <div className="flex-1 overflow-y-auto p-5 min-h-0">

          {/* ─── Step 1: 카드 유형 선택 ─── */}
          {step === 1 && (
            <div className="flex flex-col gap-2">
              <p className={`${S.lab} mb-1`}>카드 유형</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(CATEGORY_META).map(([id, meta]) => {
                  const on = selCategory === id
                  return (
                    <button key={id} onClick={() => {
                      setSelCategory(id)
                      // 카테고리 변경 시 해당 카테고리 첫 위젯으로 초기화
                      const firstType = (SUB_TYPES[id]?.widgetTypes || ['kpi'])[0]
                      setType(firstType)
                      setWConfig({ ...DEFAULT_WIDGET_CONFIG[firstType] })
                    }}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center cursor-pointer transition-all
                        ${on ? 'border-indigo-500 bg-indigo-500/10'
                          : dark ? 'border-[#252836] hover:border-indigo-500/40' : 'border-slate-200 hover:border-indigo-300'}`}>
                      <span className="text-2xl">{meta.icon}</span>
                      <span className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-700'}`}>{meta.label}</span>
                      <span className={`text-[10px] leading-tight ${dark ? 'text-slate-400' : 'text-slate-700'}`}>{meta.desc}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded font-semibold ${dark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                        {(SUB_TYPES[id]?.widgetTypes || []).length}개 위젯
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ─── Step 2: 데이터 소스 선택 (리포트/퍼널/코호트만) ─── */}
          {step === 2 && needsData && (
            <div className="flex flex-col gap-2">
              <p className={`${S.lab} mb-1`}>데이터 소스 선택</p>
              {availableTables.map(t => {
                const on = selTable === t.id
                return (
                  <button key={t.id} onClick={() => setSelTable(t.id)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all
                      ${on ? 'border-indigo-500 bg-indigo-500/10'
                        : dark ? 'border-[#252836] hover:border-indigo-500/40' : 'border-slate-200 hover:border-indigo-300'}`}>
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-base ${dark ? 'bg-[#0F1117]' : 'bg-slate-100'}`}>
                      {t.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold truncate ${dark ? 'text-white' : 'text-slate-800'}`}>{t.displayName}</p>
                      <p className={`text-[10px] font-mono ${dark ? 'text-slate-500' : 'text-slate-700'}`}>{t.id}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] transition-colors
                      ${on ? 'border-indigo-500 bg-indigo-500 text-white' : dark ? 'border-[#252836]' : 'border-slate-200'}`}>
                      {on && '✓'}
                    </div>
                  </button>
                )
              })}
              <p className={`text-[10px] mt-2 p-2.5 rounded-lg border-l-2 border-indigo-500 leading-relaxed
                ${dark ? 'text-slate-500 bg-indigo-500/5' : 'text-slate-700 bg-indigo-50'}`}>
                선택한 테이블의 컬럼 설정(별칭, 계산 컬럼)이 위젯 메트릭에 반영됩니다.
              </p>
            </div>
          )}

          {/* ─── Step 3: 위젯 타입 선택 + 미리보기 ─── */}
          {step === 3 && (
            <div className="flex flex-col gap-2">
              <p className={`${S.lab} mb-1`}>위젯 선택</p>
              {allowedTypes.filter(id => WTYPE_META[id]).map(id => {
                const meta = WTYPE_META[id]
                const on = type === id
                const Preview = MINI_PREVIEW[id]
                return (
                  <button key={id} onClick={() => { setType(id); setWConfig({ ...DEFAULT_WIDGET_CONFIG[id] }) }}
                    className={`flex items-stretch gap-3 p-3 rounded-xl border text-left transition-all
                      ${on ? 'border-indigo-500 bg-indigo-500/10'
                        : dark ? 'border-[#252836] hover:border-indigo-500/40' : 'border-slate-200 hover:border-indigo-300'}`}>
                    {/* 미니 프리뷰 */}
                    <div className={`w-[72px] shrink-0 rounded-lg flex items-center justify-center p-2
                      ${dark ? 'bg-[#0F1117]' : 'bg-slate-50'}`}>
                      {Preview ? <Preview dark={dark} /> : <span className="text-xl">{meta.icon}</span>}
                    </div>
                    {/* 정보 */}
                    <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
                      <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{meta.label}</p>
                      <p className={`text-[10px] leading-snug ${dark ? 'text-slate-400' : 'text-slate-700'}`}>{meta.desc}</p>
                      <div className="flex gap-1 mt-0.5">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${dark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                          {meta.metricTag}
                        </span>
                        {meta.needsGroup && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${dark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
                            그룹 기준 1개
                          </span>
                        )}
                      </div>
                    </div>
                    {/* 체크 */}
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] self-center shrink-0 transition-colors
                      ${on ? 'border-indigo-500 bg-indigo-500 text-white' : dark ? 'border-[#252836]' : 'border-slate-200'}`}>
                      {on && '✓'}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* ─── Step 4: 메트릭 설정 ─── */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              {/* 메트릭 힌트 */}
              <div className={`text-[10px] p-2 rounded-lg flex items-center gap-2
                ${dark ? 'bg-indigo-500/5 text-slate-400' : 'bg-indigo-50 text-slate-700'}`}>
                <span className="text-indigo-400">ℹ</span>
                {WTYPE_META[type]?.metricTag}{WTYPE_META[type]?.needsGroup ? ' + 그룹 기준 1개가 필요합니다' : '가 필요합니다'}
              </div>

              {/* KPI — 단일 메트릭 */}
              {type === 'kpi' && (
                <>
                  <div>
                    <p className={`${S.lab} mb-2`}>지표</p>
                    <div className="flex flex-col gap-3">
                      {['metric', 'computed', 'rate'].map(group => {
                        const items = dynMetrics.filter(m => m.group === group)
                        if (!items.length) return null
                        return (
                          <div key={group}>
                            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5
                              ${group === 'computed' ? 'text-violet-400' : dark ? 'text-slate-400' : 'text-slate-700'}`}>
                              {group === 'metric' ? '지표' : group === 'computed' ? '🧮 계산 컬럼' : '단가'}
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {items.map(m => (
                                <button key={m.id} onClick={() => upd('metric', m.id)}
                                  className={`${S.btn(wConfig.metric === m.id)} ${m._computed ? 'border-l-2 !border-l-violet-500' : ''}`}>
                                  {m.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>커스텀 라벨 (선택)</p>
                    <input className={S.inp} value={wConfig.label || ''}
                      onChange={e => upd('label', e.target.value)} placeholder="기본: 지표명 사용" />
                  </div>
                </>
              )}

              {/* 시계열 — 복수 메트릭 */}
              {type === 'timeseries' && (
                <>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>제목</p>
                    <input className={S.inp} value={wConfig.title || ''}
                      onChange={e => upd('title', e.target.value)} placeholder="위젯 제목" />
                  </div>
                  <div>
                    <p className={`${S.lab} mb-2`}>지표 (복수 선택)</p>
                    <div className="flex flex-col gap-3">
                      {['metric', 'computed', 'rate'].map(group => {
                        const items = dynMetrics.filter(m => m.group === group)
                        if (!items.length) return null
                        return (
                          <div key={group}>
                            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5
                              ${group === 'computed' ? 'text-violet-400' : dark ? 'text-slate-400' : 'text-slate-700'}`}>
                              {group === 'metric' ? '지표' : group === 'computed' ? '🧮 계산 컬럼' : '단가'}
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {items.map(m => {
                                const on = (wConfig.metrics || []).includes(m.id)
                                return (
                                  <button key={m.id} onClick={() => toggleMetric(m.id)}
                                    className={`${S.btn(on)} ${m._computed ? 'border-l-2 !border-l-violet-500' : ''}`}>
                                    {on ? '✓ ' : ''}{m.label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* 바/도넛 — 단일 메트릭 + 그룹 */}
              {(type === 'bar' || type === 'donut') && (
                <>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>제목</p>
                    <input className={S.inp} value={wConfig.title || ''}
                      onChange={e => upd('title', e.target.value)} placeholder="위젯 제목" />
                  </div>
                  <div>
                    <p className={`${S.lab} mb-2`}>지표</p>
                    <div className="flex flex-col gap-3">
                      {['metric', 'computed', 'rate'].map(group => {
                        const items = dynMetrics.filter(m => m.group === group)
                        if (!items.length) return null
                        return (
                          <div key={group}>
                            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5
                              ${group === 'computed' ? 'text-violet-400' : dark ? 'text-slate-400' : 'text-slate-700'}`}>
                              {group === 'metric' ? '지표' : group === 'computed' ? '🧮 계산 컬럼' : '단가'}
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {items.map(m => (
                                <button key={m.id} onClick={() => upd('metric', m.id)}
                                  className={`${S.btn(wConfig.metric === m.id)} ${m._computed ? 'border-l-2 !border-l-violet-500' : ''}`}>
                                  {m.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>그룹 기준</p>
                    <select className={S.sel} value={wConfig.groupBy || dynGroupBy[0]?.id || 'channel'}
                      onChange={e => upd('groupBy', e.target.value)}>
                      {dynGroupBy.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* 테이블 — 복수 메트릭 + 그룹 */}
              {type === 'table' && (
                <>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>제목</p>
                    <input className={S.inp} value={wConfig.title || ''}
                      onChange={e => upd('title', e.target.value)} placeholder="위젯 제목" />
                  </div>
                  <div>
                    <p className={`${S.lab} mb-2`}>표시 지표 (복수 선택)</p>
                    <div className="flex flex-col gap-3">
                      {['metric', 'computed', 'rate'].map(group => {
                        const items = dynMetrics.filter(m => m.group === group)
                        if (!items.length) return null
                        return (
                          <div key={group}>
                            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5
                              ${group === 'computed' ? 'text-violet-400' : dark ? 'text-slate-400' : 'text-slate-700'}`}>
                              {group === 'metric' ? '지표' : group === 'computed' ? '🧮 계산 컬럼' : '단가'}
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {items.map(m => {
                                const on = (wConfig.metrics || []).includes(m.id)
                                return (
                                  <button key={m.id} onClick={() => {
                                    const cur = wConfig.metrics || []
                                    upd('metrics', on ? cur.filter(x => x !== m.id) : [...cur, m.id])
                                  }} className={`${S.btn(on)} ${m._computed ? 'border-l-2 !border-l-violet-500' : ''}`}>
                                    {on ? '✓ ' : ''}{m.label}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>그룹 기준</p>
                    <select className={S.sel} value={wConfig.groupBy || dynGroupBy[0]?.id || 'channel'}
                      onChange={e => upd('groupBy', e.target.value)}>
                      {dynGroupBy.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* ── 시뮬레이션: 예산 배분 ── */}
              {type === 'sim_budget' && (
                <>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>제목</p>
                    <input className={S.inp} value={wConfig.title || ''} onChange={e => upd('title', e.target.value)} placeholder="예산 배분 시뮬레이션" />
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>총 예산</p>
                    <input type="number" className={S.inp} value={wConfig.totalBudget || 1000000}
                      onChange={e => upd('totalBudget', Number(e.target.value))} />
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>목표 메트릭</p>
                    <select className={S.sel} value={wConfig.targetMetric || 'revenue'}
                      onChange={e => upd('targetMetric', e.target.value)}>
                      {dynMetrics.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* ── 시뮬레이션: 목표 역산 ── */}
              {type === 'sim_goal' && (
                <>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>제목</p>
                    <input className={S.inp} value={wConfig.title || ''} onChange={e => upd('title', e.target.value)} placeholder="목표 역산" />
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>목표 메트릭</p>
                    <select className={S.sel} value={wConfig.targetMetric || 'revenue'}
                      onChange={e => upd('targetMetric', e.target.value)}>
                      {dynMetrics.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>목표값</p>
                    <input type="number" className={S.inp} value={wConfig.targetValue || 10000000}
                      onChange={e => upd('targetValue', Number(e.target.value))} />
                  </div>
                </>
              )}

              {/* ── 시뮬레이션: 시나리오 비교 ── */}
              {type === 'sim_scenario' && (
                <>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>제목</p>
                    <input className={S.inp} value={wConfig.title || ''} onChange={e => upd('title', e.target.value)} placeholder="시나리오 비교" />
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>총 예산</p>
                    <input type="number" className={S.inp} value={wConfig.totalBudget || 1000000}
                      onChange={e => upd('totalBudget', Number(e.target.value))} />
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>비교 메트릭</p>
                    <select className={S.sel} value={wConfig.targetMetric || 'revenue'}
                      onChange={e => upd('targetMetric', e.target.value)}>
                      {dynMetrics.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* ── 퍼널: 전환 퍼널 / 브레이크다운 ── */}
              {(type === 'funnel_chart' || type === 'funnel_breakdown') && (
                <>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>제목</p>
                    <input className={S.inp} value={wConfig.title || ''} onChange={e => upd('title', e.target.value)} placeholder="전환 퍼널" />
                  </div>
                  <div>
                    <p className={`${S.lab} mb-2`}>퍼널 단계</p>
                    {(wConfig.stages || []).map((stage, si) => (
                      <div key={stage.id} className="flex gap-1.5 mb-1.5">
                        <input className={`${S.inp} flex-1`} value={stage.label}
                          onChange={e => {
                            const next = [...wConfig.stages]; next[si] = {...stage, label: e.target.value}; upd('stages', next)
                          }} placeholder={`단계 ${si+1} 이름`} />
                        <select className={`${S.sel} w-32`} value={stage.metric}
                          onChange={e => {
                            const next = [...wConfig.stages]; next[si] = {...stage, metric: e.target.value}; upd('stages', next)
                          }}>
                          {dynMetrics.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                        </select>
                        {wConfig.stages.length > 2 && (
                          <button onClick={() => upd('stages', wConfig.stages.filter((_,j) => j !== si))}
                            className="text-red-400 hover:text-red-300 text-xs px-1">×</button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => upd('stages', [...(wConfig.stages||[]), {id:`s${Date.now()}`, label:'', metric: dynMetrics[0]?.id || 'impr'}])}
                      className={`text-[10px] px-2 py-1 rounded-lg border border-dashed mt-1
                        ${dark ? 'border-[#252836] text-slate-400 hover:text-indigo-400' : 'border-slate-200 text-slate-700'}`}>
                      + 단계 추가
                    </button>
                  </div>
                  {type === 'funnel_breakdown' && (
                    <div>
                      <p className={`${S.lab} mb-1.5`}>그룹 기준</p>
                      <select className={S.sel} value={wConfig.groupBy || 'channel'}
                        onChange={e => upd('groupBy', e.target.value)}>
                        {dynGroupBy.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}

              {/* ── 코호트: 히트맵 / 트렌드 ── */}
              {(type === 'cohort_heatmap' || type === 'cohort_trend') && (
                <>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>제목</p>
                    <input className={S.inp} value={wConfig.title || ''} onChange={e => upd('title', e.target.value)}
                      placeholder={type === 'cohort_heatmap' ? '리텐션 히트맵' : '코호트 트렌드'} />
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>기간 단위</p>
                    <select className={S.sel} value={wConfig.granularity || 'week'}
                      onChange={e => upd('granularity', e.target.value)}>
                      <option value="week">주간</option>
                      <option value="month">월간</option>
                    </select>
                  </div>
                  <div>
                    <p className={`${S.lab} mb-1.5`}>기간 수</p>
                    <input type="number" className={S.inp} value={wConfig.periods || 8} min={2} max={24}
                      onChange={e => upd('periods', Number(e.target.value))} />
                  </div>
                </>
              )}

              {/* ── 칸반 보드 ── */}
              {type === 'kanban_board' && (
                <>
                  <div>
                    <p className={`${S.lab} mb-2`}>칼럼 설정</p>
                    {(wConfig.columns || []).map((col, ci) => (
                      <div key={col.id} className="flex gap-1.5 mb-1.5">
                        <input className={`${S.inp} flex-1`} value={col.title}
                          onChange={e => {
                            const next = [...wConfig.columns]; next[ci] = {...col, title: e.target.value}; upd('columns', next)
                          }} placeholder={`칼럼 ${ci+1}`} />
                        {wConfig.columns.length > 1 && (
                          <button onClick={() => upd('columns', wConfig.columns.filter((_,j) => j !== ci))}
                            className="text-red-400 hover:text-red-300 text-xs px-1">×</button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => upd('columns', [...(wConfig.columns||[]), {id:`c${Date.now()}`, title:'', cards:[]}])}
                      className={`text-[10px] px-2 py-1 rounded-lg border border-dashed mt-1
                        ${dark ? 'border-[#252836] text-slate-400 hover:text-indigo-400' : 'border-slate-200 text-slate-700'}`}>
                      + 칼럼 추가
                    </button>
                  </div>
                </>
              )}

              {/* 데이터 필터 — 리포트 카드 타입 공통 */}
              {['kpi','timeseries','bar','donut','table','funnel_chart','funnel_breakdown'].includes(type) && (
                <FilterSection
                  filters={filters}
                  groupBy={wConfig.groupBy}
                  data={data}
                  dark={dark}
                  onChange={setFilters}
                  onGroupByChange={['bar', 'donut', 'table', 'funnel_breakdown'].includes(type)
                    ? (dim) => upd('groupBy', dim ?? (dynGroupBy[0]?.id || 'channel'))
                    : undefined}
                />
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className={`flex items-center justify-between px-5 py-4 border-t shrink-0
          ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
          <button
            onClick={() => step > 1 ? goPrev() : onClose()}
            className={`text-xs px-4 py-2 rounded-xl border transition-colors
              ${dark ? 'border-[#252836] text-slate-400 hover:text-white hover:border-slate-600'
                : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
            {step > 1 ? '← 이전' : '취소'}
          </button>
          {step < 4 ? (
            <button onClick={goNext}
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
function DashboardGrid({ tabId, dashboard, setDashboard, data, dark, editMode, showAdd, onOpenAdd, onCloseAdd, tableMetrics, tableGroupBy, columnConfig }) {
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

  /* 상태형 위젯의 config 실시간 업데이트 (칸반 카드 이동, 시뮬레이션 슬라이더 등) */
  const handleConfigUpdate = useCallback((slotId, newConfig) => {
    setDashboard(prev => {
      const n = normalizeDashboard(prev)
      return { ...n, slots: (n.slots || []).map(s => s.id === slotId ? { ...s, config: newConfig } : s) }
    })
  }, [])

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
                  onConfigUpdate={handleConfigUpdate}
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
                {renderWidget(activeSlot.type, applyWidgetFilters(data, activeSlot.config.filters), activeSlot.config, dark, tableMetrics, null)}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* 카드 추가 모달 */}
      {showAdd && (
        <AddWidgetModal dark={dark} data={data} onAdd={handleAddSlot} onClose={onCloseAdd} metrics={tableMetrics} groupByOptions={tableGroupBy} columnConfig={columnConfig} />
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
          metrics={tableMetrics}
          groupByOptions={tableGroupBy}
          columnConfig={columnConfig}
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
        rightSlot={activeTab ? (
          editMode ? (
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
            tableMetrics={tableMetrics}
            tableGroupBy={tableGroupBy}
            columnConfig={config.columnConfig}
          />
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
