import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { MARKETING_SEED_CONFIG, PRODUCT_SEED_CONFIG } from '../../store/useConfig'
import { useColumnConfig } from '../../store/useColumnConfig'
import { TABLES, buildTableMetrics, buildTableGroupBy, getColumnLabel, getTableDisplayName } from '../../store/columnUtils'
import {
  Table2, RefreshCw, ChevronDown, ChevronRight,
  Eye, EyeOff, Plus, Trash2, Save, Calculator, Check, X,
  Pencil, GripVertical, RotateCcw,
} from 'lucide-react'
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

/* ─── Auto-detection constants ─── */
const LIKELY_HIDDEN = new Set(['id', 'no', 'guest_type', 'guest_id', 'user_id', 'roomtype_id', 'room_id', 'branch_id', 'channel_id', 'room_type2', 'channel_resv_no1', 'channel_resv_no2', 'vehicle_num', 'has_gift', 'gift_memo', 'operator', 'alim_status', 'is_extend', 'prohibit_move', 'is_long'])
const LIKELY_DIMENSION = new Set(['brand_name', 'branch_name', 'channel_name', 'channel_group', 'room_type_name', 'room_type2', 'status', 'channel', 'campaign', 'ad_group', 'ad_creative', 'content', 'sub_publisher', 'term', 'area'])
const LIKELY_CURRENCY = new Set(['payment_amount', 'original_price', 'staypass_discount', 'promo_discount', 'coupon_discount_amount', 'point_amount', 'spend', 'revenue', 'cpc'])
const LIKELY_DATE = new Set(['date', 'reservation_date', 'check_in_date', 'check_in', 'check_out', 'reserved_at', 'created_at', 'updated_at'])

function autoDetect(col) {
  const isDim = LIKELY_DIMENSION.has(col)
  const isHidden = LIKELY_HIDDEN.has(col) || LIKELY_DATE.has(col)
  return {
    alias: '',
    visible: !isHidden,
    fmt: LIKELY_CURRENCY.has(col) ? 'currency' : LIKELY_DATE.has(col) ? 'date' : isDim ? 'text' : 'number',
    agg: (isDim || isHidden) ? null : 'sum',
  }
}

