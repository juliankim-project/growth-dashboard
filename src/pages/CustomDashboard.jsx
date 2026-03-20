import { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense, memo } from 'react'
import { Settings2, Check, X, Plus, GripVertical, LayoutTemplate, Code2, Save, Trash2, Copy, ClipboardPaste, ChevronDown, Columns3 } from 'lucide-react'
import {
  TEMPLATES, WIDGET_TYPES,
  makeDashboard, DEFAULT_WIDGET_CONFIG,
  useConfig,
} from '../store/useConfig'
import { useColumnConfig } from '../store/useColumnConfig'
import { TABLES as DB_TABLES, applyComputedColumns, buildTableMetrics, buildTableGroupBy, buildWidgetMetrics, buildWidgetGroupBy, getTableDisplayName, getColumnLabel, sanitizeWidgetConfig } from '../store/columnUtils'
import { DASHBOARD_TEMPLATES, generateDashboard, dashboardToTemplate } from '../store/dashboardTemplates'
import { useMultiTableData } from '../hooks/useTableData'
import Spinner from '../components/UI/Spinner'
import ErrorBoundary from '../components/UI/ErrorBoundary'

/* ── Lazy-loaded 위젯 & 에디터 (초기 번들 사이즈 축소) ── */
const WidgetEditor = lazy(() => import('../components/editor/WidgetEditor'))
const KPIWidget = lazy(() => import('../components/widgets/KPIWidget'))
const LineWidget = lazy(() => import('../components/widgets/LineWidget'))
const BarWidget = lazy(() => import('../components/widgets/BarWidget'))
const PieWidget = lazy(() => import('../components/widgets/PieWidget'))
const TableWidget = lazy(() => import('../components/widgets/TableWidget'))
const FunnelWidget = lazy(() => import('../components/widgets/FunnelWidget'))
const ComparisonWidget = lazy(() => import('../components/widgets/ComparisonWidget'))
const RankingWidget = lazy(() => import('../components/widgets/RankingWidget'))
const AlertWidget = lazy(() => import('../components/widgets/AlertWidget'))
const TimelineWidget = lazy(() => import('../components/widgets/TimelineWidget'))
const KanbanBoard = lazy(() => import('../components/pages/KanbanBoard'))

import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

