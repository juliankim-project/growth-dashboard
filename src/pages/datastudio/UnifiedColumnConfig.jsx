import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useColumnConfig } from '../../store/useColumnConfig'
import { TABLES, buildTableMetrics, buildTableGroupBy, getColumnLabel, getTableDisplayName } from '../../store/columnUtils'
import { Table2, GripVertical, Pencil, Plus, X, RotateCcw } from 'lucide-react'
import Spinner from '../../components/UI/Spinner'
import {
  DndContext, closestCenter,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable,
  rectSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/* ═══════════ 카테고리 뱃지 ═══════════ */
const CATEGORY_BADGE = {
  metric:    { label: '지표',   cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  dimension: { label: '디멘전', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  computed:  { label: '산술',   cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  derived:   { label: '파생',   cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  hidden:    { label: '숨김',   cls: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
}

function Badge({ category, dark }) {
  const b = CATEGORY_BADGE[category] || CATEGORY_BADGE.hidden
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium
      ${dark ? b.cls : b.cls.replace(/\/10/g, '/15').replace(/\/20/g, '/30')}`}>
      {b.label}
    </span>
  )
}

/* ═══════════ 인라인 라벨 편집 (위젯 라벨용) ═══════════ */
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

/* ═══════════ Sortable 카드 ═══════════ */
function SortableCard({ id, label, customLabel, dark, onLabelChange, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style}
      className={`relative flex items-center gap-1.5 px-2 py-2 rounded-lg border text-left transition-colors group/card
        ${isDragging ? 'z-50 shadow-lg ring-2 ring-indigo-500/30' : ''}
        ${dark ? 'border-[#252836] bg-[#13151F] hover:border-slate-600' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
      <button {...attributes} {...listeners}
        className={`cursor-grab active:cursor-grabbing shrink-0 touch-none
          ${dark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'}`}>
        <GripVertical size={14} />
      </button>
      <div className="flex-1 min-w-0">
        <InlineEdit value={customLabel || label} dark={dark} onSave={onLabelChange} />
        {customLabel && customLabel !== label && (
          <span className={`text-[9px] truncate block ${dark ? 'text-slate-600' : 'text-slate-400'}`}>
            원본: {label}
          </span>
        )}
      </div>
      <button onClick={(e) => { e.stopPropagation(); onDelete() }}
        className={`shrink-0 p-0.5 rounded opacity-0 group-hover/card:opacity-100 transition-opacity
          ${dark ? 'text-slate-600 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}>
        <X size={12} />
      </button>
    </div>
  )
}

/* ═══════════ 삭제된 항목 복원 ═══════════ */
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

/* ═══════════ ConfigSection — 위젯 표시 설정 (드래그 + 라벨 + 삭제/복원) ═══════════ */
function ConfigSection({ title, allItems, items, dark, onChange }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const itemMap = useMemo(() => {
    const m = new Map()
    ;(items || []).forEach(it => m.set(it.id, it))
    return m
  }, [items])

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

  const deletedItems = useMemo(() => {
    if (!items || items.length === 0) return []
    const allMap = new Map(allItems.map(m => [m.id, m]))
    return items.filter(it => it.visible === false && allMap.has(it.id))
      .map(it => ({ ...it, label: it.label || allMap.get(it.id)?.label || it.id }))
  }, [allItems, items])

  const ensureItems = () => items || allItems.map(m => ({ id: m.id, visible: true }))

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

  const handleRestore = (id) => {
    const next = [...(items || [])]
    const idx = next.findIndex(it => it.id === id)
    if (idx >= 0) {
      next[idx] = { ...next[idx], visible: true }
    }
    onChange(next)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = visibleItems.map(m => m.id)
    const oldIdx = ids.indexOf(active.id)
    const newIdx = ids.indexOf(over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const reordered = arrayMove(visibleItems, oldIdx, newIdx)
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

  return (
    <div className={`rounded-xl border ${dark ? 'border-[#252836]' : 'border-slate-200'}`}>
      <div className={`flex items-center justify-between px-4 py-3 border-b
        ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
        <div>
          <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{title}</p>
          <p className={`text-[10px] mt-0.5 ${sub}`}>
            {visibleItems.length}/{allItems.length}개 표시 · 드래그로 순서 변경, 클릭하여 라벨 수정, ✕ 삭제
          </p>
        </div>
      </div>

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

/* ═══════════ PickerPreview ═══════════ */
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

/* ─── applyDraft — widgetMetricConfig 필터 시뮬레이션 ─── */
function applyDraft(all, wmCfgItems) {
  if (!wmCfgItems?.length) return all
  const orderMap = new Map()
  wmCfgItems.forEach((item, idx) => orderMap.set(item.id, { order: idx, visible: item.visible !== false, label: item.label }))
  const configured = []
  const unconfigured = []
  all.forEach(m => {
    const entry = orderMap.get(m.id)
    if (entry) {
      if (entry.visible) {
        const item = entry.label ? { ...m, label: entry.label } : m
        configured.push({ item, order: entry.order })
      }
    } else { unconfigured.push(m) }
  })
  configured.sort((a, b) => a.order - b.order)
  return [...configured.map(c => c.item), ...unconfigured]
}

/* ═══════════════════════════════════════════
   UnifiedColumnConfig — 메인 컴포넌트 (읽기 전용 + 위젯 표시 설정)
   ═══════════════════════════════════════════ */
export default function UnifiedColumnConfig({ dark }) {
  const { columnConfig, setColumnConfig, loading } = useColumnConfig()
  const [selTable, setSelTable] = useState(TABLES[0])

  /* ─── 스타일 ─── */
  const card = dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'
  const sub = dark ? 'text-slate-400' : 'text-slate-500'

  const tCfg = columnConfig[selTable]

  /* ─── 컬럼 목록 (카테고리별 그룹핑) ─── */
  const categorizedColumns = useMemo(() => {
    if (!tCfg?.columns) return { metrics: [], dimensions: [], hidden: [] }
    const metrics = []
    const dimensions = []
    const hidden = []
    const dims = new Set(tCfg.dimensionColumns || [])

    Object.entries(tCfg.columns).forEach(([col, cfg]) => {
      const entry = { col, ...cfg }
      if (cfg.visible === false) hidden.push(entry)
      else if (dims.has(col)) dimensions.push(entry)
      else metrics.push(entry)
    })

    return { metrics, dimensions, hidden }
  }, [tCfg])

  /* ─── 위젯용 메트릭/그룹바이 ─── */
  const allMetrics = useMemo(() => buildTableMetrics(selTable, columnConfig), [selTable, columnConfig])
  const allGroupBy = useMemo(() => buildTableGroupBy(selTable, columnConfig), [selTable, columnConfig])

  const wmCfg = tCfg?.widgetMetricConfig || {}

  const previewMetrics = useMemo(
    () => applyDraft(allMetrics, wmCfg.metrics?.items),
    [allMetrics, wmCfg.metrics?.items]
  )
  const previewGroupBy = useMemo(
    () => applyDraft(allGroupBy, wmCfg.groupBy?.items),
    [allGroupBy, wmCfg.groupBy?.items]
  )

  /* ─── 위젯 표시 설정 변경 핸들러 ─── */
  const handleWidgetChange = useCallback((section, items) => {
    const prev = tCfg || {}
    const prevWmc = prev.widgetMetricConfig || {}
    const updated = {
      ...prev,
      widgetMetricConfig: {
        ...prevWmc,
        [section]: { enabled: true, items },
      },
    }
    setColumnConfig(selTable, updated)
  }, [selTable, tCfg, setColumnConfig])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner dark={dark} />
      </div>
    )
  }

  const hasData = tCfg && tCfg.columns && Object.keys(tCfg.columns).length > 0

  return (
    <div className="max-w-5xl mx-auto p-6 flex flex-col gap-6">
      {/* ─── 헤더 ─── */}
      <div className="flex items-center gap-3">
        <Table2 size={20} className={dark ? 'text-indigo-400' : 'text-indigo-600'} />
        <h1 className={`text-lg font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
          데이터 설정
        </h1>
      </div>

      {/* ─── 테이블 탭 ─── */}
      <div className="flex gap-2">
        {TABLES.map(t => {
          const active = t === selTable
          return (
            <button key={t} onClick={() => setSelTable(t)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors border
                ${active
                  ? (dark ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-700')
                  : (dark ? 'border-[#252836] text-slate-500 hover:text-slate-300' : 'border-slate-200 text-slate-400 hover:text-slate-600')
                }`}>
              {getTableDisplayName(t, columnConfig)}
            </button>
          )
        })}
      </div>

      {!hasData ? (
        <div className={`rounded-xl border p-8 text-center ${card}`}>
          <p className={sub}>컬럼 정의를 불러오는 중이거나, DB에 정의가 없습니다.</p>
        </div>
      ) : (
        <>
          {/* ─── 기본 정보 ─── */}
          <div className={`rounded-xl border p-4 ${card}`}>
            <p className={`text-xs font-bold mb-3 ${dark ? 'text-white' : 'text-slate-800'}`}>기본 정보</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className={`text-[10px] mb-1 ${sub}`}>표시명</p>
                <p className={`text-sm ${dark ? 'text-white' : 'text-slate-800'}`}>
                  {tCfg.displayName || selTable}
                </p>
              </div>
              <div>
                <p className={`text-[10px] mb-1 ${sub}`}>날짜 컬럼</p>
                <p className={`text-sm font-mono ${dark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {tCfg.dateColumn || '—'}
                </p>
              </div>
            </div>
          </div>

          {/* ─── 지표 컬럼 ─── */}
          {categorizedColumns.metrics.length > 0 && (
            <div className={`rounded-xl border ${card}`}>
              <div className={`px-4 py-3 border-b ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
                <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
                  지표 ({categorizedColumns.metrics.length})
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className={dark ? 'text-slate-500' : 'text-slate-400'}>
                      <th className="text-left px-4 py-2 font-medium">컬럼명</th>
                      <th className="text-left px-4 py-2 font-medium">별칭</th>
                      <th className="text-left px-4 py-2 font-medium">포맷</th>
                      <th className="text-left px-4 py-2 font-medium">집계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categorizedColumns.metrics.map(({ col, alias, fmt, agg }) => (
                      <tr key={col} className={`border-t ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
                        <td className={`px-4 py-2 font-mono ${dark ? 'text-slate-300' : 'text-slate-700'}`}>{col}</td>
                        <td className={`px-4 py-2 ${dark ? 'text-white' : 'text-slate-800'}`}>{alias || '—'}</td>
                        <td className="px-4 py-2"><Badge category="metric" dark={dark} />{' '}<span className={sub}>{fmt}</span></td>
                        <td className={`px-4 py-2 uppercase ${sub}`}>{agg || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── 디멘전 컬럼 ─── */}
          {categorizedColumns.dimensions.length > 0 && (
            <div className={`rounded-xl border ${card}`}>
              <div className={`px-4 py-3 border-b ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
                <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
                  디멘전 ({categorizedColumns.dimensions.length})
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className={dark ? 'text-slate-500' : 'text-slate-400'}>
                      <th className="text-left px-4 py-2 font-medium">컬럼명</th>
                      <th className="text-left px-4 py-2 font-medium">별칭</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categorizedColumns.dimensions.map(({ col, alias }) => (
                      <tr key={col} className={`border-t ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
                        <td className={`px-4 py-2 font-mono ${dark ? 'text-slate-300' : 'text-slate-700'}`}>{col}</td>
                        <td className={`px-4 py-2 ${dark ? 'text-white' : 'text-slate-800'}`}>{alias || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── 산술 지표 ─── */}
          {(tCfg.computed || []).length > 0 && (
            <div className={`rounded-xl border ${card}`}>
              <div className={`px-4 py-3 border-b ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
                <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
                  산술 지표 ({tCfg.computed.length})
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className={dark ? 'text-slate-500' : 'text-slate-400'}>
                      <th className="text-left px-4 py-2 font-medium">ID</th>
                      <th className="text-left px-4 py-2 font-medium">이름</th>
                      <th className="text-left px-4 py-2 font-medium">포맷</th>
                      <th className="text-left px-4 py-2 font-medium">수식</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tCfg.computed.map(cc => {
                      const formulaStr = cc.aggType === 'count'
                        ? 'COUNT(*)'
                        : (cc.terms || []).map((t, i) => `${i > 0 ? ` ${t.sign} ` : ''}${t.col}`).join('')
                      return (
                        <tr key={cc.id} className={`border-t ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
                          <td className={`px-4 py-2 font-mono ${dark ? 'text-slate-300' : 'text-slate-700'}`}>{cc.id}</td>
                          <td className={`px-4 py-2 ${dark ? 'text-white' : 'text-slate-800'}`}>{cc.name}</td>
                          <td className="px-4 py-2"><Badge category="computed" dark={dark} />{' '}<span className={sub}>{cc.fmt}</span></td>
                          <td className={`px-4 py-2 font-mono text-[11px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{formulaStr}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── 위젯 표시 설정 (편집 가능) ─── */}
          <div className="flex flex-col gap-4">
            <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
              위젯 표시 설정
            </p>
            <p className={`text-[10px] -mt-3 ${sub}`}>
              대시보드 위젯에서 표시할 지표/그룹바이의 순서와 라벨을 설정합니다.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ConfigSection title="지표" allItems={allMetrics}
                items={wmCfg.metrics?.items} dark={dark}
                onChange={(items) => handleWidgetChange('metrics', items)} />
              <ConfigSection title="그룹바이" allItems={allGroupBy}
                items={wmCfg.groupBy?.items} dark={dark}
                onChange={(items) => handleWidgetChange('groupBy', items)} />
            </div>

            {/* 프리뷰 */}
            <div className={`rounded-xl border p-4 ${card}`}>
              <p className={`text-[10px] font-semibold mb-3 ${sub}`}>위젯 편집기 미리보기</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <p className={`text-[10px] mb-2 ${sub}`}>지표 선택기</p>
                  <PickerPreview items={previewMetrics} dark={dark} />
                </div>
                <div>
                  <p className={`text-[10px] mb-2 ${sub}`}>그룹바이 선택기</p>
                  <PickerPreview items={previewGroupBy} dark={dark} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
