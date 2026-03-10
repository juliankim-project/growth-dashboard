import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { Settings2, Check, X, Plus, GripVertical, LayoutTemplate } from 'lucide-react'
import {
  TEMPLATES, WIDGET_TYPES,
  makeDashboard, DEFAULT_WIDGET_CONFIG,
  useConfig,
} from '../store/useConfig'
import { useColumnConfig } from '../store/useColumnConfig'
import { TABLES as DB_TABLES, applyComputedColumns, buildTableMetrics, buildTableGroupBy, buildWidgetMetrics, buildWidgetGroupBy, getTableDisplayName, getColumnLabel, sanitizeWidgetConfig } from '../store/columnUtils'
import { DASHBOARD_TEMPLATES, generateDashboard } from '../store/dashboardTemplates'
import { useMultiTableData } from '../hooks/useTableData'
import Spinner from '../components/UI/Spinner'
import ErrorBoundary from '../components/UI/ErrorBoundary'
import KPIWidget from '../components/widgets/KPIWidget'
import LineWidget from '../components/widgets/LineWidget'
import BarWidget from '../components/widgets/BarWidget'
import PieWidget from '../components/widgets/PieWidget'
import TableWidget from '../components/widgets/TableWidget'
import FunnelWidget from '../components/widgets/FunnelWidget'
import ComparisonWidget from '../components/widgets/ComparisonWidget'
import RankingWidget from '../components/widgets/RankingWidget'
import AlertWidget from '../components/widgets/AlertWidget'
import TimelineWidget from '../components/widgets/TimelineWidget'
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

/* ── 카드별 필터 적용: dimensionColumns 기반 동적 필터링 ── */
function applyWidgetFilters(data, filters) {
  if (!filters) return data
  let result = data
  Object.entries(filters).forEach(([key, vals]) => {
    if (key === 'table') return
    if (Array.isArray(vals) && vals.length > 0) {
      result = result.filter(r => vals.includes(r[key]))
    }
  })
  return result
}

