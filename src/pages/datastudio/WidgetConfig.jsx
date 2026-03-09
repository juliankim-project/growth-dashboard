import { useState, useMemo, useCallback } from 'react'
import { useColumnConfig } from '../../store/useColumnConfig'
import {
  buildTableMetrics, buildTableGroupBy,
  buildWidgetMetrics, buildWidgetGroupBy,
  getTableDisplayName,
} from '../../store/columnUtils'
import { TABLES } from './Tables'
import { Eye, EyeOff, GripVertical, Save, Check } from 'lucide-react'
import {
  DndContext, closestCenter,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable,
  verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/* ── 그룹 라벨/색상 (MetricPicker와 동일) ── */
const GROUP_LABELS = { metric: '지표', computed: '계산', rate: '파생' }
const GROUP_COLORS = {
  metric:   { dark: 'bg-indigo-500/15 text-indigo-400', light: 'bg-indigo-50 text-indigo-600' },
  computed: { dark: 'bg-violet-500/15 text-violet-400', light: 'bg-violet-50 text-violet-600' },
  rate:     { dark: 'bg-amber-500/15 text-amber-400',   light: 'bg-amber-50 text-amber-600' },
}

/* ═══════════ Sortable Card ═══════════ */
function SortableCard({ id, label, subLabel, group, visible, dark, onToggle }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const gc = GROUP_COLORS[group] || GROUP_COLORS.metric

  return (
    <div ref={setNodeRef} style={style}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors
        ${isDragging ? 'z-50 shadow-lg' : ''}
        ${visible
          ? dark ? 'border-[#252836] bg-[#13151F]' : 'border-slate-200 bg-white'
          : dark ? 'border-[#252836] bg-[#0D0F18] opacity-50' : 'border-slate-100 bg-slate-50 opacity-50'
        }`}>
      {/* 드래그 핸들 */}
      <button {...attributes} {...listeners} className={`cursor-grab active:cursor-grabbing shrink-0
        ${dark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'}`}>
        <GripVertical size={14} />
      </button>
      {/* 그룹 뱃지 */}
      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${dark ? gc.dark : gc.light}`}>
        {GROUP_LABELS[group] || group}
      </span>
      {/* 라벨 */}
      <div className="flex-1 min-w-0">
        <span className={`text-xs font-medium truncate block ${dark ? 'text-slate-200' : 'text-slate-700'}`}>
          {label}
        </span>
        {subLabel && (
          <span className={`text-[10px] truncate block ${dark ? 'text-slate-600' : 'text-slate-400'}`}>
            {subLabel}
          </span>
        )}
      </div>
      {/* 표시/숨김 토글 */}
      <button onClick={onToggle}
        className={`shrink-0 p-1 rounded transition-colors
          ${visible
            ? dark ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-emerald-600 hover:bg-emerald-50'
            : dark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'}`}>
        {visible ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>
    </div>
  )
}

/* ═══════════ 미리보기 — MetricPicker/GroupByPicker 스타일 ═══════════ */
function PickerPreview({ items, type, dark }) {
  if (!items.length) return (
    <p className={`text-[10px] italic ${dark ? 'text-slate-600' : 'text-slate-400'}`}>표시할 항목 없음</p>
  )

  /* 지표 → 그룹별 분류 */
  if (type === 'metrics') {
    const groups = {}
    items.forEach(m => {
      const g = m._computed ? 'computed' : (m.group || 'metric')
      if (!groups[g]) groups[g] = []
      groups[g].push(m)
    })
    return (
      <div className="flex flex-col gap-2">
        {Object.entries(groups).map(([g, list]) => (
          <div key={g}>
            <p className={`text-[9px] font-semibold uppercase tracking-wider mb-1
              ${g === 'computed' ? 'text-violet-400' : dark ? 'text-slate-500' : 'text-slate-400'}`}>
              {GROUP_LABELS[g] || g}
            </p>
            <div className="flex flex-wrap gap-1">
              {list.map(m => (
                <span key={m.id} className={`text-[10px] px-2 py-1 rounded-md border
                  ${m._computed ? 'border-l-2 !border-l-violet-500' : ''}
                  ${dark ? 'border-[#252836] text-slate-300 bg-[#13151F]' : 'border-slate-200 text-slate-600 bg-white'}`}>
                  {m.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  /* 그룹바이 */
  return (
    <div className="flex flex-wrap gap-1">
      {items.map(g => (
        <span key={g.id} className={`text-[10px] px-2 py-1 rounded-md border
          ${dark ? 'border-[#252836] text-slate-300 bg-[#13151F]' : 'border-slate-200 text-slate-600 bg-white'}`}>
          {g.label}
        </span>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════
   ConfigSection — 지표 또는 그룹바이 설정 섹션
   ═══════════════════════════════════════════ */
function ConfigSection({ title, allItems, config, dark, onChange }) {
  const enabled = config?.enabled ?? false
  const items = config?.items ?? []

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  /* items → 표시용 리스트 (config 있으면 그 순서, 없으면 allItems 순서) */
  const displayList = useMemo(() => {
    if (!enabled || items.length === 0) {
      return allItems.map(m => ({ ...m, _visible: true }))
    }
    const orderMap = new Map()
    items.forEach((item, idx) => orderMap.set(item.id, { order: idx, visible: item.visible !== false }))
    const configured = []
    const unconfigured = []
    allItems.forEach(m => {
      const entry = orderMap.get(m.id)
      if (entry) {
        configured.push({ ...m, _visible: entry.visible, _order: entry.order })
      } else {
        unconfigured.push({ ...m, _visible: true, _isNew: true })
      }
    })
    configured.sort((a, b) => a._order - b._order)
    return [...configured, ...unconfigured]
  }, [allItems, items, enabled])

  /* 커스텀 토글 */
  const toggleEnabled = () => {
    if (!enabled) {
      // 커스텀 ON → 현재 allItems 순서로 items 초기화
      onChange({
        enabled: true,
        items: allItems.map(m => ({ id: m.id, visible: true })),
      })
    } else {
      onChange({ enabled: false, items: [] })
    }
  }

  /* 개별 항목 토글 */
  const toggleVisible = (id) => {
    const next = items.map(it => it.id === id ? { ...it, visible: !it.visible } : it)
    // items에 없는 경우 (새로 추가된 지표) → 추가
    if (!next.find(it => it.id === id)) {
      next.push({ id, visible: false })
    }
    onChange({ ...config, items: next })
  }

  /* 드래그 종료 → 순서 변경 */
  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = displayList.map(m => m.id)
    const oldIdx = ids.indexOf(active.id)
    const newIdx = ids.indexOf(over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const reordered = arrayMove(displayList, oldIdx, newIdx)
    onChange({
      ...config,
      items: reordered.map(m => ({ id: m.id, visible: m._visible })),
    })
  }

  const sub = dark ? 'text-slate-500' : 'text-slate-400'

  return (
    <div className={`rounded-xl border ${dark ? 'border-[#252836]' : 'border-slate-200'}`}>
      {/* 섹션 헤더 */}
      <div className={`flex items-center justify-between px-4 py-3 border-b
        ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
        <div>
          <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{title}</p>
          <p className={`text-[10px] mt-0.5 ${sub}`}>
            {enabled
              ? `${displayList.filter(m => m._visible).length}/${displayList.length}개 표시`
              : '전체 표시 (기본)'
            }
          </p>
        </div>
        {/* 커스텀 토글 */}
        <button onClick={toggleEnabled}
          className={`flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg border transition-colors
            ${enabled
              ? dark ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-indigo-400 bg-indigo-50 text-indigo-600'
              : dark ? 'border-[#252836] text-slate-500 hover:text-slate-300' : 'border-slate-200 text-slate-400 hover:text-slate-600'
            }`}>
          <div className={`w-7 h-4 rounded-full relative transition-colors
            ${enabled ? 'bg-indigo-500' : dark ? 'bg-[#252836]' : 'bg-slate-200'}`}>
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform
              ${enabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
          </div>
          {enabled ? '커스텀' : '전체'}
        </button>
      </div>

      {/* 카드 리스트 */}
      <div className="p-3 flex flex-col gap-1.5">
        {enabled ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={displayList.map(m => m.id)} strategy={verticalListSortingStrategy}>
              {displayList.map(m => (
                <SortableCard
                  key={m.id}
                  id={m.id}
                  label={m.label}
                  subLabel={m.id !== m.label ? m.id : undefined}
                  group={m._computed ? 'computed' : (m.group || 'metric')}
                  visible={m._visible}
                  dark={dark}
                  onToggle={() => toggleVisible(m.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          displayList.map(m => (
            <div key={m.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border
              ${dark ? 'border-[#252836] bg-[#13151F]' : 'border-slate-200 bg-white'}`}>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0
                ${dark ? (GROUP_COLORS[m._computed ? 'computed' : (m.group || 'metric')]?.dark) : (GROUP_COLORS[m._computed ? 'computed' : (m.group || 'metric')]?.light)}`}>
                {GROUP_LABELS[m._computed ? 'computed' : (m.group || 'metric')] || 'metric'}
              </span>
              <span className={`text-xs truncate ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{m.label}</span>
              {m.id !== m.label && (
                <span className={`text-[10px] truncate ${dark ? 'text-slate-600' : 'text-slate-400'}`}>{m.id}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   WidgetConfig — 메인 페이지
   ═══════════════════════════════════════════ */
export default function WidgetConfig({ dark }) {
  const { columnConfig, setColumnConfig } = useColumnConfig()
  const [selTable, setSelTable] = useState(TABLES[0])
  const [saved, setSaved] = useState(false)

  /* 현재 테이블의 전체 지표/그룹바이 (필터 전) */
  const allMetrics = useMemo(
    () => buildTableMetrics(selTable, columnConfig),
    [selTable, columnConfig]
  )
  const allGroupBy = useMemo(
    () => buildTableGroupBy(selTable, columnConfig),
    [selTable, columnConfig]
  )

  /* 위젯 필터 적용 후 (미리보기용) */
  const previewMetrics = useMemo(
    () => buildWidgetMetrics(selTable, columnConfig),
    [selTable, columnConfig]
  )
  const previewGroupBy = useMemo(
    () => buildWidgetGroupBy(selTable, columnConfig),
    [selTable, columnConfig]
  )

  /* 현재 widgetMetricConfig */
  const wmCfg = columnConfig?.[selTable]?.widgetMetricConfig || {}

  /* 설정 변경 핸들러 */
  const handleMetricsChange = useCallback((newMetricsCfg) => {
    const tCfg = columnConfig?.[selTable] || {}
    setColumnConfig(selTable, {
      ...tCfg,
      widgetMetricConfig: { ...wmCfg, metrics: newMetricsCfg },
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [columnConfig, selTable, wmCfg, setColumnConfig])

  const handleGroupByChange = useCallback((newGroupByCfg) => {
    const tCfg = columnConfig?.[selTable] || {}
    setColumnConfig(selTable, {
      ...tCfg,
      widgetMetricConfig: { ...wmCfg, groupBy: newGroupByCfg },
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [columnConfig, selTable, wmCfg, setColumnConfig])

  const sub = dark ? 'text-slate-500' : 'text-slate-400'

  return (
    <div className="p-6 flex flex-col gap-5 max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-base font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>위젯 관리</h2>
          <p className={`text-xs mt-0.5 ${sub}`}>
            테이블별 위젯 피커에 표시할 지표 · 그룹바이 설정
          </p>
        </div>
        {saved && (
          <span className={`flex items-center gap-1 text-xs font-semibold animate-pulse
            ${dark ? 'text-emerald-400' : 'text-emerald-600'}`}>
            <Check size={13} /> 저장됨
          </span>
        )}
      </div>

      {/* 테이블 탭 */}
      <div className="flex gap-2">
        {TABLES.map(t => {
          const on = selTable === t
          return (
            <button key={t} onClick={() => setSelTable(t)}
              className={`text-xs px-4 py-2 rounded-lg border font-semibold transition-colors
                ${on
                  ? dark ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400' : 'border-indigo-400 bg-indigo-50 text-indigo-600'
                  : dark ? 'border-[#252836] text-slate-400 hover:text-white' : 'border-slate-200 text-slate-500 hover:text-slate-700'
                }`}>
              {getTableDisplayName(t, columnConfig)}
            </button>
          )
        })}
      </div>

      {/* 지표 설정 */}
      <ConfigSection
        title="지표 설정"
        allItems={allMetrics}
        config={wmCfg.metrics}
        dark={dark}
        onChange={handleMetricsChange}
      />

      {/* 그룹바이 설정 */}
      <ConfigSection
        title="그룹바이 설정"
        allItems={allGroupBy}
        config={wmCfg.groupBy}
        dark={dark}
        onChange={handleGroupByChange}
      />

      {/* 미리보기 */}
      <div className={`rounded-xl border p-4 ${dark ? 'border-[#252836]' : 'border-slate-200'}`}>
        <p className={`text-xs font-bold mb-3 ${dark ? 'text-white' : 'text-slate-800'}`}>
          미리보기 — 위젯 편집기에서 보이는 모습
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${sub}`}>지표 Picker</p>
            <PickerPreview items={previewMetrics} type="metrics" dark={dark} />
          </div>
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${sub}`}>그룹바이 Picker</p>
            <PickerPreview items={previewGroupBy} type="groupBy" dark={dark} />
          </div>
        </div>
      </div>
    </div>
  )
}
