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
import WidgetEditor from '../components/editor/WidgetEditor'
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
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

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
   그리드 카드 (react-grid-layout용)
══════════════════════════════════════════ */
const RGL_COLS = 12
const RGL_ROW_H = 80

function GridCard({ slot, editMode, onEdit, onDelete, dataMap, defaultTable, filterByDate, columnConfig, dark }) {
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

  return (
    <div className="relative h-full overflow-hidden rounded-xl">
      {editMode && (
        <>
          {/* 드래그 핸들 */}
          <div className={`drag-handle absolute top-1 left-1/2 -translate-x-1/2 z-20 flex items-center px-2 py-0.5 rounded-full cursor-grab active:cursor-grabbing
            ${dark ? 'bg-[#0F1117]/90 text-slate-400 hover:text-slate-200 border border-[#252836]' : 'bg-white/90 text-slate-400 hover:text-slate-600 border border-slate-200 shadow-sm'}`}>
            <GripVertical size={11} />
          </div>
          {/* 삭제 */}
          <button onClick={() => onDelete(slot.id)}
            className="absolute top-1 right-1 z-20 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg flex items-center justify-center text-xs leading-none font-bold transition-transform hover:scale-110">×</button>
          {/* 편집 */}
          <button onClick={() => onEdit(slot.id)}
            className="absolute bottom-1.5 right-1.5 z-20 flex items-center gap-1 px-2 py-0.5 bg-indigo-600 text-white text-[10px] rounded-lg hover:bg-indigo-700">
            <Settings2 size={9} /> 편집
          </button>
        </>
      )}
      <div className="h-full">
        {renderWidget(slot.type, applyWidgetFilters(widgetData, sanitizedConfig.filters), sanitizedConfig, dark, widgetMetrics,
          undefined, widgetDateCol)}
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
                onKeyDown={e => { if (e.nativeEvent.isComposing) return; if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null) }}
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
              onKeyDown={e => { if (e.nativeEvent.isComposing) return; if (e.key === 'Enter') commitAdd(); if (e.key === 'Escape') { setAddingTab(false); setNewLabel('') } }}
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
   상수 & 유틸 (마이그레이션)
══════════════════════════════════════════ */
function spanToWidthPct(span) {
  const cols = parseInt((span || '').replace('col-span-', '')) || 2
  return Math.round((cols / 6) * 10000) / 100
}

/* 단일 슬롯 전처리 (span/rowsOverride → widthPct/heightPx) */
function preProcessSlot(s) {
  if (!s.widthPct && s.span) {
    s = { ...s, widthPct: spanToWidthPct(s.span) }
    delete s.span
  }
  if (s.rowsOverride && !s.heightPx) {
    s = { ...s, heightPx: s.rowsOverride * 93 - 12 }
    delete s.rowsOverride
  }
  return s
}

/* layout 없는 슬롯들에 행 기반 x/y 자동 계산 */
function migrateSlots(slots) {
  let x = 0, y = 0, rowMaxH = 0
  return slots.map(s => {
    s = preProcessSlot(s)
    if (s.layout) return s

    const w = Math.max(1, Math.round((s.widthPct || 33.33) / 100 * RGL_COLS))
    const h = s.heightPx ? Math.max(1, Math.round(s.heightPx / RGL_ROW_H)) : (s.type === 'kpi' ? 2 : 3)

    if (x + w > RGL_COLS) {
      x = 0
      y += rowMaxH
      rowMaxH = 0
    }

    const layout = { x, y, w, h, minW: 1, minH: 1 }
    x += w
    rowMaxH = Math.max(rowMaxH, h)

    return { ...s, layout }
  })
}

function normalizeDashboard(d) {
  if (!d) return { slots: [] }
  if (Array.isArray(d.slots)) return { ...d, slots: migrateSlots(d.slots) }
  const tpl = TEMPLATES[d.template]
  if (!tpl) return { dataSource: d.dataSource, slots: [] }
  const rawSlots = tpl.slots.map(s => {
    const w = d.widgets?.[s.id]
    const type = w?.type || s.defaultType
    return {
      id: s.id,
      span: w?.config?.span || s.span,
      type,
      config: { ...(DEFAULT_WIDGET_CONFIG[type] || {}), ...(w?.config || {}) },
    }
  })
  return { dataSource: d.dataSource, slots: migrateSlots(rawSlots) }
}

/* ══════════════════════════════════════════
   위젯 그리드 (react-grid-layout)
══════════════════════════════════════════ */
function DashboardGrid({ tabId, dashboard, setDashboard, dataMap, defaultTable, filterByDate, dark, editMode, columnConfig, availableTables, addRef }) {
  const [editSlot, setEditSlot] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const { containerRef, width: containerWidth } = useContainerWidth()

  const pendingAdd = useRef(false)
  useEffect(() => { if (addRef) addRef.current = (opts) => {
    if (opts?.enterEdit) { pendingAdd.current = true }
    setShowAdd(true)
  }})
  useEffect(() => { setEditSlot(null); setShowAdd(false) }, [tabId])
  useEffect(() => {
    if (!editMode) { setEditSlot(null); setShowAdd(false) }
    else if (pendingAdd.current) { pendingAdd.current = false; setShowAdd(true) }
  }, [editMode])

  const norm = useMemo(() => normalizeDashboard(dashboard), [dashboard])
  const slots = norm.slots || []

  /* react-grid-layout 레이아웃 배열 */
  const layout = useMemo(() =>
    slots.map(s => ({
      i: s.id,
      x: s.layout?.x ?? 0,
      y: s.layout?.y ?? Infinity,
      w: s.layout?.w ?? 4,
      h: s.layout?.h ?? 3,
      minW: s.layout?.minW ?? 1,
      minH: s.layout?.minH ?? 1,
      static: !editMode,
    }))
  , [slots, editMode])

  const handleLayoutChange = useCallback((newLayout) => {
    if (!editMode) return
    const layoutMap = new Map(newLayout.map(l => [l.i, l]))
    setDashboard(prev => {
      const n = normalizeDashboard(prev)
      return {
        ...n,
        slots: (n.slots || []).map(s => {
          const l = layoutMap.get(s.id)
          if (!l) return s
          return { ...s, layout: { x: l.x, y: l.y, w: l.w, h: l.h, minW: l.minW ?? 1, minH: l.minH ?? 1 } }
        })
      }
    })
  }, [editMode])

  const handleAddSlot = (_, widget) => {
    const defaultLayout = {
      x: 0, y: Infinity,
      w: widget.type === 'kpi' ? 3 : 6,
      h: widget.type === 'kpi' ? 2 : 3,
      minW: 1, minH: 1,
    }
    setDashboard({ ...norm, slots: [...slots, { ...widget, layout: defaultLayout }] })
    setShowAdd(false)
  }
  const handleDeleteSlot = (id) => setDashboard({ ...norm, slots: slots.filter(s => s.id !== id) })

  const handleWidgetSave = (slotId, widget) => {
    setDashboard({ ...norm, slots: slots.map(s => s.id === slotId ? { ...s, ...widget } : s) })
    setEditSlot(null)
  }

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
        <div ref={containerRef}>
          {containerWidth > 0 && (
            <ResponsiveGridLayout
              className="layout"
              width={containerWidth}
              layouts={{ lg: layout }}
              breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
              cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
              rowHeight={RGL_ROW_H}
              isDraggable={editMode}
              isResizable={editMode}
              compactType="vertical"
              onLayoutChange={handleLayoutChange}
              draggableHandle=".drag-handle"
              margin={[12, 12]}
            >
              {slots.map(slot => (
                <div key={slot.id}>
                  <GridCard slot={slot} editMode={editMode}
                    onEdit={setEditSlot} onDelete={handleDeleteSlot}
                    dataMap={dataMap} defaultTable={defaultTable} filterByDate={filterByDate}
                    columnConfig={columnConfig} dark={dark} />
                </div>
              ))}
            </ResponsiveGridLayout>
          )}
        </div>
      )}

      {/* 카드 추가 버튼 (그리드 하단) */}
      {editMode && slots.length > 0 && (
        <button onClick={() => setShowAdd(true)}
          className={`w-full h-20 rounded-xl border-2 border-dashed cursor-pointer flex items-center justify-center gap-2 transition-colors select-none
            ${dark ? 'border-[#252836] text-slate-400 hover:border-indigo-500/50 hover:text-indigo-400 hover:bg-indigo-500/5'
              : 'border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50'}`}>
          <Plus size={16} />
          <span className="text-xs font-semibold">카드 추가</span>
        </button>
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
export default function CustomDashboard({ dark, filterByDate, dateRange, tabsConfig, subDataSource }) {
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
  const gridAddRef = useRef(null)

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

  const { dataMap: rawDataMap, loading, errors } = useMultiTableData(neededTables, dateRange, columnConfig)
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
              <button onClick={() => { gridAddRef.current?.({ enterEdit: true }); setEditMode(true) }}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors
                  ${dark ? 'border-[#252836] text-slate-400 hover:text-white hover:bg-[#1A1D27]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <Plus size={12} /> 카드 추가
              </button>
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
            addRef={gridAddRef}
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