/* ─────────────────────────────────────────────────────────────────
   FilterSection  —  columnConfig 기반 동적 디멘전 필터
───────────────────────────────────────────────────────────────── */
function FilterSection({ filters = {}, groupBy, data, dark, onChange, onGroupByChange, initialOpen = false, columnConfig, tableName }) {
  const [open, setOpen] = useState(initialOpen)
  const tCfg = columnConfig?.[tableName]
  const dimCols = tCfg?.dimensionColumns || []
  const dimLabel = (dim) => getColumnLabel(dim, tCfg?.columns?.[dim])

  const dimStates = dimCols.map((dim) => {
    let filtered = data
    dimCols.forEach(otherDim => {
      if (otherDim === dim) return
      const sel = filters[otherDim] || []
      if (sel.length > 0) filtered = filtered.filter(r => sel.includes(r[otherDim]))
    })
    const opts = [...new Set(filtered.map(r => r[dim]).filter(Boolean))].sort()
    const sel = filters[dim] || []
    return { key: dim, label: dimLabel(dim), opts, sel, show: opts.length > 0 }
  })

  const COLS = dimStates.filter(d => d.show)
  const toggle = (dim, val) => {
    const cur = filters[dim] || []
    const next = cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val]
    onChange({ ...filters, [dim]: next })
  }
  const clearDim = (dim) => onChange({ ...filters, [dim]: [] })
  const activeCount = dimStates.reduce((sum, d) => sum + d.sel.length, 0)
  const groupByLabel = COLS.find(c => c.key === groupBy)?.label ?? dimLabel(groupBy)

  return (
    <div className={`rounded-xl border ${dark ? 'border-[#252836]' : 'border-slate-200'}`}>
      <button onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left transition-colors rounded-xl
          ${dark ? 'hover:bg-[#1A1D27]' : 'hover:bg-slate-50'}`}>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-xs font-bold ${dark ? 'text-slate-300' : 'text-slate-700'}`}>데이터 필터</span>
          {activeCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500 text-white font-bold">{activeCount}</span>}
          {groupBy && onGroupByChange && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${dark ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-50 text-violet-600'}`}>
              그룹바이: {groupByLabel}
            </span>
          )}
        </div>
        <span className={`text-[10px] shrink-0 ml-2 ${dark ? 'text-slate-600' : 'text-slate-400'}`}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={`border-t overflow-x-auto ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
          <div className="flex min-w-max">
            {COLS.length === 0 && (
              <p className={`text-[10px] px-4 py-3 ${dark ? 'text-slate-600' : 'text-slate-400'}`}>
                디멘전 컬럼이 설정되지 않았습니다.
              </p>
            )}
            {COLS.map((col, ci) => {
              const isGroupByDim = groupBy === col.key
              const bdrR = ci < COLS.length - 1 ? (dark ? 'border-r border-[#252836]' : 'border-r border-slate-200') : ''
              return (
                <div key={col.key} className={`w-36 flex flex-col shrink-0 ${bdrR}`}>
                  <div className={`flex items-center justify-between px-2.5 py-1.5 border-b shrink-0
                    ${dark ? 'bg-[#0D0F18] border-[#252836]' : 'bg-slate-50 border-slate-200'}`}>
                    <span className={`text-[10px] font-bold uppercase tracking-wide truncate
                      ${dark ? 'text-slate-400' : 'text-slate-700'}`}>{col.label}</span>
                    {col.sel.length > 0 && !isGroupByDim && (
                      <button onClick={() => clearDim(col.key)} className="text-[9px] text-indigo-400 hover:text-indigo-300 ml-1 shrink-0">해제</button>
                    )}
                  </div>
                  {onGroupByChange && (
                    <button onClick={() => onGroupByChange(isGroupByDim ? null : col.key)}
                      className={`text-[10px] px-2.5 py-1 text-center border-b w-full transition-colors
                        ${dark ? 'border-[#252836]' : 'border-slate-200'}
                        ${isGroupByDim ? 'bg-violet-500/15 text-violet-400 font-semibold'
                          : dark ? 'text-slate-600 hover:text-slate-400 hover:bg-[#1A1D27]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
                      {isGroupByDim ? '✓ 그룹바이' : '그룹바이'}
                    </button>
                  )}
                  <div className="overflow-y-auto flex flex-col" style={{ maxHeight: 164 }}>
                    {col.opts.length === 0
                      ? <p className={`text-[10px] px-2.5 py-2 ${dark ? 'text-slate-600' : 'text-slate-400'}`}>없음</p>
                      : col.opts.map(v => {
                        const isOn = col.sel.includes(v)
                        const dimmed = isGroupByDim
                        return (
                          <button key={v} onClick={() => !dimmed && toggle(col.key, v)} title={v}
                            className={`text-[11px] px-2.5 py-[5px] text-left w-full transition-colors leading-snug break-words
                              ${dimmed ? (dark ? 'text-slate-700 cursor-default' : 'text-slate-300 cursor-default')
                                : isOn ? (dark ? 'bg-indigo-500/15 text-indigo-400 font-semibold' : 'bg-indigo-50 text-indigo-600 font-semibold')
                                  : dark ? 'text-slate-400 hover:bg-[#1A1D27] hover:text-slate-200' : 'text-slate-600 hover:bg-slate-50'}`}>
                            {!dimmed && isOn ? '✓ ' : ''}{v}
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

/* ══════════════════════════════════════════
   위젯 매핑 & 렌더링
══════════════════════════════════════════ */
const WIDGET_MAP = {
  kpi: KPIWidget, line: LineWidget, bar: BarWidget,
  pie: PieWidget, table: TableWidget, funnel: FunnelWidget,
  comparison: ComparisonWidget, ranking: RankingWidget,
  alert: AlertWidget, timeline: TimelineWidget,
}

const renderWidget = (type, data, cfg, dark, metrics, onConfigUpdate, dateColumn, dateRange) => {
  const C = WIDGET_MAP[type]
  if (!C) return null
  return (
    <ErrorBoundary dark={dark} label={type}>
      <C data={data} config={cfg} dark={dark} metrics={metrics} dateColumn={dateColumn} dateRange={dateRange} />
    </ErrorBoundary>
  )
}

/* ══════════════════════════════════════════
   공유 Picker 컴포넌트
══════════════════════════════════════════ */
const GROUP_LABELS = { metric: '지표', computed: '🧮 계산 컬럼', rate: '단가' }

function groupMetrics(metrics) {
  const groups = {}
  metrics.forEach(m => {
    const g = m._computed ? 'computed' : (m.group || 'metric')
    if (!groups[g]) groups[g] = []
    groups[g].push(m)
  })
  return groups
}

function MetricPicker({ metrics, selected, onSelect, multi = false, dark }) {
  const groups = useMemo(() => groupMetrics(metrics), [metrics])
  const selectedSet = useMemo(() => new Set(
    multi ? (Array.isArray(selected) ? selected : []) : [selected]
  ), [selected, multi])

  const handleClick = (mid) => {
    if (multi) {
      const cur = Array.isArray(selected) ? selected : []
      onSelect(cur.includes(mid) ? cur.filter(x => x !== mid) : [...cur, mid])
    } else {
      onSelect(mid)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {Object.entries(groups).map(([group, items]) => (
        <div key={group}>
          <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5
            ${group === 'computed' ? 'text-violet-400' : dark ? 'text-slate-400' : 'text-slate-500'}`}>
            {GROUP_LABELS[group] || group}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {items.map(m => {
              const on = selectedSet.has(m.id)
              return (
                <button key={m.id} onClick={() => handleClick(m.id)}
                  className={`text-xs px-2 py-1.5 rounded-lg border text-left transition-colors
                    ${m._computed ? 'border-l-2 !border-l-violet-500' : ''}
                    ${on ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                      : dark ? 'border-[#252836] text-slate-400 hover:border-indigo-500/40'
                        : 'border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                  {multi && on ? '✓ ' : ''}{m.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function GroupByPicker({ options, selected, onSelect, dark }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {options.map(g => {
        const on = selected === g.id
        return (
          <button key={g.id} onClick={() => onSelect(g.id)}
            className={`text-xs px-2 py-1.5 rounded-lg border text-left transition-colors
              ${on ? 'border-violet-500 bg-violet-500/10 text-violet-400'
                : dark ? 'border-[#252836] text-slate-400 hover:border-violet-500/40'
                  : 'border-slate-200 text-slate-600 hover:border-violet-300'}`}>
            {g.label}
          </button>
        )
      })}
    </div>
  )
}

/* ══════════════════════════════════════════
   위젯 에디터 모달 — 단일 패널 (추가/수정 겸용)
══════════════════════════════════════════ */
function WidgetEditor({ slotId, widget, dark, data = [], onSave, onClose, columnConfig, availableTables }) {
  const isNew = !slotId
  const [selTable, setSelTable] = useState(widget.table || widget.config?._table || 'marketing_data')
  const [type, setType] = useState(widget.type || 'kpi')
  const [config, setConfig] = useState(() =>
    sanitizeWidgetConfig(widget.type, { ...widget.config }, widget.table || widget.config?._table || 'marketing_data', columnConfig)
  )
  const [filters, setFilters] = useState(widget.config?.filters || {})

  const dynMetrics = useMemo(() => buildWidgetMetrics(selTable, columnConfig), [selTable, columnConfig])
  const dynGroupBy = useMemo(() => buildWidgetGroupBy(selTable, columnConfig), [selTable, columnConfig])
  const wtMeta = WIDGET_TYPES.find(w => w.id === type)

  const handleTableChange = (newTable) => {
    setSelTable(newTable)
    setConfig(prev => sanitizeWidgetConfig(type, prev, newTable, columnConfig))
    setFilters({})
  }

  const upd = (k, v) => setConfig(c => ({ ...c, [k]: v }))

  const changeType = t => {
    setType(t)
    const base = { ...DEFAULT_WIDGET_CONFIG[t] }
    const first = dynMetrics[0]?.id
    const firstGb = dynGroupBy[0]?.id
    if (first) {
      if ('metric' in base) base.metric = first
      if (Array.isArray(base.metrics)) base.metrics = [first]
    }
    if (firstGb && 'groupBy' in base) base.groupBy = firstGb
    setConfig(base)
  }

  const handleSave = () => {
    if (isNew) {
      onSave(null, { id: `w_${Date.now()}`, widthPct: type === 'kpi' ? 25 : 50, type, table: selTable, config: { ...config, filters } })
    } else {
      onSave(slotId, { type, table: selTable, config: { ...config, filters } })
    }
  }

  const S = {
    sel: `px-2.5 py-1.5 rounded-lg border text-xs outline-none w-full
      ${dark ? 'bg-[#0F1117] border-[#252836] text-white' : 'bg-white border-slate-200 text-slate-700'}`,
    inp: `px-2.5 py-1.5 rounded-lg border text-xs outline-none w-full
      ${dark ? 'bg-[#0F1117] border-[#252836] text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-700'}`,
    lab: `text-[10px] font-bold uppercase tracking-wide ${dark ? 'text-slate-400' : 'text-slate-700'}`,
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className={`rounded-t-2xl sm:rounded-2xl border w-full sm:max-w-xl flex flex-col max-h-[90vh]
        ${dark ? 'bg-[#13151F] border-[#252836]' : 'bg-white border-slate-200 shadow-2xl'}`}>

        {/* 헤더 */}
        <div className={`flex items-center justify-between px-5 py-4 border-b shrink-0
          ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
          <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
            {isNew ? '카드 추가' : '위젯 편집'}
          </p>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2.5 py-1 rounded-md font-semibold ${dark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              📊 {getTableDisplayName(selTable, columnConfig)}
            </span>
            <button onClick={onClose} className={`p-2 rounded-xl ${dark ? 'text-slate-400 hover:bg-[#252836] hover:text-white' : 'text-slate-400 hover:bg-slate-100'}`}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 바디 */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 min-h-0">

          {/* 위젯 유형 */}
          <div>
            <p className={`${S.lab} mb-1.5`}>위젯 유형</p>
            <select className={S.sel} value={type} onChange={e => changeType(e.target.value)}>
              {WIDGET_TYPES.map(wt => (
                <option key={wt.id} value={wt.id}>{wt.icon} {wt.label}</option>
              ))}
            </select>
          </div>

          {/* 데이터 소스 */}
          {availableTables && availableTables.length > 1 && (
            <div>
              <p className={`${S.lab} mb-1.5`}>데이터 소스</p>
              <select className={S.sel} value={selTable} onChange={e => handleTableChange(e.target.value)}>
                {availableTables.map(t => (
                  <option key={t.id} value={t.id}>{t.displayName || t.id}</option>
                ))}
              </select>
            </div>
          )}

          {/* 제목 (KPI 제외) */}
          {type !== 'kpi' && (
            <div>
              <p className={`${S.lab} mb-1.5`}>제목</p>
              <input className={S.inp} value={config.title || ''} onChange={e => upd('title', e.target.value)} placeholder="위젯 제목" />
            </div>
          )}

          {/* === 타입별 설정 === */}

          {/* KPI */}
          {type === 'kpi' && (
            <>
              <div>
                <p className={`${S.lab} mb-2`}>지표</p>
                <MetricPicker metrics={dynMetrics} selected={config.metric} onSelect={mid => upd('metric', mid)} dark={dark} />
              </div>
              <div>
                <p className={`${S.lab} mb-1.5`}>커스텀 라벨 (선택)</p>
                <input className={S.inp} value={config.label || ''} onChange={e => upd('label', e.target.value)} placeholder="기본: 지표명 사용" />
              </div>
            </>
          )}

          {/* Line — multi metric */}
          {type === 'line' && (
            <div>
              <p className={`${S.lab} mb-2`}>지표 (복수 선택)</p>
              <MetricPicker metrics={dynMetrics} selected={config.metrics || []} onSelect={v => upd('metrics', v)} multi dark={dark} />
            </div>
          )}

          {/* Bar / Pie — single metric + groupBy */}
          {(type === 'bar' || type === 'pie') && (
            <>
              <div>
                <p className={`${S.lab} mb-2`}>지표</p>
                <MetricPicker metrics={dynMetrics} selected={config.metric} onSelect={mid => upd('metric', mid)} dark={dark} />
              </div>
              <div>
                <p className={`${S.lab} mb-1.5`}>그룹 기준</p>
                <GroupByPicker options={dynGroupBy} selected={config.groupBy || dynGroupBy[0]?.id} onSelect={v => upd('groupBy', v)} dark={dark} />
              </div>
            </>
          )}

          {/* Table — multi metric + groupBy */}
          {type === 'table' && (
            <>
              <div>
                <p className={`${S.lab} mb-2`}>표시 지표 (복수 선택)</p>
                <MetricPicker metrics={dynMetrics} selected={config.metrics || []} onSelect={v => upd('metrics', v)} multi dark={dark} />
              </div>
              <div>
                <p className={`${S.lab} mb-1.5`}>그룹 기준</p>
                <GroupByPicker options={dynGroupBy} selected={config.groupBy || dynGroupBy[0]?.id} onSelect={v => upd('groupBy', v)} dark={dark} />
              </div>
            </>
          )}

          {/* Funnel */}
          {type === 'funnel' && (
            <div>
              <p className={`${S.lab} mb-2`}>퍼널 단계</p>
              {(config.stages || []).map((stage, si) => (
                <div key={stage.id} className="flex gap-1.5 mb-1.5">
                  <input className={`${S.inp} flex-1`} value={stage.label}
                    onChange={e => { const next = [...config.stages]; next[si] = {...stage, label: e.target.value}; upd('stages', next) }}
                    placeholder={`단계 ${si+1}`} />
                  <select className={`${S.sel} w-32`} value={stage.metric}
                    onChange={e => { const next = [...config.stages]; next[si] = {...stage, metric: e.target.value}; upd('stages', next) }}>
                    {dynMetrics.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                  {(config.stages || []).length > 2 && (
                    <button onClick={() => upd('stages', config.stages.filter((_,j) => j !== si))} className="text-red-400 hover:text-red-300 text-xs px-1">×</button>
                  )}
                </div>
              ))}
              <button onClick={() => upd('stages', [...(config.stages||[]), {id:`s${Date.now()}`, label:'', metric: dynMetrics[0]?.id || ''}])}
                className={`text-[10px] px-2 py-1 rounded-lg border border-dashed mt-1
                  ${dark ? 'border-[#252836] text-slate-400 hover:text-indigo-400' : 'border-slate-200 text-slate-500'}`}>
                + 단계 추가
              </button>
            </div>
          )}

          {/* Comparison — multi metric + compareMode */}
          {type === 'comparison' && (
            <>
              <div>
                <p className={`${S.lab} mb-2`}>비교 지표 (복수 선택)</p>
                <MetricPicker metrics={dynMetrics} selected={config.metrics || []} onSelect={v => upd('metrics', v)} multi dark={dark} />
              </div>
              <div>
                <p className={`${S.lab} mb-1.5`}>비교 모드</p>
                <select className={S.sel} value={config.compareMode || 'period'} onChange={e => upd('compareMode', e.target.value)}>
                  <option value="period">기간 비교 (선택 기간 vs 직전 동일 기간)</option>
                  <option value="segment">세그먼트 비교</option>
                </select>
              </div>
            </>
          )}

          {/* Ranking — single metric + groupBy + topN */}
          {type === 'ranking' && (
            <>
              <div>
                <p className={`${S.lab} mb-2`}>지표</p>
                <MetricPicker metrics={dynMetrics} selected={config.metric} onSelect={mid => upd('metric', mid)} dark={dark} />
              </div>
              <div>
                <p className={`${S.lab} mb-1.5`}>그룹 기준</p>
                <GroupByPicker options={dynGroupBy} selected={config.groupBy || dynGroupBy[0]?.id} onSelect={v => upd('groupBy', v)} dark={dark} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <p className={`${S.lab} mb-1.5`}>Top N</p>
                  <input type="number" className={S.inp} value={config.topN || 10} min={3} max={50}
                    onChange={e => upd('topN', Number(e.target.value))} />
                </div>
                <div className="flex-1">
                  <p className={`${S.lab} mb-1.5`}>정렬</p>
                  <select className={S.sel} value={config.sortDir || 'desc'} onChange={e => upd('sortDir', e.target.value)}>
                    <option value="desc">내림차순 (높은 순)</option>
                    <option value="asc">오름차순 (낮은 순)</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Alert — multi metric (thresholds는 향후 상세 설정) */}
          {type === 'alert' && (
            <div>
              <p className={`${S.lab} mb-2`}>모니터링 지표 (복수 선택)</p>
              <MetricPicker metrics={dynMetrics} selected={config.metrics || []} onSelect={v => upd('metrics', v)} multi dark={dark} />
            </div>
          )}

          {/* Timeline — multi metric */}
          {type === 'timeline' && (
            <div>
              <p className={`${S.lab} mb-2`}>지표 (복수 선택)</p>
              <MetricPicker metrics={dynMetrics} selected={config.metrics || []} onSelect={v => upd('metrics', v)} multi dark={dark} />
            </div>
          )}

          {/* 데이터 필터 — groupBy가 필요한 타입에 한해 표시 */}
          <FilterSection
            filters={filters}
            groupBy={config.groupBy}
            data={data}
            dark={dark}
            onChange={setFilters}
            columnConfig={columnConfig}
            tableName={selTable}
            onGroupByChange={wtMeta?.needsGroup
              ? (dim) => upd('groupBy', dim ?? (dynGroupBy[0]?.id || ''))
              : undefined}
          />
        </div>

        {/* 푸터 */}
        <div className={`flex items-center justify-between px-5 py-4 border-t shrink-0
          ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
          <button onClick={onClose}
            className={`text-xs px-4 py-2 rounded-xl border transition-colors
              ${dark ? 'border-[#252836] text-slate-400 hover:text-white hover:border-slate-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            취소
          </button>
          <button onClick={handleSave}
            className="flex items-center gap-1.5 text-xs px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold">
            {isNew ? <><Plus size={12} /> 카드 추가</> : <><Check size={12} /> 저장</>}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   드래그 가능한 카드 (dnd-kit)
══════════════════════════════════════════ */
const MGAP = 12
const MIN_W_PCT = 10
const MIN_H_PX = 80
const SNAP_RANGE = 15

function pctToWidth(pct) {
  const gapAdj = MGAP * (1 - pct / 100)
  return `calc(${pct}% - ${gapAdj}px)`
}

function findSnap(value, neighbors, range = SNAP_RANGE) {
  for (const n of neighbors) {
    if (Math.abs(value - n) <= range) return n
  }
  return null
}

function SortableCard({ slot, editMode, onEdit, onDelete, onWidthChange, onHeightChange, onConfigUpdate, dataMap, defaultTable, filterByDate, columnConfig, dark, gridRef }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slot.id, disabled: !editMode })
  const outerRef = useRef(null)
  const setRefs = useCallback((el) => { outerRef.current = el; setNodeRef(el) }, [setNodeRef])
  const [resizing, setResizing] = useState(false)
  const [sizeTooltip, setSizeTooltip] = useState(null)
  const [snapping, setSnapping] = useState(false)

  const getNeighborRightEdges = useCallback(() => {
    const grid = gridRef?.current
    if (!grid) return []
    return [...grid.querySelectorAll('[data-slot-id]')].filter(c => c.dataset.slotId !== slot.id).map(c => c.getBoundingClientRect().right)
  }, [gridRef, slot.id])

  const getNeighborBottomEdges = useCallback(() => {
    const grid = gridRef?.current
    if (!grid) return []
    return [...grid.querySelectorAll('[data-slot-id]')].filter(c => c.dataset.slotId !== slot.id).map(c => c.getBoundingClientRect().bottom)
  }, [gridRef, slot.id])

  const startResize = (e, direction) => {
    e.preventDefault(); e.stopPropagation()
    const grid = gridRef?.current; const el = outerRef.current
    if (!grid || !el) return
    const gridW = grid.getBoundingClientRect().width
    const startX = e.clientX; const startY = e.clientY
    const elRect = el.getBoundingClientRect()
    const startW = elRect.width; const startH = elRect.height
    const startLeft = elRect.left; const startTop = elRect.top
    setResizing(true)

    const onMove = (ev) => {
      let newW = startW; let newH = startH; let snapped = false
      if (direction === 'right' || direction === 'corner') {
        newW = Math.max(gridW * MIN_W_PCT / 100, startW + (ev.clientX - startX))
        const myRight = startLeft + newW
        const snapRight = findSnap(myRight, getNeighborRightEdges())
        if (snapRight !== null) { newW = snapRight - startLeft; snapped = true }
        const pct = Math.min(100, Math.max(MIN_W_PCT, (newW + MGAP) / (gridW + MGAP) * 100))
        onWidthChange(slot.id, Math.round(pct * 100) / 100)
      }
      if (direction === 'bottom' || direction === 'corner') {
        newH = Math.max(MIN_H_PX, startH + (ev.clientY - startY))
        const myBottom = startTop + newH
        const snapBottom = findSnap(myBottom, getNeighborBottomEdges())
        if (snapBottom !== null) { newH = snapBottom - startTop; snapped = true }
        onHeightChange(slot.id, Math.round(newH))
      }
      setSnapping(snapped)
      setSizeTooltip({ w: Math.round(newW), h: Math.round(newH) })
    }

    const onUp = () => {
      setResizing(false); setSizeTooltip(null); setSnapping(false)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  /* 위젯별 데이터: slot.table 기반 (config._table 폴백) */
  const widgetTable = slot.table || slot.config?._table || defaultTable
  const widgetRawData = dataMap[widgetTable] || dataMap[defaultTable] || []
  const widgetDateCol = columnConfig?.[widgetTable]?.dateColumn
  const widgetData = useMemo(() => {
    const filtered = filterByDate ? filterByDate(widgetRawData, widgetDateCol) : widgetRawData
    return applyComputedColumns(filtered, widgetTable, columnConfig)
  }, [widgetRawData, filterByDate, widgetTable, columnConfig, widgetDateCol])
  const widgetMetrics = useMemo(() => buildTableMetrics(widgetTable, columnConfig), [widgetTable, columnConfig])

  const sanitizedConfig = useMemo(
    () => sanitizeWidgetConfig(slot.type, slot.config, widgetTable, columnConfig),
    [slot.type, slot.config, widgetTable, columnConfig]
  )

  const widthPct = slot.widthPct ?? 33.33
  const heightPx = slot.heightPx
  const cardStyle = {
    width: pctToWidth(widthPct),
    ...(heightPx ? { height: `${heightPx}px` } : {}),
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  }

  const handleColor = snapping ? 'bg-purple-500 shadow-lg shadow-purple-500/40'
    : resizing ? 'bg-indigo-500 shadow-lg shadow-indigo-500/40'
    : dark ? 'bg-[#252836] hover:bg-indigo-500' : 'bg-slate-200 hover:bg-indigo-500'

  return (
    <div ref={setRefs} style={cardStyle} data-slot-id={slot.id} className="relative shrink-0">
      {editMode && (
        <>
          <div {...attributes} {...listeners}
            className={`absolute top-1.5 left-1/2 -translate-x-1/2 z-20 flex items-center px-2 py-0.5 rounded-full cursor-grab active:cursor-grabbing
              ${dark ? 'bg-[#0F1117]/90 text-slate-400 hover:text-slate-200 border border-[#252836]' : 'bg-white/90 text-slate-400 hover:text-slate-600 border border-slate-200 shadow-sm'}`}>
            <GripVertical size={11} />
          </div>
          <button onClick={() => onDelete(slot.id)}
            className="absolute -top-2 -right-2 z-20 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg flex items-center justify-center text-xs leading-none font-bold transition-transform hover:scale-110">×</button>
          <div onPointerDown={e => startResize(e, 'right')} title="드래그해서 너비 조절"
            className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-[5px] z-20 w-2.5 h-10 rounded-full cursor-col-resize select-none transition-colors ${handleColor}`} />
          <div onPointerDown={e => startResize(e, 'bottom')} onDoubleClick={(e) => { e.stopPropagation(); onHeightChange(slot.id, null) }}
            title="드래그해서 높이 조절 · 더블클릭으로 자동"
            className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[5px] z-20 h-2.5 w-10 rounded-full cursor-row-resize select-none transition-colors ${handleColor}`} />
          <div onPointerDown={e => startResize(e, 'corner')} title="드래그해서 크기 조절"
            className={`absolute bottom-0 right-0 translate-x-[4px] translate-y-[4px] z-20 w-4 h-4 rounded-full cursor-nwse-resize select-none transition-colors ${handleColor}`} />
          <button onClick={() => onEdit(slot.id)}
            className="absolute bottom-1.5 right-1.5 z-20 flex items-center gap-1 px-2 py-0.5 bg-indigo-600 text-white text-[10px] rounded-lg hover:bg-indigo-700">
            <Settings2 size={9} /> 편집
          </button>
          {sizeTooltip && (
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold pointer-events-none
              ${snapping ? 'bg-purple-600 text-white' : 'bg-black/70 text-white'}`}>
              {sizeTooltip.w} × {sizeTooltip.h}
            </div>
          )}
        </>
      )}
      <div className={heightPx ? 'h-full overflow-hidden rounded-xl' : ''}>
        {renderWidget(slot.type, applyWidgetFilters(widgetData, sanitizedConfig.filters), sanitizedConfig, dark, widgetMetrics,
          onConfigUpdate ? (newCfg) => onConfigUpdate(slot.id, newCfg) : undefined, widgetDateCol)}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   대시보드 템플릿 불러오기 모달
══════════════════════════════════════════ */
const TPL_TYPE_COLORS = {
  kpi:        { bg: 'bg-indigo-500', label: 'KPI' },
  line:       { bg: 'bg-emerald-500', label: '라인' },
  bar:        { bg: 'bg-amber-500', label: '바' },
  pie:        { bg: 'bg-rose-500', label: '파이' },
  table:      { bg: 'bg-sky-500', label: '테이블' },
  funnel:     { bg: 'bg-purple-500', label: '퍼널' },
  comparison: { bg: 'bg-cyan-500', label: '비교' },
  ranking:    { bg: 'bg-orange-500', label: '랭킹' },
  alert:      { bg: 'bg-red-500', label: '알림' },
  timeline:   { bg: 'bg-teal-500', label: '타임라인' },
}

function TplMiniPreview({ slotDefs, dark }) {
  const rows = []; let currentRow = [], rowWidth = 0
  slotDefs.forEach(def => {
    if (rowWidth + def.widthPct > 101) { rows.push(currentRow); currentRow = [def]; rowWidth = def.widthPct }
    else { currentRow.push(def); rowWidth += def.widthPct }
  })
  if (currentRow.length > 0) rows.push(currentRow)
  return (
    <div className={`rounded-lg p-2 flex flex-col gap-1 ${dark ? 'bg-[#0D0F18]' : 'bg-slate-50'}`}>
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-1">
          {row.map((def, ci) => {
            const tc = TPL_TYPE_COLORS[def.type] || TPL_TYPE_COLORS.kpi
            return (
              <div key={ci} style={{ width: `${def.widthPct}%` }}
                className={`${tc.bg} rounded-sm flex items-center justify-center ${def.type === 'kpi' ? 'h-5' : 'h-8'} opacity-80`}>
                <span className="text-white text-[7px] font-bold">{tc.label}</span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function TemplatePickerModal({ dark, onSelect, onClose }) {
  const [confirm, setConfirm] = useState(null)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`rounded-2xl border w-full max-w-2xl p-6 ${dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className={`font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>템플릿 불러오기</p>
            <p className={`text-xs mt-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>선택한 템플릿으로 현재 탭의 위젯을 교체합니다</p>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${dark ? 'text-slate-400 hover:bg-[#252836]' : 'text-slate-400 hover:bg-slate-100'}`}>
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {DASHBOARD_TEMPLATES.map(tpl => (
            <button key={tpl.id} onClick={() => setConfirm(tpl)}
              className={`p-4 rounded-xl border text-left transition-all
                ${confirm?.id === tpl.id ? 'border-indigo-500 bg-indigo-500/10'
                  : dark ? 'border-[#252836] hover:border-indigo-500/40' : 'border-slate-200 hover:border-indigo-300'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{tpl.icon}</span>
                <div>
                  <span className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{tpl.name}</span>
                  <p className={`text-[10px] mt-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{tpl.desc}</p>
                </div>
              </div>
              <TplMiniPreview slotDefs={tpl.slotDefs} dark={dark} />
            </button>
          ))}
        </div>
        {confirm && (
          <div className={`mt-4 flex items-center justify-between p-3 rounded-lg border
            ${dark ? 'border-amber-500/30 bg-amber-500/5' : 'border-amber-200 bg-amber-50'}`}>
            <p className={`text-xs ${dark ? 'text-amber-400' : 'text-amber-700'}`}>
              ⚠️ 현재 위젯이 "{confirm.name}" 템플릿으로 교체됩니다
            </p>
            <div className="flex gap-2 ml-3 shrink-0">
              <button onClick={() => setConfirm(null)}
                className={`text-xs px-3 py-1.5 rounded-lg border ${dark ? 'border-[#252836] text-slate-400 hover:text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                취소
              </button>
              <button onClick={() => { onSelect(confirm); onClose() }}
                className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                적용
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   L3 탭 바
══════════════════════════════════════════ */
function L3TabBar({ tabs, activeId, onSelect, onAdd, onRemove, onRename, onReorder, dark, rightSlot, addRef }) {
  const [addingTab, setAddingTab] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  useEffect(() => { if (addRef) addRef.current = () => { setAddingTab(true); setNewLabel('') } })
  const [renaming, setRenaming] = useState(null)
  const tabDragFrom = useRef(null); const tabDragTo = useRef(null)
  const [draggingTabId, setDraggingTabId] = useState(null)

  const onTabDragStart = (e, idx, tabId) => { tabDragFrom.current = idx; setDraggingTabId(tabId); e.dataTransfer.effectAllowed = 'move' }
  const onTabDragEnter = (e, idx) => { tabDragTo.current = idx; e.preventDefault() }
  const onTabDragOver = e => e.preventDefault()
  const onTabDragEnd = () => {
    const from = tabDragFrom.current, to = tabDragTo.current
    if (from !== null && to !== null && from !== to) onReorder?.(from, to)
    tabDragFrom.current = null; tabDragTo.current = null; setDraggingTabId(null)
  }

  const commitAdd = () => { if (!newLabel.trim()) { setAddingTab(false); return }; onAdd(newLabel.trim()); setAddingTab(false); setNewLabel('') }
  const commitRename = () => { if (!renaming) return; onRename(renaming.id, renaming.value.trim() || '탭'); setRenaming(null) }

  return (
    <div className={`flex items-stretch border-b shrink-0 ${dark ? 'border-[#252836]' : 'border-slate-200'}`}>
      <div className="flex items-center gap-0.5 px-5 pt-3 overflow-x-auto flex-1 min-w-0">
        {tabs.map((tab, tabIdx) => (
          <div key={tab.id} draggable onDragStart={e => onTabDragStart(e, tabIdx, tab.id)} onDragEnter={e => onTabDragEnter(e, tabIdx)}
            onDragOver={onTabDragOver} onDragEnd={onTabDragEnd}
            className={`relative group shrink-0 transition-opacity ${draggingTabId === tab.id ? 'opacity-30' : ''}`}>
            {renaming?.id === tab.id ? (
              <input autoFocus value={renaming.value}
                onChange={e => setRenaming(r => ({ ...r, value: e.target.value }))}
                onBlur={commitRename}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null) }}
                className={`text-xs px-3 py-2 rounded-t-lg outline-none w-24 border-b-2 border-indigo-500 ${dark ? 'bg-transparent text-white' : 'bg-transparent text-slate-800'}`} />
            ) : (
              <button onClick={() => onSelect(tab.id)}
                onDoubleClick={() => setRenaming({ id: tab.id, value: tab.label })}
                title="더블클릭으로 이름 변경"
                className={`text-xs px-4 py-2.5 rounded-t-lg border-b-2 font-medium transition-colors whitespace-nowrap cursor-grab active:cursor-grabbing
                  ${activeId === tab.id
                    ? dark ? 'border-indigo-500 text-white bg-[#1A1D27]' : 'border-indigo-500 text-indigo-600 bg-white'
                    : dark ? 'border-transparent text-slate-400 hover:text-white hover:bg-[#1A1D27]/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                {tab.label}
              </button>
            )}
            {tabs.length > 1 && (
              <button onClick={() => onRemove(tab.id)} title="탭 삭제"
                className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500/80 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] leading-none">×</button>
            )}
          </div>
        ))}

        {addingTab ? (
          <div className="flex items-center gap-1 pb-px ml-1 shrink-0">
            <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') { setAddingTab(false); setNewLabel('') } }}
              placeholder="탭 이름"
              className={`text-xs px-2.5 py-1.5 rounded-lg border outline-none w-24
                ${dark ? 'border-indigo-500 bg-transparent text-white placeholder:text-slate-500' : 'border-indigo-400 bg-transparent text-slate-800 placeholder:text-slate-400'}`} />
            <button onClick={commitAdd} className="text-xs px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">확인</button>
            <button onClick={() => { setAddingTab(false); setNewLabel('') }}
              className={`text-xs px-2 py-1.5 rounded-lg ${dark ? 'text-slate-400 hover:text-white' : 'text-slate-500'}`}>취소</button>
          </div>
        ) : (
          <button onClick={() => setAddingTab(true)}
            className={`shrink-0 flex items-center gap-1 text-xs px-3 py-2 ml-1 rounded-t-lg border border-dashed mb-px transition-colors
              ${dark ? 'border-[#2E3450] text-slate-400 hover:text-slate-200 hover:border-slate-400' : 'border-slate-300 text-slate-500 hover:text-slate-700 hover:border-slate-400'}`}>
            <Plus size={10} /> 탭 추가
          </button>
        )}
      </div>

      {rightSlot && (
        <div className={`flex items-center gap-2 px-4 shrink-0 border-l ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
          {rightSlot}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════
   상수 & 유틸
══════════════════════════════════════════ */
function spanToWidthPct(span) {
  const cols = parseInt((span || '').replace('col-span-', '')) || 2
  return Math.round((cols / 6) * 10000) / 100
}

function migrateSlot(s) {
  if (s.widthPct != null) return s
  const widthPct = s.span ? spanToWidthPct(s.span) : 33.33
  const result = { ...s, widthPct }
  delete result.span
  if (s.rowsOverride && !s.heightPx) {
    result.heightPx = s.rowsOverride * (1 + MGAP) - MGAP
    delete result.rowsOverride
  }
  return result
}

function normalizeDashboard(d) {
  if (!d) return { slots: [] }
  if (Array.isArray(d.slots)) return { ...d, slots: d.slots.map(migrateSlot) }
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
   위젯 그리드 (탭별 분리 렌더 + dnd-kit)
══════════════════════════════════════════ */
function DashboardGrid({ tabId, dashboard, setDashboard, dataMap, defaultTable, filterByDate, dark, editMode, columnConfig, availableTables }) {
  const [editSlot, setEditSlot] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const gridRef = useRef(null)

  useEffect(() => { setEditSlot(null); setShowAdd(false) }, [tabId])
  useEffect(() => { if (!editMode) { setEditSlot(null); setShowAdd(false) } }, [editMode])

  const norm = useMemo(() => normalizeDashboard(dashboard), [dashboard])
  const slots = norm.slots || []

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleAddSlot = (_, widget) => {
    setDashboard({ ...norm, slots: [...slots, widget] })
    setShowAdd(false)
  }
  const handleDeleteSlot = (id) => setDashboard({ ...norm, slots: slots.filter(s => s.id !== id) })
  const handleWidthChange = (id, widthPct) => setDashboard({ ...norm, slots: slots.map(s => s.id === id ? { ...s, widthPct } : s) })
  const handleHeightChange = (id, heightPx) => setDashboard({ ...norm, slots: slots.map(s => s.id === id ? { ...s, heightPx: heightPx ?? undefined } : s) })

  const handleWidgetSave = (slotId, widget) => {
    setDashboard({ ...norm, slots: slots.map(s => s.id === slotId ? { ...s, ...widget } : s) })
    setEditSlot(null)
  }

  const handleConfigUpdate = useCallback((slotId, newConfig) => {
    setDashboard(prev => {
      const n = normalizeDashboard(prev)
      return { ...n, slots: (n.slots || []).map(s => s.id === slotId ? { ...s, config: newConfig } : s) }
    })
  }, [])

  const handleDragStart = ({ active }) => setActiveId(active.id)
  const handleDragEnd = ({ active, over }) => {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIdx = slots.findIndex(s => s.id === active.id)
    const newIdx = slots.findIndex(s => s.id === over.id)
    setDashboard({ ...norm, slots: arrayMove(slots, oldIdx, newIdx) })
  }

  const activeSlot = activeId ? slots.find(s => s.id === activeId) : null
  const editingSlot = editSlot ? slots.find(s => s.id === editSlot) : null

  return (
    <div className="flex flex-col gap-3">
      {slots.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-20 gap-5 rounded-2xl border-2 border-dashed
          ${dark ? 'border-[#252836] text-slate-500' : 'border-slate-200 text-slate-400'}`}>
          <span className="text-5xl">📊</span>
          <div className="text-center">
            <p className={`text-sm font-semibold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>아직 카드가 없습니다</p>
            <p className="text-xs mt-1.5">카드를 추가해 원하는 지표를 시각화해보세요</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 text-xs px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold">
            <Plus size={13} /> 첫 번째 카드 추가
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <SortableContext items={slots.map(s => s.id)} strategy={rectSortingStrategy}>
            <div ref={gridRef} className="flex flex-wrap gap-3 items-start">
              {slots.map(slot => (
                <SortableCard key={slot.id} slot={slot} editMode={editMode}
                  onEdit={setEditSlot} onDelete={handleDeleteSlot}
                  onWidthChange={handleWidthChange} onHeightChange={handleHeightChange}
                  onConfigUpdate={handleConfigUpdate}
                  dataMap={dataMap} defaultTable={defaultTable} filterByDate={filterByDate}
                  columnConfig={columnConfig} dark={dark} gridRef={gridRef} />
              ))}
              {editMode && (
                <div onClick={() => setShowAdd(true)}
                  style={{ width: pctToWidth(16.67), minHeight: 100 }}
                  className={`rounded-xl border-2 border-dashed cursor-pointer shrink-0 flex flex-col items-center justify-center gap-1.5 transition-colors select-none
                    ${dark ? 'border-[#252836] text-slate-400 hover:border-indigo-500/50 hover:text-indigo-400 hover:bg-indigo-500/5'
                      : 'border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50'}`}>
                  <Plus size={16} />
                  <span className="text-[10px] font-semibold">카드 추가</span>
                </div>
              )}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeSlot && (() => {
              const t = activeSlot.table || activeSlot.config?._table || defaultTable
              const raw = dataMap[t] || dataMap[defaultTable] || []
              const d = filterByDate ? filterByDate(raw, columnConfig?.[t]?.dateColumn) : raw
              const processed = applyComputedColumns(d, t, columnConfig)
              const m = buildTableMetrics(t, columnConfig)
              const sCfg = sanitizeWidgetConfig(activeSlot.type, activeSlot.config, t, columnConfig)
              return (
                <div className="rounded-xl border-2 border-indigo-500 opacity-90 shadow-2xl"
                  style={{ width: pctToWidth(activeSlot.widthPct ?? 33.33), ...(activeSlot.type !== 'kpi' && { minHeight: 210 }) }}>
                  {renderWidget(activeSlot.type, applyWidgetFilters(processed, sCfg.filters), sCfg, dark, m, null, columnConfig?.[t]?.dateColumn)}
                </div>
              )
            })()}
          </DragOverlay>
        </DndContext>
      )}

      {/* 카드 추가 모달 */}
      {showAdd && (() => {
        const addData = applyComputedColumns(dataMap[defaultTable] || [], defaultTable, columnConfig)
        return (
          <WidgetEditor
            widget={{ type: 'kpi', table: defaultTable, config: { ...DEFAULT_WIDGET_CONFIG.kpi } }}
            data={addData}
            dark={dark}
            onSave={handleAddSlot}
            onClose={() => setShowAdd(false)}
            columnConfig={columnConfig}
            availableTables={availableTables}
          />
        )
      })()}

      {/* 위젯 편집 모달 */}
      {editingSlot && (() => {
        const t = editingSlot.table || editingSlot.config?._table || defaultTable
        const raw = dataMap[t] || dataMap[defaultTable] || []
        const d = filterByDate ? filterByDate(raw, columnConfig?.[t]?.dateColumn) : raw
        const processed = applyComputedColumns(d, t, columnConfig)
        return (
          <WidgetEditor
            slotId={editingSlot.id}
            widget={{ type: editingSlot.type, table: editingSlot.table, config: editingSlot.config }}
            data={processed}
            dark={dark}
            onSave={handleWidgetSave}
            onClose={() => setEditSlot(null)}
            columnConfig={columnConfig}
            availableTables={availableTables}
          />
        )
      })()}
    </div>
  )
}

/* ══════════════════════════════════════════
   메인 컴포넌트
══════════════════════════════════════════ */
export default function CustomDashboard({ dark, filterByDate, tabsConfig, subDataSource }) {
  const { config } = useConfig()
  const { columnConfig } = useColumnConfig()
  const tabs = tabsConfig?.tabs || []

  const [activeTabId, setActiveTabId] = useState(() => tabs[0]?.id ?? null)
  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0] ?? null

  const [dashboard, setDashboard] = useState(() => {
    if (!activeTab) return makeDashboard()
    return tabsConfig?.getDashboard(activeTab.id) ?? makeDashboard()
  })
  const [saved, setSaved] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const tabBarAddRef = useRef(null)

  useEffect(() => {
    if (!activeTab) return
    const d = tabsConfig?.getDashboard(activeTab.id) ?? makeDashboard()
    setDashboard(d)
    setSaved(false)
    setEditMode(false)
  }, [activeTab?.id])

  const defaultTable = subDataSource?.table || 'marketing_data'

  const neededTables = useMemo(() => {
    const norm = normalizeDashboard(dashboard)
    const tables = new Set()
    tables.add(defaultTable)
    ;(norm.slots || []).forEach(s => {
      const t = s.table || s.config?._table
      if (t) tables.add(t)
    })
    return [...tables]
  }, [dashboard, defaultTable])

  const { dataMap: rawDataMap, loading, errors } = useMultiTableData(neededTables)
  const errorMsg = Object.entries(errors).map(([t, e]) => `${t}: ${e}`).join(', ')

  const availableTables = useMemo(() => {
    const seen = new Set(); const tables = []
    DB_TABLES.forEach(t => {
      seen.add(t)
      const tCfg = columnConfig?.[t]
      const colCount = tCfg?.columns ? Object.keys(tCfg.columns).length : 0
      const displayName = getTableDisplayName(t, columnConfig)
      tables.push({ id: t, label: displayName + (colCount ? ` · ${colCount}컬럼` : ''), displayName, icon: t === 'marketing_data' ? '📊' : '🏨' })
    })
    if (columnConfig) {
      Object.keys(columnConfig).forEach(t => {
        if (seen.has(t)) return; seen.add(t)
        const tCfg = columnConfig[t]
        const colCount = tCfg?.columns ? Object.keys(tCfg.columns).length : 0
        const displayName = getTableDisplayName(t, columnConfig)
        tables.push({ id: t, label: displayName + (colCount ? ` · ${colCount}컬럼` : ''), displayName, icon: '🏨' })
      })
    }
    return tables
  }, [columnConfig])

  const handleAddTab = (label) => tabsConfig?.addTab(label)
  const handleRemoveTab = (tabId) => {
    tabsConfig?.removeTab(tabId)
    if (activeTabId === tabId) {
      const remaining = tabs.filter(t => t.id !== tabId)
      setActiveTabId(remaining[0]?.id ?? null)
    }
  }

  const handleSave = () => {
    if (activeTab) tabsConfig?.saveDashboard(normalizeDashboard(dashboard), activeTab.id)
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <Spinner dark={dark} />

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

      <L3TabBar
        tabs={tabs} activeId={activeTab?.id} onSelect={setActiveTabId}
        onAdd={handleAddTab} onRemove={handleRemoveTab}
        onRename={(tabId, label) => tabsConfig?.renameTab(tabId, label)}
        onReorder={(from, to) => tabsConfig?.reorderTabs?.(from, to)}
        dark={dark} addRef={tabBarAddRef}
        rightSlot={activeTab ? (
          editMode ? (
            <>
              <button onClick={() => { setEditMode(false) }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors
                  ${dark ? 'border-[#252836] text-slate-400 hover:text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                취소
              </button>
              <button onClick={() => { handleSave(); setEditMode(false) }}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors
                  ${saved ? 'bg-emerald-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                <Check size={12} /> {saved ? '저장됨' : '저장'}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setShowTemplatePicker(true)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors
                  ${dark ? 'border-[#252836] text-slate-400 hover:text-white hover:bg-[#1A1D27]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <LayoutTemplate size={12} /> 템플릿 불러오기
              </button>
              <button onClick={() => setEditMode(true)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors
                  ${dark ? 'border-[#252836] text-slate-400 hover:text-white hover:bg-[#1A1D27]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <Settings2 size={12} /> 대시보드 편집
              </button>
            </>
          )
        ) : null}
      />

      {showTemplatePicker && (
        <TemplatePickerModal dark={dark} onClose={() => setShowTemplatePicker(false)}
          onSelect={(tpl) => {
            const newDash = generateDashboard(tpl, defaultTable, columnConfig)
            setDashboard(newDash)
            if (activeTab) tabsConfig?.saveDashboard(newDash, activeTab.id)
            setSaved(true); setTimeout(() => setSaved(false), 2000)
          }}
        />
      )}

      {activeTab ? (
        <div className="p-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className={`mb-4 px-4 py-2.5 rounded-lg text-xs border
              ${dark ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
              ⚠️ 데이터 조회 오류: {errorMsg}
            </div>
          )}
          <DashboardGrid
            key={activeTab.id} tabId={activeTab.id}
            dashboard={dashboard} setDashboard={setDashboard}
            dataMap={rawDataMap} defaultTable={defaultTable}
            filterByDate={filterByDate} dark={dark} editMode={editMode}
            columnConfig={columnConfig} availableTables={availableTables}
          />
        </div>
      ) : (
        <button onClick={() => tabBarAddRef.current?.()}
          className={`flex flex-col items-center justify-center flex-1 gap-5 w-full transition-colors group
            ${dark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-colors
            ${dark ? 'bg-[#1A1D27] group-hover:bg-indigo-600/20' : 'bg-slate-50 group-hover:bg-indigo-50'}`}>
            <Plus size={32} className="text-indigo-400 group-hover:text-indigo-500" />
          </div>
          <div className="text-center">
            <p className={`text-sm font-semibold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>탭이 없습니다</p>
            <p className="text-xs mt-1.5 text-indigo-400 group-hover:text-indigo-300 font-medium">+ 여기를 클릭해서 첫 번째 탭을 만들어보세요</p>
          </div>
        </button>
      )}
    </div>
  )
}
