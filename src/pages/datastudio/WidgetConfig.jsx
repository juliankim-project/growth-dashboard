import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useColumnConfig } from '../../store/useColumnConfig'
import {
  buildTableMetrics, buildTableGroupBy,
  getTableDisplayName,
} from '../../store/columnUtils'
import { TABLES } from './Tables'
import { Pencil, X, Plus, Check, Save, RotateCcw, GripVertical } from 'lucide-react'
import {
  DndContext, closestCenter,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable,
  rectSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/* ═══════════ 인라인 라벨 편집 ═══════════ */
function InlineEdit({ value, dark, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onSave(trimmed)
    else setDraft(value)
  }

  if (!editing) {
    return (
      <button onClick={(e) => { e.stopPropagation(); setEditing(true) }}
        className={`flex items-center gap-1 text-xs text-left truncate group/edit
          ${dark ? 'text-slate-300' : 'text-slate-700'}`}
        title="클릭하여 라벨 수정">
        <span className="truncate">{value}</span>
        <Pencil size={10} className={`shrink-0 opacity-0 group-hover/edit:opacity-60 transition-opacity
          ${dark ? 'text-slate-500' : 'text-slate-400'}`} />
      </button>
    )
  }

  return (
    <input ref={ref} value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
      onClick={e => e.stopPropagation()}
      className={`text-xs px-1 py-0.5 rounded border outline-none w-full
        ${dark ? 'bg-[#0F1117] border-indigo-500 text-white' : 'bg-white border-indigo-400 text-slate-800'}`}
    />
  )
}

/* ═══════════ Sortable 카드 (드래그 + 라벨편집 + 삭제) ═══════════ */
function SortableCard({ id, label, customLabel, dark, onLabelChange, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style}
      className={`relative flex items-center gap-1.5 px-2 py-2 rounded-lg border text-left transition-colors group/card
        ${isDragging ? 'z-50 shadow-lg ring-2 ring-indigo-500/30' : ''}
        ${dark ? 'border-[#252836] bg-[#13151F] hover:border-slate-600' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
      {/* 드래그 핸들 */}
      <button {...attributes} {...listeners}
        className={`cursor-grab active:cursor-grabbing shrink-0 touch-none
          ${dark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'}`}>
        <GripVertical size={14} />
      </button>
      {/* 라벨 (인라인 편집) */}
      <div className="flex-1 min-w-0">
        <InlineEdit value={customLabel || label} dark={dark} onSave={onLabelChange} />
        {customLabel && customLabel !== label && (
          <span className={`text-[9px] truncate block ${dark ? 'text-slate-600' : 'text-slate-400'}`}>
            원본: {label}
          </span>
        )}
      </div>
      {/* 삭제 버튼 */}
      <button onClick={(e) => { e.stopPropagation(); onDelete() }}
        className={`shrink-0 p-0.5 rounded opacity-0 group-hover/card:opacity-100 transition-opacity
          ${dark ? 'text-slate-600 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}>
        <X size={12} />
      </button>
    </div>
  )
}

/* ═══════════ 삭제된 항목 복원 버튼 ═══════════ */
function DeletedItem({ id, label, dark, onRestore }) {
  return (
    <button onClick={onRestore}
      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition-colors
        ${dark ? 'border-[#252836] text-slate-600 hover:border-emerald-500/40 hover:text-emerald-400'
          : 'border-slate-200 text-slate-400 hover:border-emerald-400 hover:text-emerald-600'}`}>
      <Plus size={10} />
      <span className="truncate">{label}</span>
    </button>
  )
}

/* ═══════════════════════════════════════════
   ConfigSection — 지표 또는 그룹바이 설정
   그룹 구분 없이 단일 리스트 + 드래그 재정렬
   ═══════════════════════════════════════════ */
function ConfigSection({ title, allItems, items, dark, onChange }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const itemMap = useMemo(() => {
    const m = new Map()
    ;(items || []).forEach(it => m.set(it.id, it))
    return m
  }, [items])

  /* 표시 중인 항목 (items 순서 유지) */
  const visibleItems = useMemo(() => {
    if (!items || items.length === 0) {
      return allItems.map(m => ({ ...m, _customLabel: null }))
    }
    const result = []
    const allMap = new Map(allItems.map(m => [m.id, m]))
    items.forEach(it => {
      if (it.visible === false) return
      const base = allMap.get(it.id)
      if (base) result.push({ ...base, _customLabel: it.label || null })
    })
    allItems.forEach(m => {
      if (!itemMap.has(m.id)) result.push({ ...m, _customLabel: null })
    })
    return result
  }, [allItems, items, itemMap])

  /* 삭제된(숨겨진) 항목 */
  const deletedItems = useMemo(() => {
    if (!items || items.length === 0) return []
    const allMap = new Map(allItems.map(m => [m.id, m]))
    return items.filter(it => it.visible === false && allMap.has(it.id))
      .map(it => ({ ...it, label: it.label || allMap.get(it.id)?.label || it.id }))
  }, [allItems, items])

  /* 헬퍼: items가 없으면 allItems 기반으로 초기화 */
  const ensureItems = () => items || allItems.map(m => ({ id: m.id, visible: true }))

  /* 핸들러: 라벨 변경 */
  const handleLabelChange = (id, newLabel) => {
    const baseItem = allItems.find(m => m.id === id)
    const isOriginal = baseItem && newLabel === baseItem.label
    const next = [...ensureItems()]
    const idx = next.findIndex(it => it.id === id)
    if (idx >= 0) {
      next[idx] = { ...next[idx], label: isOriginal ? undefined : newLabel }
    }
    onChange(next)
  }

  /* 핸들러: 삭제 (숨김) */
  const handleDelete = (id) => {
    const next = [...ensureItems()]
    const idx = next.findIndex(it => it.id === id)
    if (idx >= 0) {
      next[idx] = { ...next[idx], visible: false }
    } else {
      next.push({ id, visible: false })
    }
    onChange(next)
  }

  /* 핸들러: 복원 */
  const handleRestore = (id) => {
    const next = [...(items || [])]
    const idx = next.findIndex(it => it.id === id)
    if (idx >= 0) {
      next[idx] = { ...next[idx], visible: true }
    }
    onChange(next)
  }

  /* 핸들러: 드래그 재정렬 */
  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = visibleItems.map(m => m.id)
    const oldIdx = ids.indexOf(active.id)
    const newIdx = ids.indexOf(over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const reordered = arrayMove(visibleItems, oldIdx, newIdx)
    // 기존 삭제 항목 유지 + 순서 변경 반영
    const hiddenItems = (items || []).filter(it => it.visible === false)
    const nextItems = [
      ...reordered.map(m => {
        const existing = itemMap.get(m.id)
        return { id: m.id, visible: true, label: existing?.label || m._customLabel || undefined }
      }),
      ...hiddenItems,
    ]
    onChange(nextItems)
  }

  const sub = dark ? 'text-slate-500' : 'text-slate-400'
  const visCount = visibleItems.length
  const totalCount = allItems.length

  return (
    <div className={`rounded-xl border ${dark ? 'border-[#252836]' : 'border-slate-200'}`}>
      {/* 섹션 헤더 */}
      <div className={`flex items-center justify-between px-4 py-3 border-b
        ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
        <div>
          <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{title}</p>
          <p className={`text-[10px] mt-0.5 ${sub}`}>
            {visCount}/{totalCount}개 표시 · 드래그로 순서 변경, 클릭하여 라벨 수정, ✕ 삭제
          </p>
        </div>
      </div>

      {/* 카드 그리드 — 드래그 재정렬 */}
      <div className="p-4 flex flex-col gap-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleItems.map(m => m.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-2">
              {visibleItems.map(m => (
                <SortableCard key={m.id} id={m.id}
                  label={m.label} customLabel={m._customLabel}
                  dark={dark}
                  onLabelChange={(v) => handleLabelChange(m.id, v)}
                  onDelete={() => handleDelete(m.id)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* 삭제된 항목 복원 */}
        {deletedItems.length > 0 && (
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${sub}`}>
              삭제된 항목 ({deletedItems.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {deletedItems.map(it => (
                <DeletedItem key={it.id} id={it.id} label={it.label} dark={dark}
                  onRestore={() => handleRestore(it.id)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   PickerPreview — 위젯 편집기에서 보이는 모습 미리보기
   ═══════════════════════════════════════════ */
function PickerPreview({ items, dark }) {
  if (!items.length) return (
    <p className={`text-[10px] italic ${dark ? 'text-slate-600' : 'text-slate-400'}`}>표시할 항목 없음</p>
  )
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {items.map(m => (
        <span key={m.id} className={`text-[10px] px-2 py-1.5 rounded-lg border text-left truncate
          ${dark ? 'border-[#252836] text-slate-400 bg-[#13151F]' : 'border-slate-200 text-slate-600 bg-white'}`}>
          {m.label}
        </span>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════
   WidgetConfig — 메인 페이지
   ═══════════════════════════════════════════ */
export default function WidgetConfig({ dark }) {
  const { columnConfig, setColumnConfig } = useColumnConfig()
  const [selTable, setSelTable] = useState(TABLES[0])

  /* 로컬 draft 상태 (저장 전까지 변경사항 유지) */
  const getInitial = useCallback((table) => {
    const wmc = columnConfig?.[table]?.widgetMetricConfig || {}
    return {
      metrics: wmc.metrics?.items ? [...wmc.metrics.items] : null,
      groupBy: wmc.groupBy?.items ? [...wmc.groupBy.items] : null,
    }
  }, [columnConfig])

  const [draft, setDraft] = useState(() => getInitial(selTable))
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)

  /* 테이블 변경 시 draft 리셋 */
  useEffect(() => {
    setDraft(getInitial(selTable))
    setDirty(false)
    setSaved(false)
  }, [selTable, getInitial])

  /* 현재 테이블의 전체 지표/그룹바이 (필터 전) */
  const allMetrics = useMemo(
    () => buildTableMetrics(selTable, columnConfig),
    [selTable, columnConfig]
  )
  const allGroupBy = useMemo(
    () => buildTableGroupBy(selTable, columnConfig),
    [selTable, columnConfig]
  )

  /* 위젯 필터 적용 후 (미리보기용 — draft 기반 시뮬레이션) */
  const applyDraft = (all, draftItems) => {
    if (!draftItems) return all
    const orderMap = new Map()
    draftItems.forEach((item, idx) => orderMap.set(item.id, { order: idx, visible: item.visible !== false, label: item.label }))
    const configured = []
    const unconfigured = []
    all.forEach(m => {
      const entry = orderMap.get(m.id)
      if (entry) {
        if (entry.visible) {
          const item = entry.label ? { ...m, label: entry.label } : m
          configured.push({ item, order: entry.order })
        }
      } else {
        unconfigured.push(m)
      }
    })
    configured.sort((a, b) => a.order - b.order)
    return [...configured.map(c => c.item), ...unconfigured]
  }

  const previewMetrics = useMemo(() => applyDraft(allMetrics, draft.metrics), [allMetrics, draft.metrics])
  const previewGroupBy = useMemo(() => applyDraft(allGroupBy, draft.groupBy), [allGroupBy, draft.groupBy])

  /* draft 변경 핸들러 */
  const handleMetricsChange = useCallback((newItems) => {
    setDraft(prev => ({ ...prev, metrics: newItems }))
    setDirty(true)
    setSaved(false)
  }, [])

  const handleGroupByChange = useCallback((newItems) => {
    setDraft(prev => ({ ...prev, groupBy: newItems }))
    setDirty(true)
    setSaved(false)
  }, [])

  /* 저장 */
  const handleSave = useCallback(() => {
    const tCfg = columnConfig?.[selTable] || {}
    const wmCfg = tCfg.widgetMetricConfig || {}
    setColumnConfig(selTable, {
      ...tCfg,
      widgetMetricConfig: {
        ...wmCfg,
        metrics: draft.metrics ? { enabled: true, items: draft.metrics } : wmCfg.metrics,
        groupBy: draft.groupBy ? { enabled: true, items: draft.groupBy } : wmCfg.groupBy,
      },
    })
    setDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }, [columnConfig, selTable, draft, setColumnConfig])

  /* 초기화 */
  const handleReset = useCallback(() => {
    setDraft(getInitial(selTable))
    setDirty(false)
  }, [selTable, getInitial])

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
        <div className="flex items-center gap-2">
          {dirty && (
            <button onClick={handleReset}
              className={`flex items-center gap-1 text-xs px-3 py-2 rounded-lg border transition-colors
                ${dark ? 'border-[#252836] text-slate-400 hover:text-white' : 'border-slate-200 text-slate-500 hover:text-slate-700'}`}>
              <RotateCcw size={12} /> 되돌리기
            </button>
          )}
          <button onClick={handleSave}
            disabled={!dirty}
            className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition-colors
              ${dirty
                ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/20'
                : saved
                  ? dark ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : dark ? 'bg-[#252836] text-slate-600 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}>
            {saved ? <><Check size={13} /> 저장됨</> : <><Save size={13} /> 저장</>}
          </button>
        </div>
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
        items={draft.metrics}
        dark={dark}
        onChange={handleMetricsChange}
      />

      {/* 그룹바이 설정 */}
      <ConfigSection
        title="그룹바이 설정"
        allItems={allGroupBy}
        items={draft.groupBy}
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
            <PickerPreview items={previewMetrics} dark={dark} />
          </div>
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${sub}`}>그룹바이 Picker</p>
            <PickerPreview items={previewGroupBy} dark={dark} />
          </div>
        </div>
      </div>
    </div>
  )
}