/* ─── Options ─── */
const FMT_OPTIONS = [
  { value: 'number', label: '#숫자' },
  { value: 'currency', label: '통화' },
  { value: 'pct', label: '%' },
  { value: 'text', label: '텍스트' },
  { value: 'date', label: '날짜' },
]
const AGG_OPTIONS = [
  { value: 'sum', label: 'SUM' },
  { value: 'count', label: 'COUNT' },
  { value: 'avg', label: 'AVG' },
]
const TYPE_OPTIONS = [
  { value: 'metric', label: '지표' },
  { value: 'dimension', label: '디멘전' },
  { value: 'hidden', label: '숨김' },
]
const CC_TYPE_OPTIONS = [
  { value: 'formula', label: '수식' },
  { value: 'count', label: 'COUNT(*)' },
  { value: 'avg', label: 'AVG(컬럼)' },
]

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
  const visCount = visibleItems.length
  const totalCount = allItems.length

  return (
    <div className={`rounded-xl border ${dark ? 'border-[#252836]' : 'border-slate-200'}`}>
      <div className={`flex items-center justify-between px-4 py-3 border-b
        ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
        <div>
          <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{title}</p>
          <p className={`text-[10px] mt-0.5 ${sub}`}>
            {visCount}/{totalCount}개 표시 · 드래그로 순서 변경, 클릭하여 라벨 수정, ✕ 삭제
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
   UnifiedColumnConfig — 메인 컴포넌트
   ═══════════════════════════════════════════ */
export default function UnifiedColumnConfig({ dark }) {
  const { getColumnConfig, setColumnConfig, columnConfig } = useColumnConfig()
  const [tables, setTables] = useState({})
  const [loading, setLoading] = useState(true)
  const [selTable, setSelTable] = useState(TABLES[0])
  const [editCfg, setEditCfg] = useState({})
  const [saved, setSaved] = useState({})
  const [hiddenColsOpen, setHiddenColsOpen] = useState({})
  const saveTimer = useRef({})
  const savedTimer = useRef({})

  /* ─── 스타일 ─── */
  const card = dark ? 'bg-[#1A1D27] border-[#252836]' : 'bg-white border-slate-200 shadow-sm'
  const sub = dark ? 'text-slate-400' : 'text-slate-500'
  const inp = `text-xs px-2 py-1.5 rounded-lg border outline-none transition-colors
    ${dark ? 'bg-[#13151C] border-[#252836] text-white placeholder:text-slate-600 focus:border-indigo-500'
           : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-indigo-500'}`
  const sel = `text-[11px] px-1.5 py-1 rounded border outline-none
    ${dark ? 'bg-[#13151C] border-[#252836] text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`

  /* ─── 테이블 데이터 로드 ─── */
  const loadTables = async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    const result = {}
    for (const t of TABLES) {
      try {
        const { data, error, count } = await supabase
          .from(t).select('*', { count: 'exact' }).limit(10)
        if (!error) {
          result[t] = {
            count,
            columns: data?.[0] ? Object.keys(data[0]) : [],
            sample: data || [],
          }
        }
      } catch {}
    }
    setTables(result)
    setLoading(false)
  }

  useEffect(() => { loadTables() }, [])

  /* ─── 테이블 탭 전환 시 editCfg 초기화 ─── */
  useEffect(() => {
    if (!tables[selTable]) return
    if (editCfg[selTable]) return // 이미 로컬 복사본 있음

    const t = selTable
    const existing = getColumnConfig(t)
    const info = tables[t]

    if (info && (!existing.columns || Object.keys(existing.columns).length === 0)) {
      const seed = t === 'marketing_data' ? MARKETING_SEED_CONFIG
                 : t === 'product_revenue_raw' ? PRODUCT_SEED_CONFIG
                 : null
      const columns = {}
      const dimensionColumns = seed ? [...(seed.dimensionColumns || [])] : []
      info.columns.forEach(col => {
        if (seed?.columns?.[col]) {
          columns[col] = { ...seed.columns[col] }
        } else {
          columns[col] = autoDetect(col)
          if (!seed && LIKELY_DIMENSION.has(col)) dimensionColumns.push(col)
        }
      })
      const init = {
        columns,
        dimensionColumns,
        computed: seed?.computed || [],
        ...(seed?.displayName ? { displayName: seed.displayName } : {}),
        widgetMetricConfig: existing.widgetMetricConfig || {},
      }
      setEditCfg(prev => ({ ...prev, [t]: init }))
      setColumnConfig(t, init)
    } else {
      const merged = {
        ...existing,
        columns: { ...(existing.columns || {}) },
        widgetMetricConfig: existing.widgetMetricConfig || {},
      }
      let dirty = false
      if (info) {
        info.columns.forEach(col => {
          if (!merged.columns[col]) {
            merged.columns[col] = autoDetect(col)
            dirty = true
          }
        })
      }
      setEditCfg(prev => ({ ...prev, [t]: merged }))
      if (dirty) setColumnConfig(t, merged)
    }
  }, [selTable, tables])

  /* ─── 저장 완료 피드백 ─── */
  const flashSaved = useCallback((tableName) => {
    setSaved(prev => ({ ...prev, [tableName]: true }))
    clearTimeout(savedTimer.current[tableName])
    savedTimer.current[tableName] = setTimeout(() => {
      setSaved(prev => ({ ...prev, [tableName]: false }))
    }, 2000)
  }, [])

  /* ─── debounce 저장 ─── */
  const debounceSave = useCallback((tableName, cfg) => {
    clearTimeout(saveTimer.current[tableName])
    saveTimer.current[tableName] = setTimeout(() => {
      setColumnConfig(tableName, cfg)
      flashSaved(tableName)
    }, 800)
  }, [setColumnConfig, flashSaved])

  /* ─── 전체 저장 ─── */
  const [globalSaved, setGlobalSaved] = useState(false)
  const globalSavedTimer = useRef()
  const saveAll = () => {
    Object.entries(editCfg).forEach(([tableName, cfg]) => {
      clearTimeout(saveTimer.current[tableName])
      setColumnConfig(tableName, cfg)
    })
    setGlobalSaved(true)
    clearTimeout(globalSavedTimer.current)
    globalSavedTimer.current = setTimeout(() => setGlobalSaved(false), 2000)
  }
  const hasEdits = Object.keys(editCfg).length > 0

  /* ─── 컬럼 설정 업데이트 ─── */
  const updateCol = (tableName, col, updates) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.columns = { ...(tCfg.columns || {}) }
      tCfg.columns[col] = { ...(tCfg.columns[col] || {}), ...updates }
      debounceSave(tableName, tCfg)
      return { ...prev, [tableName]: tCfg }
    })
  }

  /* ─── 컬럼 타입 변경 (지표/디멘전/숨김) ─── */
  const changeColType = (tableName, col, newType) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.columns = { ...(tCfg.columns || {}) }
      tCfg.dimensionColumns = [...(tCfg.dimensionColumns || [])]

      if (newType === 'metric') {
        tCfg.dimensionColumns = tCfg.dimensionColumns.filter(d => d !== col)
        tCfg.columns[col] = { ...(tCfg.columns[col] || {}), visible: true, agg: 'sum' }
      } else if (newType === 'dimension') {
        if (!tCfg.dimensionColumns.includes(col)) tCfg.dimensionColumns.push(col)
        tCfg.columns[col] = { ...(tCfg.columns[col] || {}), visible: true, agg: null }
      } else { // hidden
        tCfg.dimensionColumns = tCfg.dimensionColumns.filter(d => d !== col)
        tCfg.columns[col] = { ...(tCfg.columns[col] || {}), visible: false }
      }

      debounceSave(tableName, tCfg)
      return { ...prev, [tableName]: tCfg }
    })
  }

  /* ─── displayName 업데이트 ─── */
  const updateDisplayName = (tableName, value) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}), displayName: value }
      debounceSave(tableName, tCfg)
      return { ...prev, [tableName]: tCfg }
    })
  }

  /* ─── dateColumn 업데이트 ─── */
  const updateDateColumn = (tableName, value) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}), dateColumn: value }
      debounceSave(tableName, tCfg)
      return { ...prev, [tableName]: tCfg }
    })
  }

  /* ─── 위젯 지표 설정 변경 ─── */
  const handleWidgetMetricsChange = useCallback((newItems) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[selTable] || {}) }
      const wmCfg = { ...(tCfg.widgetMetricConfig || {}) }
      wmCfg.metrics = { enabled: true, items: newItems }
      tCfg.widgetMetricConfig = wmCfg
      debounceSave(selTable, tCfg)
      return { ...prev, [selTable]: tCfg }
    })
  }, [selTable, debounceSave])

  /* ─── 위젯 그룹바이 설정 변경 ─── */
  const handleWidgetGroupByChange = useCallback((newItems) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[selTable] || {}) }
      const wmCfg = { ...(tCfg.widgetMetricConfig || {}) }
      wmCfg.groupBy = { enabled: true, items: newItems }
      tCfg.widgetMetricConfig = wmCfg
      debounceSave(selTable, tCfg)
      return { ...prev, [selTable]: tCfg }
    })
  }, [selTable, debounceSave])

  /* ─── 계산 컬럼 추가 ─── */
  const addComputed = tableName => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.computed = [...(tCfg.computed || []), {
        id: 'cc_' + Date.now(),
        name: '',
        aggType: 'formula',
        terms: [{ col: '', sign: '+' }],
        fmt: 'number',
      }]
      return { ...prev, [tableName]: tCfg }
    })
  }

  /* ─── 계산 컬럼 업데이트 ─── */
  const updateComputed = (tableName, ccId, updates) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.computed = (tCfg.computed || []).map(cc =>
        cc.id === ccId ? { ...cc, ...updates } : cc
      )
      debounceSave(tableName, tCfg)
      return { ...prev, [tableName]: tCfg }
    })
  }

  /* ─── 계산 컬럼 삭제 ─── */
  const removeComputed = (tableName, ccId) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.computed = (tCfg.computed || []).filter(cc => cc.id !== ccId)
      debounceSave(tableName, tCfg)
      return { ...prev, [tableName]: tCfg }
    })
  }

  /* ─── 계산 컬럼 타입 변경 ─── */
  const changeComputedType = (tableName, ccId, newType) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.computed = (tCfg.computed || []).map(cc => {
        if (cc.id !== ccId) return cc
        if (newType === 'count') {
          return { ...cc, aggType: 'count', terms: [] }
        } else if (newType === 'avg') {
          return { ...cc, aggType: 'avg', terms: [{ col: '', sign: '+' }] }
        } else {
          return { ...cc, aggType: undefined, terms: cc.terms?.length ? cc.terms : [{ col: '', sign: '+' }] }
        }
      })
      debounceSave(tableName, tCfg)
      return { ...prev, [tableName]: tCfg }
    })
  }

  /* ─── term 추가/삭제/수정 ─── */
  const addTerm = (tableName, ccId) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.computed = (tCfg.computed || []).map(cc =>
        cc.id === ccId ? { ...cc, terms: [...cc.terms, { col: '', sign: '+' }] } : cc
      )
      return { ...prev, [tableName]: tCfg }
    })
  }

  const removeTerm = (tableName, ccId, idx) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.computed = (tCfg.computed || []).map(cc =>
        cc.id === ccId ? { ...cc, terms: cc.terms.filter((_, i) => i !== idx) } : cc
      )
      debounceSave(tableName, tCfg)
      return { ...prev, [tableName]: tCfg }
    })
  }

  const updateTerm = (tableName, ccId, idx, updates) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.computed = (tCfg.computed || []).map(cc =>
        cc.id === ccId ? { ...cc, terms: cc.terms.map((t, i) => i === idx ? { ...t, ...updates } : t) } : cc
      )
      debounceSave(tableName, tCfg)
      return { ...prev, [tableName]: tCfg }
    })
  }

  /* ─── 괄호 그룹 관련 ─── */
  const addGroup = (tableName, ccId) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.computed = (tCfg.computed || []).map(cc =>
        cc.id === ccId
          ? { ...cc, terms: [...cc.terms, { type: 'group', sign: '+', children: [{ col: '', sign: '+' }] }] }
          : cc
      )
      return { ...prev, [tableName]: tCfg }
    })
  }

  const addTermToGroup = (tableName, ccId, groupIdx) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.computed = (tCfg.computed || []).map(cc => {
        if (cc.id !== ccId) return cc
        const terms = cc.terms.map((t, i) =>
          i === groupIdx && t.type === 'group'
            ? { ...t, children: [...(t.children || []), { col: '', sign: '+' }] }
            : t
        )
        return { ...cc, terms }
      })
      return { ...prev, [tableName]: tCfg }
    })
  }

  const removeTermFromGroup = (tableName, ccId, groupIdx, childIdx) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.computed = (tCfg.computed || []).map(cc => {
        if (cc.id !== ccId) return cc
        const terms = cc.terms.map((t, i) =>
          i === groupIdx && t.type === 'group'
            ? { ...t, children: t.children.filter((_, ci) => ci !== childIdx) }
            : t
        )
        return { ...cc, terms }
      })
      debounceSave(tableName, tCfg)
      return { ...prev, [tableName]: tCfg }
    })
  }

  const updateTermInGroup = (tableName, ccId, groupIdx, childIdx, updates) => {
    setEditCfg(prev => {
      const tCfg = { ...(prev[tableName] || {}) }
      tCfg.computed = (tCfg.computed || []).map(cc => {
        if (cc.id !== ccId) return cc
        const terms = cc.terms.map((t, i) =>
          i === groupIdx && t.type === 'group'
            ? { ...t, children: t.children.map((c, ci) => ci === childIdx ? { ...c, ...updates } : c) }
            : t
        )
        return { ...cc, terms }
      })
      debounceSave(tableName, tCfg)
      return { ...prev, [tableName]: tCfg }
    })
  }

  /* ─── 현재 선택 테이블 데이터 ─── */
  const info = tables[selTable]
  const tCfg = editCfg[selTable] || {}
  const columns = tCfg.columns || {}
  const dims = new Set(tCfg.dimensionColumns || [])
  const computed = tCfg.computed || []
  const displayName = tCfg.displayName || ''
  const dateColumn = tCfg.dateColumn || ''
  const wmCfg = tCfg.widgetMetricConfig || {}

  /* ─── 날짜 컬럼 후보 ─── */
  const dateCols = (info?.columns || []).filter(c => columns[c]?.fmt === 'date' || LIKELY_DATE.has(c))

  /* ─── 계산 컬럼 드롭다운용 visible metric 컬럼 ─── */
  const visCols = (info?.columns || []).filter(c =>
    columns[c]?.visible !== false && !LIKELY_DATE.has(c) && !dims.has(c))

  /* ─── 컬럼 그룹화 ─── */
  const metricCols = (info?.columns || []).filter(c =>
    columns[c]?.visible !== false && !dims.has(c) && !LIKELY_DATE.has(c))
  const dimCols = [...(tCfg.dimensionColumns || [])]
  const hiddenCols = (info?.columns || []).filter(c =>
    columns[c]?.visible === false || (LIKELY_DATE.has(c) && !dims.has(c) && columns[c]?.visible !== true))

  /* ─── 위젯 지표/그룹바이 (allItems 기반) ─── */
  const allMetrics = useMemo(
    () => buildTableMetrics(selTable, { ...columnConfig, [selTable]: tCfg }),
    [selTable, tCfg, columnConfig]
  )
  const allGroupBy = useMemo(
    () => buildTableGroupBy(selTable, { ...columnConfig, [selTable]: tCfg }),
    [selTable, tCfg, columnConfig]
  )

  /* ─── 위젯 미리보기 (draft 기반) ─── */
  const previewMetrics = useMemo(
    () => applyDraft(allMetrics, wmCfg.metrics?.items),
    [allMetrics, wmCfg.metrics]
  )
  const previewGroupBy = useMemo(
    () => applyDraft(allGroupBy, wmCfg.groupBy?.items),
    [allGroupBy, wmCfg.groupBy]
  )

  /* ─── 컬럼 타입 판별 ─── */
  const getColType = (col) => {
    if (columns[col]?.visible === false) return 'hidden'
    if (dims.has(col)) return 'dimension'
    return 'metric'
  }

  if (loading) return <Spinner dark={dark} />

  return (
    <div className="p-6 flex flex-col gap-5 max-w-5xl mx-auto">

      {/* ─── 헤더 ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-base font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>데이터 설정</h2>
          <p className={`text-xs mt-0.5 ${sub}`}>
            컬럼 설정 · 위젯 지표/그룹바이 · 계산 컬럼
          </p>
        </div>
        <div className="flex items-center gap-2">
          {globalSaved && (
            <span className="text-xs text-emerald-500 font-semibold animate-pulse">저장 완료</span>
          )}
          <button onClick={saveAll} disabled={!hasEdits}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-300
              ${globalSaved
                ? dark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                : hasEdits
                  ? dark ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                         : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                  : dark ? 'bg-[#252836] text-slate-600 cursor-not-allowed'
                         : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}>
            {globalSaved ? <><Check size={13} /> 저장됨</> : <><Save size={13} /> 전체 저장</>}
          </button>
          <button onClick={loadTables}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-colors
              ${dark ? 'border-[#252836] text-slate-400 hover:text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
            <RefreshCw size={13} /> 새로고침
          </button>
        </div>
      </div>

      {/* ─── 테이블 탭 ─── */}
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
              {tables[t] && (
                <span className={`ml-2 font-mono text-[10px] ${on ? '' : sub}`}>
                  {tables[t].count?.toLocaleString() ?? 0}행
                </span>
              )}
            </button>
          )
        })}
      </div>

      {!info ? (
        <div className={`rounded-xl border p-8 text-center ${card}`}>
          <p className={`text-sm ${sub}`}>테이블 데이터를 불러오는 중이거나 연결이 없습니다.</p>
        </div>
      ) : (
        <>
          {/* ─── 기본 정보 ─── */}
          <div className={`rounded-xl border ${card}`}>
            <div className={`px-5 py-3 border-b ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
              <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>기본 정보</p>
            </div>
            <div className={`px-5 py-4 flex items-center gap-4 flex-wrap`}>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-semibold shrink-0 ${sub}`}>표시명</span>
                <input
                  className={`${inp} h-7 min-w-[160px] max-w-xs`}
                  placeholder="예: 상품 매출"
                  value={displayName}
                  onChange={e => updateDisplayName(selTable, e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-semibold shrink-0 ${sub}`}>📅 날짜 컬럼</span>
                <select
                  className={`${sel} min-w-[140px]`}
                  value={dateColumn}
                  onChange={e => updateDateColumn(selTable, e.target.value)}
                >
                  <option value="">자동 감지</option>
                  {dateCols.map(c => (
                    <option key={c} value={c}>{columns[c]?.alias || c}</option>
                  ))}
                </select>
              </div>
              {saved[selTable] && (
                <span className="text-xs text-emerald-500 font-semibold animate-pulse ml-auto">저장됨</span>
              )}
            </div>
          </div>

          {/* ─── 컬럼 설정 ─── */}
          <div className={`rounded-xl border ${card}`}>
            <div className={`px-5 py-3 border-b ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
              <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>컬럼 설정</p>
            </div>
            <div className="px-5 py-4">
              {/* 테이블 헤더 */}
              <div className={`grid grid-cols-[minmax(120px,1fr)_minmax(100px,1fr)_80px_80px_50px_70px] gap-2 mb-2 text-[10px] font-bold uppercase tracking-wide px-2 ${sub}`}>
                <span>컬럼명</span>
                <span>별칭</span>
                <span>타입</span>
                <span>포맷</span>
                <span className="text-center">표시</span>
                <span>집계</span>
              </div>

              {/* ─ 지표 그룹 ─ */}
              {metricCols.length > 0 && (
                <div className="mb-3">
                  <div className={`flex items-center gap-2 mb-1 py-1`}>
                    <div className={`h-px flex-1 ${dark ? 'bg-[#252836]' : 'bg-slate-100'}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0
                      ${dark ? 'text-indigo-400' : 'text-indigo-500'}`}>
                      지표 ({metricCols.length}개)
                    </span>
                    <div className={`h-px flex-1 ${dark ? 'bg-[#252836]' : 'bg-slate-100'}`} />
                  </div>
                  {metricCols.map(col => {
                    const cfg = columns[col] || autoDetect(col)
                    return (
                      <div key={col}
                        className={`grid grid-cols-[minmax(120px,1fr)_minmax(100px,1fr)_80px_80px_50px_70px] gap-2 items-center py-1.5 px-2 rounded-lg transition-colors
                          ${dark ? 'hover:bg-[#13151C]' : 'hover:bg-slate-50'}`}>
                        <span className={`font-mono text-[11px] truncate ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{col}</span>
                        <input
                          className={`${inp} h-7`}
                          placeholder={col}
                          value={cfg.alias || ''}
                          onChange={e => updateCol(selTable, col, { alias: e.target.value })}
                        />
                        <select
                          className={sel}
                          value={getColType(col)}
                          onChange={e => changeColType(selTable, col, e.target.value)}
                        >
                          {TYPE_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <select
                          className={sel}
                          value={cfg.fmt || 'number'}
                          onChange={e => updateCol(selTable, col, { fmt: e.target.value })}
                        >
                          {FMT_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => updateCol(selTable, col, { visible: true })}
                          className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors mx-auto
                            ${dark ? 'text-emerald-400' : 'text-emerald-500'}`}>
                          <Eye size={13} />
                        </button>
                        <select
                          className={sel}
                          value={cfg.agg || 'sum'}
                          onChange={e => updateCol(selTable, col, { agg: e.target.value })}
                        >
                          {AGG_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ─ 디멘전 그룹 ─ */}
              {dimCols.length > 0 && (
                <div className="mb-3">
                  <div className={`flex items-center gap-2 mb-1 py-1`}>
                    <div className={`h-px flex-1 ${dark ? 'bg-[#252836]' : 'bg-slate-100'}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0
                      ${dark ? 'text-violet-400' : 'text-violet-500'}`}>
                      디멘전 ({dimCols.length}개)
                    </span>
                    <div className={`h-px flex-1 ${dark ? 'bg-[#252836]' : 'bg-slate-100'}`} />
                  </div>
                  {dimCols.map(col => {
                    const cfg = columns[col] || autoDetect(col)
                    return (
                      <div key={col}
                        className={`grid grid-cols-[minmax(120px,1fr)_minmax(100px,1fr)_80px_80px_50px_70px] gap-2 items-center py-1.5 px-2 rounded-lg transition-colors
                          ${dark ? 'hover:bg-[#13151C]' : 'hover:bg-slate-50'}`}>
                        <span className={`font-mono text-[11px] truncate ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{col}</span>
                        <input
                          className={`${inp} h-7`}
                          placeholder={col}
                          value={cfg.alias || ''}
                          onChange={e => updateCol(selTable, col, { alias: e.target.value })}
                        />
                        <select
                          className={sel}
                          value={getColType(col)}
                          onChange={e => changeColType(selTable, col, e.target.value)}
                        >
                          {TYPE_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <select
                          className={sel}
                          value={cfg.fmt || 'text'}
                          onChange={e => updateCol(selTable, col, { fmt: e.target.value })}
                        >
                          {FMT_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => updateCol(selTable, col, { visible: true })}
                          className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors mx-auto
                            ${dark ? 'text-emerald-400' : 'text-emerald-500'}`}>
                          <Eye size={13} />
                        </button>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-center
                          ${dark ? 'bg-violet-500/15 text-violet-400' : 'bg-violet-50 text-violet-600'}`}>
                          dim
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ─ 숨김/날짜 그룹 (접을 수 있음) ─ */}
              {hiddenCols.length > 0 && (
                <div>
                  <button
                    onClick={() => setHiddenColsOpen(prev => ({ ...prev, [selTable]: !prev[selTable] }))}
                    className={`flex items-center gap-2 w-full py-1 mb-1`}>
                    <div className={`h-px flex-1 ${dark ? 'bg-[#252836]' : 'bg-slate-100'}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1
                      ${dark ? 'text-slate-500' : 'text-slate-400'}`}>
                      {hiddenColsOpen[selTable]
                        ? <ChevronDown size={11} />
                        : <ChevronRight size={11} />}
                      숨김/날짜 ({hiddenCols.length}개)
                    </span>
                    <div className={`h-px flex-1 ${dark ? 'bg-[#252836]' : 'bg-slate-100'}`} />
                  </button>
                  {hiddenColsOpen[selTable] && hiddenCols.map(col => {
                    const cfg = columns[col] || autoDetect(col)
                    return (
                      <div key={col}
                        className={`grid grid-cols-[minmax(120px,1fr)_minmax(100px,1fr)_80px_80px_50px_70px] gap-2 items-center py-1.5 px-2 rounded-lg transition-colors opacity-50
                          ${dark ? 'hover:bg-[#13151C] hover:opacity-80' : 'hover:bg-slate-50 hover:opacity-80'}`}>
                        <span className={`font-mono text-[11px] truncate ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{col}</span>
                        <input
                          className={`${inp} h-7`}
                          placeholder={col}
                          value={cfg.alias || ''}
                          onChange={e => updateCol(selTable, col, { alias: e.target.value })}
                        />
                        <select
                          className={sel}
                          value={getColType(col)}
                          onChange={e => changeColType(selTable, col, e.target.value)}
                        >
                          {TYPE_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <select
                          className={sel}
                          value={cfg.fmt || 'number'}
                          onChange={e => updateCol(selTable, col, { fmt: e.target.value })}
                        >
                          {FMT_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => changeColType(selTable, col, 'metric')}
                          className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors mx-auto
                            ${dark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'}`}>
                          <EyeOff size={13} />
                        </button>
                        <span className={`text-[10px] text-center ${sub}`}>-</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ─── 위젯 표시 설정 ─── */}
          <div className={`rounded-xl border ${card}`}>
            <div className={`px-5 py-3 border-b ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
              <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>위젯 표시 설정</p>
              <p className={`text-[11px] mt-0.5 ${sub}`}>위젯 편집기 피커에 표시할 지표·그룹바이 순서와 라벨 설정</p>
            </div>
            <div className="px-5 py-4 flex flex-col gap-4">
              <ConfigSection
                title="지표 설정"
                allItems={allMetrics}
                items={wmCfg.metrics?.items || null}
                dark={dark}
                onChange={handleWidgetMetricsChange}
              />
              <ConfigSection
                title="그룹바이 설정"
                allItems={allGroupBy}
                items={wmCfg.groupBy?.items || null}
                dark={dark}
                onChange={handleWidgetGroupByChange}
              />
            </div>
          </div>

          {/* ─── 계산 컬럼 ─── */}
          <div className={`rounded-xl border ${card}`}>
            <div className={`px-5 py-3 border-b ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
                    계산 컬럼
                  </p>
                  <p className={`text-[11px] mt-0.5 ${sub}`}>COUNT / AVG / 수식으로 새 지표 생성</p>
                </div>
                <button
                  onClick={() => addComputed(selTable)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors
                    ${dark ? 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20'
                           : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
                  <Plus size={12} /> 추가
                </button>
              </div>
            </div>
            <div className="px-5 py-4">
              {computed.length === 0 && (
                <p className={`text-xs ${sub} py-2`}>
                  아직 계산 컬럼이 없습니다.
                </p>
              )}

              <div className="flex flex-col gap-3">
                {computed.map(cc => {
                  const ccType = cc.aggType === 'count' ? 'count'
                               : cc.aggType === 'avg' ? 'avg'
                               : 'formula'

                  const signSymbol = { '+': '+ ', '-': '- ', '*': '× ', '/': '÷ ' }
                  const buildPv = (terms) => (terms || [])
                    .filter(trm => trm.type === 'group' ? (trm.children || []).some(c => c.col) : trm.col)
                    .map(trm => {
                      if (trm.type === 'group') return `${signSymbol[trm.sign] || '+ '}(${buildPv(trm.children || [])})`
                      const label = trm.col === '__const__'
                        ? String(trm.value ?? '')
                        : (columns[trm.col]?.alias || trm.col)
                      return `${signSymbol[trm.sign] || '+ '}${label}`
                    })
                    .join(' ')
                    .replace(/^\+ /, '')

                  const preview = ccType === 'count'
                    ? 'COUNT(*)'
                    : ccType === 'avg' && cc.terms?.[0]?.col
                      ? `AVG(${columns[cc.terms[0].col]?.alias || cc.terms[0].col})`
                      : buildPv(cc.terms)

                  const ccRefs = computed.filter(o => o.id !== cc.id && o.name)

                  const ctrl = (trm, onUpdate, onRemove, canRemove) => (
                    <>
                      <select className={`${sel} w-10 text-center`} value={trm.sign}
                        onChange={e => onUpdate({ sign: e.target.value })}>
                        <option value="+">+</option><option value="-">-</option>
                        <option value="*">x</option><option value="/">÷</option>
                      </select>
                      <select className={`${sel} ${trm.col === '__const__' ? 'w-24' : 'flex-1'}`}
                        value={trm.col}
                        onChange={e => onUpdate({ col: e.target.value, ...(e.target.value === '__const__' ? { value: trm.value ?? 1 } : {}) })}>
                        <option value="">컬럼 선택...</option>
                        <option value="__const__">상수 (직접 입력)</option>
                        <optgroup label="컬럼">
                          {visCols.map(c => <option key={c} value={c}>{columns[c]?.alias || c}</option>)}
                        </optgroup>
                        {ccRefs.length > 0 && (
                          <optgroup label="계산 컬럼">
                            {ccRefs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </optgroup>
                        )}
                      </select>
                      {trm.col === '__const__' && (
                        <input type="number" className={`${inp} w-20 h-7 text-center`}
                          placeholder="1000" value={trm.value ?? ''}
                          onChange={e => onUpdate({ value: e.target.value })} />
                      )}
                      {canRemove && (
                        <button onClick={onRemove}
                          className={`p-0.5 shrink-0 rounded transition-colors ${dark ? 'text-slate-600 hover:text-red-400' : 'text-slate-300 hover:text-red-400'}`}>
                          <Trash2 size={11} />
                        </button>
                      )}
                    </>
                  )

                  return (
                    <div key={cc.id}
                      className={`rounded-xl border p-4
                        ${dark ? 'border-[#252836] bg-[#13151C]' : 'border-slate-100 bg-slate-50'}`}>
                      {/* 이름 + 타입 + 포맷 + 삭제 */}
                      <div className="flex items-center gap-2 mb-3">
                        <Calculator size={14} className={dark ? 'text-indigo-400' : 'text-indigo-500'} />
                        <input
                          className={`${inp} flex-1 font-semibold`}
                          placeholder="컬럼명 (예: 결제건수)"
                          value={cc.name}
                          onChange={e => updateComputed(selTable, cc.id, { name: e.target.value })}
                        />
                        <select
                          className={`${sel} w-[90px]`}
                          value={ccType}
                          onChange={e => changeComputedType(selTable, cc.id, e.target.value)}
                        >
                          {CC_TYPE_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <select
                          className={sel}
                          value={cc.fmt || 'number'}
                          onChange={e => updateComputed(selTable, cc.id, { fmt: e.target.value })}
                        >
                          {FMT_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeComputed(selTable, cc.id)}
                          className="text-red-400 hover:text-red-300 transition-colors p-1">
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* 타입별 내용 */}
                      {ccType === 'count' ? (
                        <div className={`ml-6 text-[11px] px-3 py-2 rounded-lg font-medium
                          ${dark ? 'bg-[#1A1D27] text-slate-400' : 'bg-white text-slate-500 border border-slate-100'}`}>
                          COUNT(*) — 행 수를 자동 집계합니다
                        </div>
                      ) : ccType === 'avg' ? (
                        <div className="ml-6 flex items-center gap-2">
                          <span className={`text-[11px] font-medium ${sub}`}>AVG(</span>
                          <select
                            className={`${sel} flex-1 max-w-xs`}
                            value={cc.terms?.[0]?.col || ''}
                            onChange={e => updateComputed(selTable, cc.id, { terms: [{ col: e.target.value, sign: '+' }] })}
                          >
                            <option value="">컬럼 선택...</option>
                            {visCols.map(c => <option key={c} value={c}>{columns[c]?.alias || c}</option>)}
                          </select>
                          <span className={`text-[11px] font-medium ${sub}`}>)</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5 ml-6">
                          {(cc.terms || []).map((term, idx) => {
                            if (term.type === 'group') return (
                              <div key={idx} className="flex items-start gap-2">
                                <select className={`${sel} w-10 text-center mt-2`} value={term.sign}
                                  onChange={e => updateTerm(selTable, cc.id, idx, { sign: e.target.value })}>
                                  <option value="+">+</option><option value="-">-</option>
                                  <option value="*">x</option><option value="/">÷</option>
                                </select>
                                <div className={`flex-1 rounded-lg border pl-3 pr-2 py-2 flex flex-col gap-1.5
                                  ${dark ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-indigo-300/40 bg-indigo-50/50'}`}>
                                  <span className={`text-[10px] font-bold ${dark ? 'text-indigo-400' : 'text-indigo-500'}`}>(</span>
                                  {(term.children || []).map((child, cidx) => (
                                    <div key={cidx} className="flex items-center gap-2">
                                      {ctrl(child,
                                        u => updateTermInGroup(selTable, cc.id, idx, cidx, u),
                                        () => removeTermFromGroup(selTable, cc.id, idx, cidx),
                                        (term.children || []).length > 1
                                      )}
                                    </div>
                                  ))}
                                  <button onClick={() => addTermToGroup(selTable, cc.id, idx)}
                                    className={`text-[11px] px-2 py-0.5 rounded self-start transition-colors
                                      ${dark ? 'text-slate-500 hover:text-indigo-400' : 'text-slate-400 hover:text-indigo-500'}`}>
                                    + 항목 추가
                                  </button>
                                  <span className={`text-[10px] font-bold ${dark ? 'text-indigo-400' : 'text-indigo-500'}`}>)</span>
                                </div>
                                {cc.terms.length > 1 && (
                                  <button onClick={() => removeTerm(selTable, cc.id, idx)}
                                    className={`p-0.5 shrink-0 rounded transition-colors mt-2 ${dark ? 'text-slate-600 hover:text-red-400' : 'text-slate-300 hover:text-red-400'}`}>
                                    <Trash2 size={11} />
                                  </button>
                                )}
                              </div>
                            )

                            return (
                              <div key={idx} className="flex items-center gap-2">
                                {ctrl(term,
                                  u => updateTerm(selTable, cc.id, idx, u),
                                  () => removeTerm(selTable, cc.id, idx),
                                  cc.terms.length > 1
                                )}
                              </div>
                            )
                          })}

                          <div className="flex items-center gap-3">
                            <button onClick={() => addTerm(selTable, cc.id)}
                              className={`text-[11px] px-2 py-1 rounded transition-colors
                                ${dark ? 'text-slate-500 hover:text-indigo-400' : 'text-slate-400 hover:text-indigo-500'}`}>
                              + 항목 추가
                            </button>
                            <button onClick={() => addGroup(selTable, cc.id)}
                              className={`text-[11px] px-2 py-1 rounded transition-colors
                                ${dark ? 'text-slate-500 hover:text-indigo-400' : 'text-slate-400 hover:text-indigo-500'}`}>
                              ( ) 그룹 추가
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 미리보기 */}
                      {preview && (
                        <div className={`mt-3 ml-6 text-[11px] px-3 py-1.5 rounded-lg
                          ${dark ? 'bg-[#1A1D27] text-slate-400' : 'bg-white text-slate-500 border border-slate-100'}`}>
                          = {preview}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ─── 미리보기 ─── */}
          <div className={`rounded-xl border ${card}`}>
            <div className={`px-5 py-3 border-b ${dark ? 'border-[#252836]' : 'border-slate-100'}`}>
              <p className={`text-xs font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
                미리보기 — 위젯 편집기에서 보이는 모습
              </p>
            </div>
            <div className="px-5 py-4 flex flex-col gap-4">
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
        </>
      )}
    </div>
  )
}