/* ── 툴바 드롭다운 ── */
function ToolbarDropdown({ label, icon, items, dark }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border transition-colors
          ${open
            ? 'bg-[#0C66E4] text-white border-[#0C66E4]'
            : dark ? 'border-[#A1BDD914] text-slate-400 hover:text-white hover:bg-[#22272B]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
        {icon} {label}
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute right-0 top-[calc(100%+4px)] z-50 min-w-[140px] py-1 rounded-lg border shadow-lg
          ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200'}`}>
          {items.map(item => (
            <button key={item.label}
              onClick={() => { item.onClick(); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors text-left
                ${dark ? 'text-slate-300 hover:bg-[#2C333A] hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`}>
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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
   칸반 위젯 래퍼 — KanbanBoard를 그리드 슬롯 안에서 사용
══════════════════════════════════════════ */
function KanbanWidget({ config, dark, onConfigUpdate }) {
  const kanbanData = useMemo(() => ({ columns: config.columns || [] }), [config.columns])
  const setKanbanData = useCallback((newData) => {
    if (onConfigUpdate) onConfigUpdate({ ...config, columns: newData.columns })
  }, [config, onConfigUpdate])

  return <KanbanBoard dashboard={kanbanData} setDashboard={setKanbanData} dark={dark} />
}

/* ══════════════════════════════════════════
   위젯 매핑 & 렌더링
══════════════════════════════════════════ */
const WIDGET_MAP = {
  kpi: KPIWidget, line: LineWidget, bar: BarWidget,
  pie: PieWidget, table: TableWidget, funnel: FunnelWidget,
  comparison: ComparisonWidget, ranking: RankingWidget,
  alert: AlertWidget, timeline: TimelineWidget,
  kanban: KanbanWidget,
}

const renderWidget = (type, data, cfg, dark, metrics, onConfigUpdate, dateColumn, dateRange) => {
  const C = WIDGET_MAP[type]
  if (!C) return null
  return (
    <ErrorBoundary dark={dark} label={type}>
      <Suspense fallback={<div className="flex items-center justify-center h-full"><Spinner dark={dark} /></div>}>
        <C data={data} config={cfg} dark={dark} metrics={metrics}
          dateColumn={dateColumn} dateRange={dateRange} onConfigUpdate={onConfigUpdate} />
      </Suspense>
    </ErrorBoundary>
  )
}

/* ══════════════════════════════════════════
   그리드 카드 (react-grid-layout용)
══════════════════════════════════════════ */
const RGL_COLS = 24
const RGL_ROW_H = 32

/* 위젯 타입별 최소 / 기본 크기 (24칸 그리드, 32px 행높이 기준)
   minW/minH = 이보다 작게 못 줄임, defW/defH = 새 위젯 추가 시 기본 크기
   32px 행높이 → minH 2 = 64px, minH 3 = 96px */
const WIDGET_SIZES = {
  kpi:        { minW: 3,  minH: 2,  defW: 4,  defH: 3  },   // 최소 ~12.5% 폭, 더 컴팩트한 기본 크기
  line:       { minW: 4,  minH: 4,  defW: 12, defH: 8  },
  bar:        { minW: 4,  minH: 4,  defW: 12, defH: 8  },
  pie:        { minW: 4,  minH: 4,  defW: 10, defH: 8  },
  table:      { minW: 4,  minH: 3,  defW: 12, defH: 8  },
  funnel:     { minW: 4,  minH: 4,  defW: 12, defH: 8  },
  comparison: { minW: 4,  minH: 3,  defW: 12, defH: 8  },
  ranking:    { minW: 3,  minH: 3,  defW: 10, defH: 8  },
  alert:      { minW: 4,  minH: 3,  defW: 12, defH: 8  },
  timeline:   { minW: 4,  minH: 4,  defW: 12, defH: 8  },
  kanban:     { minW: 6,  minH: 5,  defW: 12, defH: 10 },
}
const DEFAULT_SIZE = { minW: 3, minH: 2, defW: 12, defH: 8 }

const GridCard = memo(function GridCard({ slot, editMode, onEdit, onDelete, onCopy, onSlotUpdate, dataMap, defaultTable, filterByDate, dateRange, columnConfig, dark, showSource }) {
  const widgetTable = slot.table || slot.config?._table || defaultTable
  const widgetRawData = dataMap[widgetTable] || dataMap[defaultTable] || []
  const widgetDateCol = columnConfig?.[widgetTable]?.dateColumn
  /* comparison 위젯은 current+previous 기간 모두 필요 → filterByDate 적용 안 함 */
  const isComparison = slot.type === 'comparison'

  // 최적화: widgetData 필터링은 이미 dataMap이 캐싱된 상태
  const widgetData = useMemo(() => {
    if (isComparison) return widgetRawData
    return filterByDate ? filterByDate(widgetRawData, widgetDateCol) : widgetRawData
  }, [widgetRawData, filterByDate, widgetDateCol, isComparison])

  // 최적화: buildTableMetrics는 columnUtils에서 Map 캐싱됨
  const widgetMetrics = useMemo(() => buildTableMetrics(widgetTable, columnConfig), [widgetTable, columnConfig])

  /* 칸반 등 자체 config 업데이트가 필요한 위젯용 콜백 */
  const handleConfigUpdate = useCallback((newConfig) => {
    if (onSlotUpdate) onSlotUpdate(slot.id, { config: newConfig })
  }, [onSlotUpdate, slot.id])

  const sanitizedConfig = useMemo(
    () => slot.type === 'kanban' ? (slot.config || {}) : sanitizeWidgetConfig(slot.type, slot.config, widgetTable, columnConfig),
    [slot.type, slot.config, widgetTable, columnConfig]
  )

  return (
    <div className="relative h-full overflow-hidden rounded-xl">
      {editMode && (
        <>
          {/* 드래그 핸들 */}
          <div className={`drag-handle absolute top-1 left-1/2 -translate-x-1/2 z-20 flex items-center px-2 py-0.5 rounded-full cursor-grab active:cursor-grabbing
            ${dark ? 'bg-[#1D2125]/90 text-slate-400 hover:text-slate-200 border border-[#A1BDD914]' : 'bg-white/90 text-slate-400 hover:text-slate-600 border border-slate-200 shadow-sm'}`}>
            <GripVertical size={11} />
          </div>
          {/* 삭제 */}
          <button onClick={() => onDelete(slot.id)}
            className="absolute top-1 right-1 z-20 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg flex items-center justify-center text-xs leading-none font-bold transition-transform hover:scale-110">×</button>
          {/* 복사 + 편집 */}
          <div className="absolute bottom-1.5 right-1.5 z-20 flex items-center gap-1">
            <button onClick={() => onCopy(slot.id)}
              className="flex items-center gap-1 px-2 py-0.5 bg-emerald-600 text-white text-[10px] rounded-lg hover:bg-emerald-700">
              <Copy size={9} /> 복사
            </button>
            <button onClick={() => onEdit(slot.id)}
              className="flex items-center gap-1 px-2 py-0.5 bg-[#0C66E4] text-white text-[10px] rounded-lg hover:bg-[#0055CC]">
              <Settings2 size={9} /> 편집
            </button>
          </div>
        </>
      )}
      <div className="h-full">
        {renderWidget(slot.type, applyWidgetFilters(widgetData, sanitizedConfig.filters), sanitizedConfig, dark, widgetMetrics,
          handleConfigUpdate, widgetDateCol, dateRange)}
      </div>
      {showSource && (() => {
        const cfg = sanitizedConfig
        const ml = (mid) => widgetMetrics.find(m => m.id === mid)?.label || mid
        return (
          <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-[2px] rounded-xl
            p-3 overflow-auto font-mono text-white/90 leading-relaxed pointer-events-none">
            <p className="text-[11px] font-bold text-[#85B8FF] mb-1.5 uppercase tracking-wider">{slot.type}</p>
            <div className="space-y-0.5 text-[11px]">
              <p><span className="text-slate-400">table:</span> {widgetTable}</p>
              {cfg.metric && <p><span className="text-slate-400">metric:</span> {ml(cfg.metric)}</p>}
              {cfg.metrics?.length > 0 && <p><span className="text-slate-400">metrics:</span> {cfg.metrics.map(ml).join(', ')}</p>}
              {cfg.groupBy && <p><span className="text-slate-400">groupBy:</span> {cfg.groupBy}</p>}
              {cfg.stages && <p><span className="text-slate-400">stages:</span> {cfg.stages.map(s => ml(s.metric)).join(' → ')}</p>}
              {cfg.topN && <p><span className="text-slate-400">topN:</span> {cfg.topN}</p>}
              {cfg.compareMode && <p><span className="text-slate-400">compare:</span> {cfg.compareMode}</p>}
              {cfg.axisMode === 'dual' && cfg.rightMetrics?.length > 0 && (
                <p><span className="text-slate-400">rightY:</span> {cfg.rightMetrics.map(ml).join(', ')}</p>
              )}
              {cfg.filters && Object.entries(cfg.filters).filter(([k, v]) => k !== 'table' && Array.isArray(v) && v.length > 0).length > 0 && (
                <>
                  <p className="text-[#85B8FF] font-bold mt-1">filters:</p>
                  {Object.entries(cfg.filters).filter(([k, v]) => k !== 'table' && Array.isArray(v) && v.length > 0).map(([k, v]) => (
                    <p key={k}><span className="text-slate-400">{k}:</span> {v.join(', ')}</p>
                  ))}
                </>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
})

/* ══════════════════════════════════════════
   대시보드 템플릿 불러오기 모달
══════════════════════════════════════════ */
const TPL_TYPE_COLORS = {
  kpi:        { bg: 'bg-[#E9F2FF]0', label: 'KPI' },
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

function TemplatePickerModal({ dark, onSelect, onClose, customTemplates = [], onDeleteCustom }) {
  const [confirm, setConfirm] = useState(null)
  const [tab, setTab] = useState('default') // 'default' | 'custom'
  const templates = tab === 'default' ? DASHBOARD_TEMPLATES : customTemplates

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`rounded-2xl border w-full max-w-5xl max-h-[85vh] flex flex-col p-6
          ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <p className={`font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>템플릿 불러오기</p>
            <p className={`text-xs mt-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>선택한 템플릿으로 현재 탭의 위젯을 교체합니다</p>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${dark ? 'text-slate-400 hover:bg-[#2C333A]' : 'text-slate-400 hover:bg-slate-100'}`}>
            <X size={16} />
          </button>
        </div>

        {/* 기본 / 커스텀 탭 */}
        <div className={`flex gap-1 mb-4 shrink-0 p-1 rounded-lg ${dark ? 'bg-[#0D0F18]' : 'bg-slate-100'}`}>
          {[{ id: 'default', label: '기본 템플릿', count: DASHBOARD_TEMPLATES.length },
            { id: 'custom', label: '커스텀 템플릿', count: customTemplates.length }].map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setConfirm(null) }}
              className={`flex-1 text-xs py-2 rounded-md font-semibold transition-colors
                ${tab === t.id
                  ? dark ? 'bg-[#22272B] text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm'
                  : dark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
              {t.label} <span className={`ml-1 ${tab === t.id ? 'text-[#579DFF]' : dark ? 'text-slate-600' : 'text-slate-400'}`}>({t.count})</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 overflow-y-auto flex-1 min-h-0">
          {templates.length === 0 ? (
            <div className={`col-span-3 flex flex-col items-center justify-center py-16 gap-3 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
              <span className="text-4xl">📁</span>
              <p className="text-sm">저장된 커스텀 템플릿이 없습니다</p>
              <p className="text-xs">대시보드를 꾸민 후 "템플릿 저장" 버튼으로 저장해보세요</p>
            </div>
          ) : templates.map(tpl => (
            <div key={tpl.id} className={`relative group p-4 rounded-xl border text-left transition-all self-start cursor-pointer
              ${confirm?.id === tpl.id ? 'border-[#579DFF] bg-[#579DFF]/10'
                : dark ? 'border-[#A1BDD914] hover:border-[#579DFF]/40' : 'border-slate-200 hover:border-[#85B8FF]'}`}
              onClick={() => setConfirm(tpl)}>
              {tab === 'custom' && onDeleteCustom && (
                <button onClick={e => { e.stopPropagation(); onDeleteCustom(tpl.id); if (confirm?.id === tpl.id) setConfirm(null) }}
                  className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-red-500/80 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  title="템플릿 삭제">
                  <Trash2 size={10} />
                </button>
              )}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{tpl.icon}</span>
                <div>
                  <span className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{tpl.name}</span>
                  {tpl.desc && <p className={`text-[10px] mt-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{tpl.desc}</p>}
                </div>
              </div>
              <TplMiniPreview slotDefs={tpl.slotDefs} dark={dark} />
            </div>
          ))}
        </div>

        {confirm && (
          <div className={`mt-4 flex items-center justify-between p-3 rounded-lg border shrink-0
            ${dark ? 'border-amber-500/30 bg-amber-500/5' : 'border-amber-200 bg-amber-50'}`}>
            <p className={`text-xs ${dark ? 'text-amber-400' : 'text-amber-700'}`}>
              ⚠️ 현재 위젯이 "{confirm.name}" 템플릿으로 교체됩니다
            </p>
            <div className="flex gap-2 ml-3 shrink-0">
              <button onClick={() => setConfirm(null)}
                className={`text-xs px-3 py-1.5 rounded-lg border ${dark ? 'border-[#A1BDD914] text-slate-400 hover:text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                취소
              </button>
              <button onClick={() => { onSelect(confirm); onClose() }}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#0C66E4] hover:bg-[#0055CC] text-white font-semibold">
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
   템플릿 저장 모달
══════════════════════════════════════════ */
const ICON_PRESETS = ['📊','📋','📈','🏨','🔍','🚨','⏱️','📌','🎯','💡','🛒','📦']

function SaveTemplateModal({ dark, dashboard, onSave, onClose }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📌')
  const nameRef = useRef(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  const norm = normalizeDashboard(dashboard)
  const slotCount = norm.slots?.length || 0

  const handleSave = () => {
    const trimmed = name.trim()
    if (!trimmed || slotCount === 0) return
    const tpl = dashboardToTemplate(norm, trimmed, icon)
    onSave(tpl)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`rounded-2xl border w-full max-w-lg p-6
          ${dark ? 'bg-[#22272B] border-[#A1BDD914]' : 'bg-white border-slate-200 shadow-xl'}`}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className={`font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>커스텀 템플릿 저장</p>
            <p className={`text-xs mt-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>현재 대시보드 위젯 구성을 템플릿으로 저장합니다</p>
          </div>
          <button onClick={onClose} className={`p-1.5 rounded-lg ${dark ? 'text-slate-400 hover:bg-[#2C333A]' : 'text-slate-400 hover:bg-slate-100'}`}>
            <X size={16} />
          </button>
        </div>

        {/* 이름 입력 */}
        <div className="mb-4">
          <label className={`text-xs font-semibold block mb-1.5 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>템플릿 이름</label>
          <input ref={nameRef} value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.nativeEvent.isComposing) return; if (e.key === 'Enter') { e.preventDefault(); handleSave() } if (e.key === 'Escape') onClose() }}
            placeholder="예: OTA 야놀자 OVERVIEW"
            className={`w-full text-sm px-3 py-2.5 rounded-lg border outline-none transition-colors
              ${dark ? 'bg-[#0D0F18] border-[#A1BDD914] text-white placeholder:text-slate-600 focus:border-[#579DFF]'
                : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-[#0C66E4]'}`} />
        </div>

        {/* 아이콘 선택 */}
        <div className="mb-4">
          <label className={`text-xs font-semibold block mb-1.5 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>아이콘</label>
          <div className="flex flex-wrap gap-1.5">
            {ICON_PRESETS.map(ic => (
              <button key={ic} onClick={() => setIcon(ic)}
                className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center border transition-all
                  ${icon === ic
                    ? 'border-[#579DFF] bg-[#E9F2FF]0/15 scale-110'
                    : dark ? 'border-[#A1BDD914] hover:border-[#579DFF]/40' : 'border-slate-200 hover:border-[#85B8FF]'}`}>
                {ic}
              </button>
            ))}
          </div>
        </div>

        {/* 미리보기 */}
        {slotCount > 0 && (
          <div className="mb-5">
            <label className={`text-xs font-semibold block mb-1.5 ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
              레이아웃 미리보기 <span className={dark ? 'text-slate-500' : 'text-slate-400'}>({slotCount}개 위젯)</span>
            </label>
            <TplMiniPreview slotDefs={norm.slots.map(s => ({
              type: s.type,
              widthPct: s.layout?.w
                ? Math.round((s.layout.w / RGL_COLS) * 100)
                : (s.widthPct || 33.33),
              heightPx: s.layout?.h
                ? s.layout.h * RGL_ROW_H
                : (s.heightPx || (s.type === 'kpi' ? 160 : 240)),
            }))} dark={dark} />
          </div>
        )}

        {/* 액션 */}
        <div className="flex justify-end gap-2">
          <button onClick={onClose}
            className={`text-xs px-4 py-2 rounded-lg border ${dark ? 'border-[#A1BDD914] text-slate-400 hover:text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
            취소
          </button>
          <button onClick={handleSave}
            disabled={!name.trim() || slotCount === 0}
            className={`flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-semibold transition-colors
              ${!name.trim() || slotCount === 0
                ? 'bg-slate-500/50 text-slate-400 cursor-not-allowed'
                : 'bg-[#0C66E4] hover:bg-[#0055CC] text-white'}`}>
            <Save size={12} /> 저장
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   L3 탭 바
══════════════════════════════════════════ */
function L3TabBar({ tabs, activeId, onSelect, onAdd, onRemove, onRename, onReorder, dark, rightSlot, addRef }) {
  const [addingTab, setAddingTab] = useState(false)
  const addInputRef = useRef(null)
  useEffect(() => { if (addRef) addRef.current = () => setAddingTab(true) })
  const [renamingId, setRenamingId] = useState(null)
  const renameInputRef = useRef(null)
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

  const commitAdd = () => {
    const val = addInputRef.current?.value?.trim()
    if (!val) { setAddingTab(false); return }
    onAdd(val); setAddingTab(false)
  }
  const commitRename = () => {
    if (!renamingId) return
    const val = renameInputRef.current?.value?.trim() || '탭'
    onRename(renamingId, val); setRenamingId(null)
  }

  return (
    <div className={`flex items-stretch border-b shrink-0 ${dark ? 'border-[#A1BDD914]' : 'border-slate-200'}`}>
      <div className="flex items-center gap-0.5 px-6 pt-4 overflow-x-auto flex-1 min-w-0">
        {tabs.map((tab, tabIdx) => (
          <div key={tab.id} draggable onDragStart={e => onTabDragStart(e, tabIdx, tab.id)} onDragEnter={e => onTabDragEnter(e, tabIdx)}
            onDragOver={onTabDragOver} onDragEnd={onTabDragEnd}
            className={`relative group shrink-0 transition-opacity ${draggingTabId === tab.id ? 'opacity-30' : ''}`}>
            {renamingId === tab.id ? (
              <input autoFocus ref={renameInputRef}
                defaultValue={tab.label}
                onBlur={commitRename}
                onKeyDown={e => { if (e.nativeEvent.isComposing) return; if (e.key === 'Enter') { e.preventDefault(); commitRename() } if (e.key === 'Escape') setRenamingId(null) }}
                className={`text-xs px-3 py-2 rounded-t-lg outline-none w-24 border-b-2 border-[#579DFF] ${dark ? 'bg-transparent text-white' : 'bg-transparent text-slate-800'}`} />
            ) : (
              <button onClick={() => onSelect(tab.id)}
                onDoubleClick={() => setRenamingId(tab.id)}
                title="더블클릭으로 이름 변경"
                className={`text-sm px-5 py-3 rounded-t-lg border-b-2 font-medium transition-colors whitespace-nowrap cursor-grab active:cursor-grabbing
                  ${activeId === tab.id
                    ? dark ? 'border-[#579DFF] text-white bg-[#22272B]' : 'border-[#579DFF] text-[#0C66E4] bg-white'
                    : dark ? 'border-transparent text-slate-400 hover:text-white hover:bg-[#22272B]/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
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
            <input autoFocus ref={addInputRef}
              defaultValue=""
              onKeyDown={e => { if (e.nativeEvent.isComposing) return; if (e.key === 'Enter') { e.preventDefault(); commitAdd() } if (e.key === 'Escape') setAddingTab(false) }}
              placeholder="탭 이름"
              className={`text-xs px-2.5 py-1.5 rounded-lg border outline-none w-24
                ${dark ? 'border-[#579DFF] bg-transparent text-white placeholder:text-slate-500' : 'border-[#0C66E4] bg-transparent text-slate-800 placeholder:text-slate-400'}`} />
            <button onClick={commitAdd} className="text-xs px-2.5 py-1.5 bg-[#0C66E4] text-white rounded-lg hover:bg-[#0055CC]">확인</button>
            <button onClick={() => setAddingTab(false)}
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
        <div className={`flex items-center gap-2 px-4 shrink-0 border-l ${dark ? 'border-[#A1BDD914]' : 'border-slate-100'}`}>
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
/* 12칸→24칸 마이그레이션: 기존 layout의 값들을 2배로 확대 */
function migrateLayout12to24(layout, type) {
  if (!layout) return null
  /* _m24 플래그로 이미 변환 완료 여부 확인 */
  if (layout._m24) return layout
  const sz = WIDGET_SIZES[type] || DEFAULT_SIZE
  return {
    x: layout.x * 2,
    y: layout.y * 2,
    w: layout.w * 2,
    h: layout.h * 2,
    minW: sz.minW,
    minH: sz.minH,
    _m24: true,
  }
}

function migrateSlots(slots) {
  let x = 0, y = 0, rowMaxH = 0
  return slots.map(s => {
    s = preProcessSlot(s)
    /* 기존 layout이 있으면 12→24칸 마이그레이션 */
    if (s.layout) {
      const migrated = migrateLayout12to24(s.layout, s.type)
      return migrated !== s.layout ? { ...s, layout: migrated } : s
    }

    const sz = WIDGET_SIZES[s.type] || DEFAULT_SIZE
    const w = Math.max(sz.minW, Math.round((s.widthPct || 33.33) / 100 * RGL_COLS))
    const h = s.heightPx ? Math.max(sz.minH, Math.round(s.heightPx / RGL_ROW_H)) : sz.defH

    if (x + w > RGL_COLS) {
      x = 0
      y += rowMaxH
      rowMaxH = 0
    }

    const layout = { x, y, w, h, minW: sz.minW, minH: sz.minH, _m24: true }
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
function DashboardGrid({ tabId, dashboard, setDashboard, dataMap, defaultTable, filterByDate, dateRange, dark, editMode, columnConfig, availableTables, addRef, showSource }) {
  const [editSlot, setEditSlot] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [clipboard, setClipboard] = useState(null)  // 복사된 위젯 슬롯
  const { containerRef, width: containerWidth } = useContainerWidth()

  const pendingAdd = useRef(false)
  useEffect(() => { if (addRef) addRef.current = (opts) => {
    if (opts?.enterEdit) { pendingAdd.current = true }
    setShowAdd(true)
  }})
  useEffect(() => { setEditSlot(null); setShowAdd(false) }, [tabId])
  useEffect(() => {
    if (!editMode) { setEditSlot(null); setShowAdd(false); setClipboard(null) }
    else if (pendingAdd.current) { pendingAdd.current = false; setShowAdd(true) }
  }, [editMode])

  const norm = useMemo(() => normalizeDashboard(dashboard), [dashboard])
  const slots = norm.slots || []

  /* react-grid-layout 레이아웃 배열 */
  const layout = useMemo(() =>
    slots.map(s => {
      const sz = WIDGET_SIZES[s.type] || DEFAULT_SIZE
      return {
        i: s.id,
        x: s.layout?.x ?? 0,
        y: s.layout?.y ?? Infinity,
        w: s.layout?.w ?? sz.defW,
        h: s.layout?.h ?? sz.defH,
        minW: sz.minW,
        minH: sz.minH,
        static: !editMode,
      }
    })
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
          /* layout + widthPct/heightPx 동기화 — 리사이즈 결과가 저장에 반영됨 */
          const sz = WIDGET_SIZES[s.type] || DEFAULT_SIZE
          return {
            ...s,
            layout: { x: l.x, y: l.y, w: l.w, h: l.h, minW: sz.minW, minH: sz.minH, _m24: true },
            widthPct: Math.round((l.w / RGL_COLS) * 100 * 100) / 100,
            heightPx: l.h * RGL_ROW_H,
          }
        })
      }
    })
  }, [editMode])

  const handleAddSlot = useCallback((_, widget) => {
    const sz = WIDGET_SIZES[widget.type] || DEFAULT_SIZE
    const defaultLayout = {
      x: 0, y: Infinity,
      w: sz.defW, h: sz.defH,
      minW: sz.minW, minH: sz.minH, _m24: true,
    }
    setDashboard(prev => {
      const n = normalizeDashboard(prev)
      return { ...n, slots: [...(n.slots || []), { ...widget, layout: defaultLayout }] }
    })
    setShowAdd(false)
  }, [setDashboard])

  const handleDeleteSlot = useCallback((id) => {
    setDashboard(prev => {
      const n = normalizeDashboard(prev)
      return { ...n, slots: (n.slots || []).filter(s => s.id !== id) }
    })
  }, [setDashboard])

  const handleSlotUpdate = useCallback((id, patch) => {
    setDashboard(prev => {
      const n = normalizeDashboard(prev)
      return { ...n, slots: n.slots.map(s => s.id === id ? { ...s, ...patch } : s) }
    })
  }, [setDashboard])

  const handleCopySlot = useCallback((id) => {
    const src = slots.find(s => s.id === id)
    if (src) setClipboard(src)
  }, [slots])

  const handlePasteSlot = useCallback(() => {
    if (!clipboard) return
    const srcLayout = clipboard.layout || {}
    const clone = {
      ...clipboard,
      id: `w_${Date.now()}_paste`,
      config: { ...clipboard.config },
      layout: { ...srcLayout, x: 0, y: Infinity, minW: (WIDGET_SIZES[clipboard.type] || DEFAULT_SIZE).minW, minH: (WIDGET_SIZES[clipboard.type] || DEFAULT_SIZE).minH, _m24: true },
    }
    setDashboard(prev => {
      const n = normalizeDashboard(prev)
      return { ...n, slots: [clone, ...(n.slots || [])] }
    })
  }, [clipboard, setDashboard])

  const handleWidgetSave = useCallback((slotId, widget) => {
    setDashboard(prev => {
      const n = normalizeDashboard(prev)
      return { ...n, slots: n.slots.map(s => s.id === slotId ? { ...s, ...widget } : s) }
    })
    setEditSlot(null)
  }, [setDashboard])

  const editingSlot = editSlot ? slots.find(s => s.id === editSlot) : null

  return (
    <div className="flex flex-col gap-3">
      {slots.length === 0 ? (
        <div className={`flex flex-col items-center justify-center py-20 gap-5 rounded-2xl border-2 border-dashed
          ${dark ? 'border-[#A1BDD914] text-slate-500' : 'border-slate-200 text-slate-400'}`}>
          <span className="text-6xl">📊</span>
          <div className="text-center">
            <p className={`text-base font-semibold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>아직 카드가 없습니다</p>
            <p className="text-sm mt-1.5">카드를 추가해 원하는 지표를 시각화해보세요</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 text-xs px-5 py-2.5 bg-[#0C66E4] text-white rounded-xl hover:bg-[#0055CC] font-semibold">
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
              cols={{ lg: 24, md: 20, sm: 12, xs: 8 }}
              rowHeight={RGL_ROW_H}
              isDraggable={editMode}
              isResizable={editMode}
              compactType="vertical"
              onLayoutChange={handleLayoutChange}
              draggableHandle=".drag-handle"
              margin={[10, 10]}
            >
              {slots.map(slot => (
                <div key={slot.id}>
                  <GridCard slot={slot} editMode={editMode}
                    onEdit={setEditSlot} onDelete={handleDeleteSlot} onCopy={handleCopySlot}
                    onSlotUpdate={handleSlotUpdate}
                    dataMap={dataMap} defaultTable={defaultTable} filterByDate={filterByDate}
                    dateRange={dateRange} columnConfig={columnConfig} dark={dark} showSource={showSource} />
                </div>
              ))}
            </ResponsiveGridLayout>
          )}
        </div>
      )}

      {/* 클립보드 토스트 (화면 상단 고정) */}
      {editMode && clipboard && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-[slideDown_0.2s_ease-out]">
          <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border shadow-lg backdrop-blur-sm
            ${dark ? 'border-emerald-500/40 bg-[#22272B]/95 shadow-emerald-500/10' : 'border-emerald-300 bg-white/95 shadow-emerald-100'}`}>
            <p className={`text-xs ${dark ? 'text-emerald-400' : 'text-emerald-700'}`}>
              📋 <span className="font-semibold">{clipboard.type.toUpperCase()}</span> 위젯이 복사되었습니다
            </p>
            <button onClick={() => setClipboard(null)}
              className={`text-xs px-2.5 py-1 rounded-lg ${dark ? 'text-slate-400 hover:text-white hover:bg-[#2C333A]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
              취소
            </button>
            <button onClick={handlePasteSlot}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
              <ClipboardPaste size={12} /> 붙여넣기
            </button>
          </div>
        </div>
      )}

      {/* 카드 추가 버튼 (그리드 하단) */}
      {editMode && slots.length > 0 && (
        <button onClick={() => setShowAdd(true)}
          className={`w-full h-24 rounded-xl border-2 border-dashed cursor-pointer flex items-center justify-center gap-2 transition-colors select-none
            ${dark ? 'border-[#A1BDD914] text-slate-400 hover:border-[#579DFF]/50 hover:text-[#579DFF] hover:bg-[#E9F2FF]0/5'
              : 'border-slate-200 text-slate-500 hover:border-[#85B8FF] hover:text-[#579DFF] hover:bg-[#E9F2FF]/50'}`}>
          <Plus size={16} />
          <span className="text-xs font-semibold">카드 추가</span>
        </button>
      )}

      {/* 카드 추가 모달 */}
      {showAdd && (
        <Suspense fallback={<Spinner dark={dark} />}>
          <WidgetEditor
            widget={{ type: 'kpi', table: defaultTable, config: { ...DEFAULT_WIDGET_CONFIG.kpi } }}
            data={dataMap[defaultTable] || []}
            dataMap={dataMap}
            dark={dark}
            onSave={handleAddSlot}
            onClose={() => setShowAdd(false)}
            columnConfig={columnConfig}
            availableTables={availableTables}
          />
        </Suspense>
      )}

      {/* 위젯 편집 모달 */}
      {editingSlot && (() => {
        const t = editingSlot.table || editingSlot.config?._table || defaultTable
        const raw = dataMap[t] || dataMap[defaultTable] || []
        const processed = filterByDate ? filterByDate(raw, columnConfig?.[t]?.dateColumn) : raw
        return (
          <Suspense fallback={<Spinner dark={dark} />}>
            <WidgetEditor
              slotId={editingSlot.id}
              widget={{ type: editingSlot.type, table: editingSlot.table, config: editingSlot.config }}
              data={processed}
              dataMap={dataMap}
              dark={dark}
              onSave={handleWidgetSave}
              onClose={() => setEditSlot(null)}
              columnConfig={columnConfig}
              availableTables={availableTables}
            />
          </Suspense>
        )
      })()}
    </div>
  )
}

/* ══════════════════════════════════════════
   메인 컴포넌트
══════════════════════════════════════════ */
export default function CustomDashboard({ dark, filterByDate, dateRange, tabsConfig, subDataSource }) {
  const { config, getCustomTemplates, saveCustomTemplate, deleteCustomTemplate } = useConfig()
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
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [showSource, setShowSource] = useState(false)
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



  /* 실제 사용 테이블만 fetch — 편집모드에서만 전체 테이블 로드 */
  const neededTables = useMemo(() => {
    const norm = normalizeDashboard(dashboard)
    const tables = new Set()
    tables.add(defaultTable)
    ;(norm.slots || []).forEach(s => {
      const t = s.table || s.config?._table
      if (t) tables.add(t)
    })
    if (editMode) {
      DB_TABLES.forEach(t => tables.add(t))
      if (columnConfig) Object.keys(columnConfig).forEach(t => tables.add(t))
    }
    return [...tables]
  }, [dashboard, defaultTable, editMode, columnConfig])

  const { dataMap: rawDataMap, loading, errors } = useMultiTableData(neededTables, dateRange, columnConfig)
  const errorMsg = Object.entries(errors).map(([t, e]) => `${t}: ${e}`).join(', ')

  /* 테이블 레벨 computed 캐싱 — 위젯별 중복 계산 방지 */
  const computedDataMap = useMemo(() => {
    const result = {}
    for (const [table, rows] of Object.entries(rawDataMap)) {
      result[table] = applyComputedColumns(rows, table, columnConfig)
    }
    return result
  }, [rawDataMap, columnConfig])

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
                className={`text-sm px-4 py-2 rounded-lg border transition-colors
                  ${dark ? 'border-[#A1BDD914] text-slate-400 hover:text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                취소
              </button>
              <button onClick={() => { handleSave(); setEditMode(false) }}
                className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-semibold transition-colors
                  ${saved ? 'bg-emerald-500 text-white' : 'bg-[#0C66E4] hover:bg-[#0055CC] text-white'}`}>
                <Check size={12} /> {saved ? '저장됨' : '저장'}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setShowSource(s => !s)}
                className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border transition-colors
                  ${showSource
                    ? 'bg-[#0C66E4] text-white border-[#0C66E4]'
                    : dark ? 'border-[#A1BDD914] text-slate-400 hover:text-white hover:bg-[#22272B]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <Code2 size={12} /> 소스
              </button>
              <ToolbarDropdown label="카드 추가" icon={<Plus size={12} />} dark={dark}
                items={[
                  { label: '위젯 추가', icon: <Plus size={12} />,
                    onClick: () => { gridAddRef.current?.({ enterEdit: true }); setEditMode(true) } },
                  { label: '칸반 추가', icon: <Columns3 size={12} />,
                    onClick: () => {
                      const norm = normalizeDashboard(dashboard)
                      const slots = norm.slots || []
                      const kanbanH = 5
                      const kid = `w_kanban_${Date.now()}`
                      /* 기존 위젯들을 칸반 높이만큼 아래로 밀기 */
                      const shiftedSlots = slots.map(s => ({
                        ...s,
                        layout: { ...s.layout, y: (s.layout?.y ?? 0) + kanbanH }
                      }))
                      const kanbanSlot = {
                        id: kid, type: 'kanban', table: defaultTable,
                        config: { title: '칸반 보드', columns: [
                          { id: 'c_todo', title: '할 일', cards: [], width: 256 },
                          { id: 'c_progress', title: '진행 중', cards: [], width: 256 },
                          { id: 'c_done', title: '완료', cards: [], width: 256 },
                        ]},
                        layout: { i: kid, x: 0, y: 0, w: 12, h: 5, minW: 4, minH: 3 },
                      }
                      setDashboard({ ...norm, slots: [...shiftedSlots, kanbanSlot] })
                    } },
                ]}
              />
              <ToolbarDropdown label="템플릿" icon={<LayoutTemplate size={12} />} dark={dark}
                items={[
                  { label: '저장하기', icon: <Save size={12} />, onClick: () => setShowSaveTemplate(true) },
                  { label: '불러오기', icon: <LayoutTemplate size={12} />, onClick: () => setShowTemplatePicker(true) },
                ]}
              />
              <button onClick={() => setEditMode(true)}
                className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg border transition-colors
                  ${dark ? 'border-[#A1BDD914] text-slate-400 hover:text-white hover:bg-[#22272B]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <Settings2 size={12} /> 대시보드 편집
              </button>
            </>
          )
        ) : null}
      />

      {showTemplatePicker && (
        <TemplatePickerModal dark={dark} onClose={() => setShowTemplatePicker(false)}
          customTemplates={getCustomTemplates()}
          onDeleteCustom={(id) => deleteCustomTemplate(id)}
          onSelect={(tpl) => {
            const newDash = generateDashboard(tpl, defaultTable, columnConfig)
            setDashboard(newDash)
            if (activeTab) tabsConfig?.saveDashboard(newDash, activeTab.id)
            setSaved(true); setTimeout(() => setSaved(false), 2000)
          }}
        />
      )}

      {showSaveTemplate && (
        <SaveTemplateModal dark={dark} dashboard={dashboard}
          onClose={() => setShowSaveTemplate(false)}
          onSave={(tpl) => {
            saveCustomTemplate(tpl)
            setShowSaveTemplate(false)
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
            dataMap={computedDataMap} defaultTable={defaultTable}
            filterByDate={filterByDate} dateRange={dateRange} dark={dark} editMode={editMode}
            columnConfig={columnConfig} availableTables={availableTables}
            addRef={gridAddRef} showSource={showSource}
          />
        </div>
      ) : (
        <button onClick={() => tabBarAddRef.current?.()}
          className={`flex flex-col items-center justify-center flex-1 gap-5 w-full transition-colors group
            ${dark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
          <div className={`w-24 h-24 rounded-2xl flex items-center justify-center transition-colors
            ${dark ? 'bg-[#22272B] group-hover:bg-[#0C66E4]/20' : 'bg-slate-50 group-hover:bg-[#E9F2FF]'}`}>
            <Plus size={32} className="text-[#579DFF] group-hover:text-[#579DFF]" />
          </div>
          <div className="text-center">
            <p className={`text-base font-semibold ${dark ? 'text-slate-300' : 'text-slate-600'}`}>탭이 없습니다</p>
            <p className="text-sm mt-1.5 text-[#579DFF] group-hover:text-[#85B8FF] font-medium">+ 여기를 클릭해서 첫 번째 탭을 만들어보세요</p>
          </div>
        </button>
      )}
    </div>
  )
}
